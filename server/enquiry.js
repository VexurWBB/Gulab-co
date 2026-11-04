const MAX_BODY_BYTES = 16 * 1024;
const DEFAULT_ORIGINS = [
  'https://www.gulabandco.com.au',
  'https://gulabandco.com.au',
  'https://gulab-and-co.vercel.app',
];
const COMMON_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
};
const UNAVAILABLE = 'Online enquiries are temporarily unavailable. Please call 0411 308 747 or use the email links on our contact page.';
const NOT_CONFIRMED = 'We could not confirm your enquiry was saved. Please try again, or call 0411 308 747.';

function configuration(env) {
  try {
    const webhook = new URL(env.GULAB_ENQUIRY_WEBHOOK_URL || '');
    const token = env.GULAB_ENQUIRY_WEBHOOK_TOKEN || '';
    if (webhook.protocol !== 'https:' || webhook.username || webhook.password || webhook.hash || token.length < 16 || token.length > 4096 || /[\r\n]/.test(token)) return null;
    const origins = env.GULAB_ENQUIRY_ALLOWED_ORIGINS
      ? env.GULAB_ENQUIRY_ALLOWED_ORIGINS.split(',').map(value => value.trim())
      : DEFAULT_ORIGINS;
    if (!origins.length || origins.some(value => {
      const url = new URL(value);
      return url.protocol !== 'https:' || url.origin !== value;
    })) return null;
    return { webhook: webhook.href, token, origins: new Set(origins) };
  } catch {
    return null;
  }
}

function result(request, status, message, extra = {}) {
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json({ success: false, message, ...extra }, { status, headers: COMMON_HEADERS });
  }
  // Only fixed application messages enter this HTML, never submitted details.
  return new Response(`<!doctype html><html lang="en-AU"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Enquiry | Gulab &amp; Co Buyers Agents</title><main><h1>Your enquiry was not confirmed</h1><p>${message}</p><p><a href="/contact">Return to contact</a> or <a href="tel:+61411308747">call 0411 308 747</a>.</p></main></html>`, {
    status,
    headers: { ...COMMON_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function boundedText(body, maxBytes) {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new RangeError('Body too large');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function validate(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null;
  const read = (name, limit, required = false) => {
    const value = fields[name] ?? '';
    if (typeof value !== 'string') throw new Error('Invalid field');
    const text = value.trim();
    if (text.length > limit || (required && !text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error('Invalid field');
    return text;
  };
  try {
    if (read('bot-field', 200)) return null;
    const firstName = read('first-name', 80, true);
    const lastName = read('last-name', 80, true);
    const email = read('email', 254, true);
    const phone = read('phone', 30, true);
    const buyerType = read('buyer-type', 30);
    const location = read('location', 200);
    const message = read('message', 4000);
    const requestId = read('request-id', 36, true);
    if (/[\r\n]/.test(firstName + lastName) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    if (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 6) return null;
    if (!['', 'first-home', 'family', 'relocating', 'investor', 'upsizing', 'downsizing', 'other'].includes(buyerType)) return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return null;
    return { requestId, firstName, lastName, email, phone, buyerType, location, message };
  } catch {
    return null;
  }
}

/** The receiving service must persist before acknowledging, deduplicate requestId,
 * and enforce its own shared rate limit. No submission data or secrets are logged. */
export async function handleEnquiry(request, env = {}, fetcher = fetch) {
  const config = configuration(env);
  const requestOrigin = new URL(request.url).origin;
  if (request.method === 'GET' || request.method === 'HEAD') {
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ available: !!config?.origins.has(requestOrigin) }), {
      status: 200,
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (request.method !== 'POST') {
    const response = result(request, 405, 'Please use the enquiry form on our contact page.');
    response.headers.set('Allow', 'GET, HEAD, POST');
    return response;
  }
  if (!config) return result(request, 503, UNAVAILABLE);
  const origin = request.headers.get('origin');
  if (!config.origins.has(origin) || origin !== requestOrigin) {
    return result(request, 403, 'Please send your enquiry from our contact page.');
  }
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!['application/json', 'application/x-www-form-urlencoded'].includes(type)) {
    return result(request, 415, 'Please use the enquiry form on our contact page.');
  }
  let fields;
  try {
    const raw = await boundedText(request.body, MAX_BODY_BYTES);
    if (type === 'application/json') fields = JSON.parse(raw);
    else {
      const values = new URLSearchParams(raw);
      if (new Set(values.keys()).size !== [...values.keys()].length) throw new Error('Duplicate field');
      fields = Object.fromEntries(values);
    }
  } catch (error) {
    return result(request, error instanceof RangeError ? 413 : 400, 'Your enquiry could not be read. Please check the form and try again.');
  }
  const submission = validate(fields);
  if (!submission) return result(request, 422, 'Please check your name, email, phone and enquiry details, then try again.');
  try {
    const upstream = await fetcher(config.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.token}`,
        'Idempotency-Key': submission.requestId,
      },
      body: JSON.stringify({ source: 'gulab-website', ...submission }),
      redirect: 'error',
      signal: AbortSignal.any([AbortSignal.timeout(10000), request.signal]),
    });
    if (!upstream.ok || !upstream.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      await upstream.body?.cancel();
      return result(request, 502, NOT_CONFIRMED);
    }
    const receipt = JSON.parse(await boundedText(upstream.body, 4096));
    if (receipt?.success !== true || typeof receipt.submissionId !== 'string' || !/^[\w.:-]{1,200}$/.test(receipt.submissionId)) {
      return result(request, 502, NOT_CONFIRMED);
    }
    if (request.headers.get('accept')?.includes('application/json')) {
      return Response.json({ success: true, submissionId: receipt.submissionId }, { headers: COMMON_HEADERS });
    }
    return new Response(null, { status: 303, headers: { ...COMMON_HEADERS, Location: '/thank-you' } });
  } catch {
    // Keep retries on the same request ID: an interrupted acknowledgement is not
    // evidence that the receiver failed to save the original request.
    return result(request, 502, NOT_CONFIRMED);
  }
}
