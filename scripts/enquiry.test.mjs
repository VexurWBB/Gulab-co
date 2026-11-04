import test from 'node:test';
import assert from 'node:assert/strict';
import { handleEnquiry } from '../server/enquiry.js';

const origin = 'https://www.gulabandco.com.au';
const config = { GULAB_ENQUIRY_WEBHOOK_URL: 'https://receiver.example/enquiries', GULAB_ENQUIRY_WEBHOOK_TOKEN: 'local-test-token-not-a-real-secret' };
const fields = { 'first-name': 'Test', 'last-name': 'Buyer', email: 'test@example.com', phone: '0400 000 000', 'buyer-type': 'first-home', location: 'Gold Coast', message: 'Local test only', 'request-id': 'de4fa82b-c9fe-4b4b-b230-a316eadf91de', 'bot-field': '' };
const request = (values = fields, extra = {}) => new Request(origin + '/api/enquiry', { method: 'POST', body: JSON.stringify(values), ...extra, headers: { Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json', ...extra.headers } });
const noNetwork = () => assert.fail('This request must not contact a receiver');

test('missing and invalid configuration fail closed and expose only availability', async () => {
  for (const env of [{}, { ...config, GULAB_ENQUIRY_WEBHOOK_URL: 'http://receiver.example' }, { ...config, GULAB_ENQUIRY_WEBHOOK_TOKEN: '' }, { ...config, GULAB_ENQUIRY_ALLOWED_ORIGINS: 'https://*.example.com/' }]) {
    const response = await handleEnquiry(new Request(origin + '/api/enquiry'), env, noNetwork);
    assert.deepEqual(await response.json(), { available: false });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await handleEnquiry(request(), env, noNetwork)).status, 503);
  }
  assert.deepEqual(await (await handleEnquiry(new Request(origin + '/api/enquiry'), config, noNetwork)).json(), { available: true });
  assert.deepEqual(await (await handleEnquiry(new Request('https://unapproved-preview.example/api/enquiry'), config, noNetwork)).json(), { available: false });
  const head = await handleEnquiry(new Request(origin + '/api/enquiry', { method: 'HEAD' }), config, noNetwork);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('a saved receipt is required; credentials and idempotency stay server-side', async () => {
  let calls = 0;
  const response = await handleEnquiry(request(), config, async (url, options) => {
    calls++;
    assert.equal(url, config.GULAB_ENQUIRY_WEBHOOK_URL);
    assert.equal(options.headers.Authorization, 'Bearer ' + config.GULAB_ENQUIRY_WEBHOOK_TOKEN);
    assert.equal(options.headers['Idempotency-Key'], fields['request-id']);
    assert.equal(options.redirect, 'error');
    const payload = JSON.parse(options.body);
    assert.equal(payload.firstName, 'Test');
    assert.equal(payload.source, 'gulab-website');
    assert.equal(payload.requestId, fields['request-id']);
    assert.equal(payload['bot-field'], undefined);
    return Response.json({ success: true, submissionId: 'stub-saved-123' });
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, submissionId: 'stub-saved-123' });
});

test('plain 200, HTML, redirects, empty receipts and receiver failures never report success', async () => {
  for (const receiver of [
    () => new Response('<h1>Thank you</h1>', { headers: { 'Content-Type': 'text/html' } }),
    () => Response.json({}),
    () => Response.json({ success: true }),
    () => Response.json({ success: false, submissionId: 'stub' }),
    () => Response.json({ success: true, submissionId: '<script>' }),
    () => Response.redirect('https://elsewhere.example/', 302),
    () => new Response('Unavailable', { status: 503 }),
    () => new Response('{bad json', { headers: { 'Content-Type': 'application/json' } }),
    () => { throw new DOMException('Timed out', 'TimeoutError'); },
  ]) {
    const response = await handleEnquiry(request(), config, receiver);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
    assert.equal(response.headers.get('Location'), null);
  }
});

test('cross-site and absent origins, unsupported methods and media types are rejected', async () => {
  assert.equal((await handleEnquiry(request(fields, { headers: { Origin: 'https://evil.example' } }), config, noNetwork)).status, 403);
  const missingOrigin = request(); missingOrigin.headers.delete('origin');
  assert.equal((await handleEnquiry(missingOrigin, config, noNetwork)).status, 403);
  assert.equal((await handleEnquiry(request(fields, { method: 'PUT' }), config, noNetwork)).status, 405);
  assert.equal((await handleEnquiry(request(fields, { headers: { 'Content-Type': 'text/plain' } }), config, noNetwork)).status, 415);
});

test('invalid fields, objects, oversize values and honeypot cannot reach the receiver', async () => {
  for (const invalid of [{ ...fields, email: 'not-email' }, { ...fields, phone: 'call-me' }, { ...fields, 'first-name': { value: 'Test' } }, { ...fields, 'last-name': 'a'.repeat(81) }, { ...fields, 'buyer-type': 'unexpected' }, { ...fields, 'request-id': 'not-uuid' }, { ...fields, 'bot-field': 'bot' }, { ...fields, message: 'a'.repeat(4001) }, []]) {
    assert.equal((await handleEnquiry(request(invalid), config, noNetwork)).status, 422);
  }
  assert.equal((await handleEnquiry(request({ ...fields, message: 'a'.repeat(17000) }), config, noNetwork)).status, 413);
  const malformed = new Request(origin + '/api/enquiry', { method: 'POST', headers: { Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await handleEnquiry(malformed, config, noNetwork)).status, 400);
});

test('native URL-encoded POST redirects only after a saved receipt; failure HTML contains no input', async () => {
  const native = () => new Request(origin + '/api/enquiry', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) });
  const success = await handleEnquiry(native(), config, async () => Response.json({ success: true, submissionId: 'stub-123' }));
  assert.equal(success.status, 303);
  assert.equal(success.headers.get('Location'), '/thank-you');
  const failure = await handleEnquiry(native(), {}, noNetwork);
  assert.equal(failure.status, 503);
  assert.match(failure.headers.get('Content-Type'), /text\/html/);
  const html = await failure.text();
  assert.match(html, /0411 308 747/);
  assert.doesNotMatch(html, /test@example\.com|Local test only/);
});

test('oversize receiver data and duplicate native fields fail without a success response', async () => {
  const oversized = await handleEnquiry(request(), config, async () => Response.json({ success: true, submissionId: 'stub', padding: 'x'.repeat(5000) }));
  assert.equal(oversized.status, 502);
  const duplicates = new Request(origin + '/api/enquiry', { method: 'POST', headers: { Origin: origin, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() + '&email=other@example.com' });
  assert.equal((await handleEnquiry(duplicates, config, noNetwork)).status, 400);
});

test('retry retains the request ID so the configured receiver can deduplicate', async () => {
  const ids = [];
  const receiver = async (_url, options) => {
    ids.push(options.headers['Idempotency-Key']);
    if (ids.length === 1) throw new Error('Acknowledgement lost');
    return Response.json({ success: true, submissionId: 'same-saved-record' });
  };
  assert.equal((await handleEnquiry(request(), config, receiver)).status, 502);
  assert.equal((await handleEnquiry(request(), config, receiver)).status, 200);
  assert.deepEqual(ids, [fields['request-id'], fields['request-id']]);
});
