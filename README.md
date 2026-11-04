# Gulab & Co website

This repository contains the public static website recovered on 4 November 2026 from `https://gulab-and-co.vercel.app`, plus the approved reliability and SEO repair. The GitHub repository was empty at recovery. Public GET responses do not establish how the original hosting account or form backend was configured; the original server configuration has not been recovered.

The recovered baseline is commit `de6fc67`. The owner approved all four visible changes together on 4 November 2026. Production deployment and enquiry delivery remain unverified until the hosting account and approved receiver are connected.

## Local validation

Use Node 24, then `npm ci`, `npm test` and `npm run verify`. No TypeScript check is required. The tests use stubbed receivers and never submit a real enquiry.

`npm run optimise:images` recreates responsive WebP variants from original images. Font and image filenames include content hashes. Font licences are retained in `public/fonts`.

## Hosting

`vercel.json` prepares static files from `public`, extensionless page URLs, and the Node function in `api/enquiry.js`. `npm run verify` is the build command. Node 24 and a 20-second function duration are specified. This configuration is prepared for the existing Vercel host; deployment and account settings still require verification in that hosting account. This draft does not move the site or change DNS.

The intended canonical origin remains `https://www.gulabandco.com.au`. Its domain connection and TLS are being handled separately. Once connected, verify the five business URLs, permanent redirects from `.html` URLs and alternate hostnames, sitemap, social images and indexing headers. `/thank-you` is excluded from indexing and the sitemap.

## Enquiry integration

The old public HTML used Netlify form attributes on a Vercel-served site. Submission failure was suspected, not confirmed: this work has not inspected the original private backend or sent a real lead.

The replacement uses a host-neutral core in `server/enquiry.js` and a Vercel Web Request/Response adapter in `api/enquiry.js`. Supply these server-only settings through the hosting account, using `.env.example` as a template:

- `GULAB_ENQUIRY_WEBHOOK_URL`: an owner-approved HTTPS receiver.
- `GULAB_ENQUIRY_WEBHOOK_TOKEN`: a receiver authentication token of at least 16 characters.
- `GULAB_ENQUIRY_ALLOWED_ORIGINS`: optional comma-separated exact HTTPS origins. Defaults cover the intended apex/www domain and the current public Vercel hostname. Add other previews deliberately; no wildcard origins.

Do not put tokens in HTML, JavaScript assets, Git or logs. An availability response indicates valid configuration for the current origin, not verified delivery. Missing configuration keeps the form disabled and displays the existing public phone and alternate email address.

The receiver gets an authenticated HTTPS JSON POST:

```json
{"source":"gulab-website","requestId":"UUID-v4","firstName":"...","lastName":"...","email":"...","phone":"...","buyerType":"...","location":"...","message":"..."}
```

Headers include `Authorization: Bearer <token>` and `Idempotency-Key: <requestId>`. The receiver must persist the enquiry before returning HTTP 2xx JSON `{"success":true,"submissionId":"durable-id"}`. It must deduplicate retries by request ID and apply shared rate limits. A honeypot and origin checks are basic controls, not a complete bot defence.

The handler limits the body to 16 KB and acknowledgement to 4 KB, rejects redirected receivers, and times out after 10 seconds. Errors, HTML responses and unconfirmed acknowledgements never navigate to the success page. Browser retries retain entered details and their request ID; edits create a new ID.

Before enabling the form, confirm receiver ownership, access, delivery destination, rate limits and retention. Run an owner-controlled delivery test after deployment and verify the durable record and notification. No such live submission has been performed during this repair.

## Approved visible changes

1. Hold the four homepage testimonials until the client verifies the quotes, identities, permissions and supporting transaction evidence. The original section is preserved in the baseline history and in the ignored local `output/held-testimonials.html`.
2. Replace the Process page's fee-beating savings claim with a heading, **Budget and purchase price**, and this wording: “Buying below your maximum budget leaves unused budget. It does not establish a discount to market value or show that the saving exceeds the buyer’s agent fee.”
3. Show honest form availability, phone/email alternatives and confirmation only after the receiver acknowledges saving an enquiry.
4. Use native expandable About panels and an accessible mobile menu with a close control, keyboard containment and focus restoration. Existing branding and page structure are preserved.

Technical repairs include visible initial content, final counter values in HTML, local fonts, responsive images, consistent canonical/social/sitemap paths, working local social images and appropriate caching. The intended production origin has not been changed.

Privacy wording, testimonials and business claims must be supplied or verified by the client. No new legal notice, pricing change or domain migration is included.

## Validation evidence (local draft, 4 November 2026)

- Eight enquiry test groups cover validation, rejected origins, unavailable configuration, bounded responses, failed receivers, confirmed receipts and retry IDs. Only stubbed receivers were used.
- Static verification covers all six HTML pages, assets, links, production metadata, sitemap and form fallback.
- Twenty-four browser page checks cover six routes with scripts enabled/disabled at mobile and desktop sizes. Separate intercepted contact scenarios verify retained details after failure and navigation only after explicit success.
- Mobile visual review checks the stats cards and contact layout at narrow widths. Local review screenshots and machine-readable results are in ignored `output/`.
- Three local homepage mobile Lighthouse runs scored 93, 93 and 84; median LCP was 3.08 seconds and transfer was approximately 0.38 MB. These localhost results are not live-host or field Core Web Vitals results. Repeat production checks after deployment; no claim of a perfect performance score or verified live delivery is made.
