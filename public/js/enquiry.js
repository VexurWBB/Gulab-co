(function () {
  const form = document.querySelector('#enquiry-form, form[name="discovery-call"]');
  if (!form) return;
  const fields = form.querySelector('[data-enquiry-fields]');
  const status = form.querySelector('[data-enquiry-status]');
  const requestId = form.querySelector('[name="request-id"]');
  if (!fields || !status || !requestId) return;
  fields.disabled = true;
  let sending = false;
  let available = false;

  const unavailable = 'Online enquiries are temporarily unavailable. Please use the phone or email links on this page.';
  const setMessage = (text, error = false) => {
    status.textContent = text;
    status.setAttribute('role', error ? 'alert' : 'status');
  };
  const newRequestId = () => { requestId.value = window.crypto.randomUUID(); };

  form.addEventListener('input', event => {
    if (!sending && event.target !== requestId && available) newRequestId();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !available) return;
    if (!form.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(form));
    sending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setMessage('Sending your enquiry...');
    let failureMessage = 'We could not confirm your enquiry was saved. Your details are still here. Please try again or call our team.';
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const receipt = await response.json();
      if (!response.ok || receipt?.success !== true || typeof receipt.submissionId !== 'string' || !/^[\w.:-]{1,200}$/.test(receipt.submissionId)) {
        if (typeof receipt?.message === 'string' && receipt.message.length <= 300) failureMessage = receipt.message;
        throw new Error('Submission not confirmed');
      }
      window.location.assign('/thank-you');
    } catch (error) {
      setMessage(error.name === 'AbortError' || error.name === 'TimeoutError' || error.message === 'Failed to fetch'
        ? 'The connection was interrupted. Your details are still here. Please try again or call our team.'
        : failureMessage, true);
      fields.disabled = false;
      sending = false;
      form.setAttribute('aria-busy', 'false');
    }
  });

  async function prepare() {
    try {
      const response = await fetch('/api/enquiry', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const config = await response.json();
      if (!response.ok || config.available !== true || !window.crypto?.randomUUID) throw new Error('Unavailable');
      newRequestId();
      available = true;
      fields.disabled = false;
      setMessage('You can send your enquiry below.');
    } catch {
      setMessage(unavailable);
    }
  }
  prepare();
})();
