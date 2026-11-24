<!-- coderabbit-ai-generated:v1 -->

# CARBAAZ

CARBAAZ combines a detailing workshop, appointment calendar, pre-owned vehicle inventory, customer accounts and an operations ERP. The React client and Express API share an origin. PostgreSQL is the system of record; schema and SQL migrations live in server/prisma. INR amounts are stored as whole rupees and converted to paise when creating a payment. Booking timestamps are stored in UTC and shown in Asia/Kolkata.

## Run locally

Use Node 24, npm, and a disposable PostgreSQL database owned by the application user. From the repository root:

1. Run `npm ci` and `npm run generate`.
2. Copy `.env.example` to `.env`. Set DATABASE_URL, APP_ORIGIN (http://localhost:3000 for local work), and a random JWT_SECRET of at least 32 characters. Generate a secret with `openssl rand -hex 48`. Never commit the resulting file.
3. For a database inside the workspace, use a localhost URL of the form postgresql://carbaaz:YOUR_RANDOM_PASSWORD@127.0.0.1:5433/carbaaz and run `node scripts/local-db.mjs` in a separate terminal. The optional embedded database stores files under .local/pg. Where npm has blocked lifecycle scripts, run the Linux x64 embedded package's scripts/hydrate-symlinks.js using Node first, or use an ordinary PostgreSQL installation.
4. Run `npm run migrate` then `npm run seed`. The seed installs roles, twelve services and example package prices. Review names, availability, prices and imagery with the workshop before launch. Set DEMO_INVENTORY=1 only in a demo database to include three explicitly illustrative listings.
5. Run `npm run dev`. Open http://localhost:3000. The production build is `npm run build`; `npm start` serves the compiled storefront and API together. Production requires HTTPS for session cookies.
6. To test verification and recovery locally, start `node scripts/local-mail.mjs`, set SMTP_URL=smtp://127.0.0.1:2525 and MAIL_FROM=workshop@example.test, then restart the app. The private .local/mail directory contains test messages and single-use links. Never expose the directory as a static site.

## Create the first administrator

On the trusted server, set ADMIN_EMAIL to an unused, owner-controlled address and ADMIN_PASSWORD to a unique password of at least 12 characters in the environment; run `npm run seed` and remove those variables afterward. Seeding is idempotent and does not elevate an existing customer or replace an existing password. Log in at /login. Use Staff Management to add a Manager, Staff member or Admin. Only a Super Admin can manage staff roles and grant the Staff role extra read access to catalog modules. Managers can inspect operations and manage bookings. Staff booking views contain assigned jobs only. Register ordinary customer accounts at /register.

## Operations

- Services and packages have independent prices and soft deletion. Booking items retain the purchased price and service duration. The calendar currently represents **one shared bay**, with half-hour starts from 09:00 to 18:00 IST and a 90-day horizon. Reservation and rescheduling transactions acquire all occupied time blocks; the database rejects overlapping reservations. Cancellation releases the blocks.
- Customers manage their own bookings, enquiries, seller submissions, notification preferences and saved vehicles. Guests can track an enquiry with its random reference **and** registered mobile number. Public tracking returns only the status history and customer-facing remarks.
- Submit vehicle photos as a signed-in owner. Uploads are decoded, bounded, resized and re-encoded as WebP. Seller photos use authenticated Cloudinary assets (or a private local directory); access goes through an authorized API route. Public service and inventory uploads require an administrator.
- The ERP records sales, purchases, payments, refund records and activity history. Refund entries are bookkeeping records; actual refunds must be processed with the payment provider. Reports export PDF or Excel for the selected rolling period.
- Website Settings accepts the company address, phone, email, hours, social URLs, Google Maps embed URL, story, team, workshop, logo, favicon, hero banner and description. Supply verified business details and authorized media. The original supplied artwork is preserved in public/media/official-logo.png; brand.webp is a cropped derivative. Other bundled photographs are illustrative Unsplash assets.

## Provider configuration

- **Email:** configure SMTP_URL and MAIL_FROM with the authorized sender. Verification and recovery mail includes a one-hour link; only its digest is persisted. Without SMTP, external mail is not delivered.
- **Uploads:** configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET server-side. Production has no local disk fallback.
- **Checkout:** configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Register https://carbaaz.in/webhooks/stripe for checkout.session.completed and checkout.session.async_payment_succeeded. Payment confirmation validates the signature, reference, currency and amount. Repeated webhook events do not duplicate the receipt. Test using Stripe test mode before enabling real charges. The development-only STRIPE_LOCAL_PORT directs the SDK to a loopback emulator; never set it in production.
- **Status notifications:** dashboard notifications are written with the business transaction. To deliver them externally, point NOTIFICATION_RELAY_URL at an authorized HTTPS relay and set NOTIFICATION_RELAY_TOKEN. The relay receives a bearer-authenticated JSON POST with channel, to, message and logo. Email requires a verified user; SMS and WhatsApp require a profile number and explicit opt-in. The relay must deduplicate by Idempotency-Key and return a success status only after accepting delivery. Provision authorized provider accounts, approved templates and any required consent controls at the relay. Delivery attempts use a database lease, back off on failure and stop after eight attempts; monitor undelivered Notification rows.
- Never prefix provider credentials with VITE_. The frontend uses only same-origin /api endpoints.

## Deploy and operate

The included Render Blueprint deploys one Docker web service and a managed PostgreSQL database. A single origin avoids cross-site cookie/CORS complexity. Migrations run before the production server starts. Seed a fresh database once after deployment. Set the production secrets in the hosting provider's secret store. Both carbaaz.in and www.carbaaz.in should be attached to that service; use the DNS targets actually provided by the host, enable managed TLS for both names, and confirm that www redirects to the canonical apex. The repository contains no credentials or DNS changes.

Use /api/health for a database-backed readiness probe. Configure the hosting platform to alert on sustained failures and server errors. Set edge request limits and configure proxy trust for the actual hosting topology before scaling; in-process request limits are per instance. Enable managed PostgreSQL backups and point-in-time recovery where available. Schedule restore drills into a separate database; verify migration history, row counts, representative bookings and protected image access. Keep independent media backups with appropriate retention. Configure access logging to exclude passwords, cookies, link tokens and private form bodies. Check that your content retention and deletion procedures cover both database records and media assets.

## Verification

On a running **disposable local** database and app, run `npm test`. The suite creates synthetic accounts and transactions; it is not intended for customer or staging data. It checks customer/admin login, registration, authorization, private photos, concurrent bookings, rescheduling, cancellation, service/inventory CRUD, buy/sell requests, private tracking, customer records, reports, PDF/Excel export and logout. With the included local mailbox it checks verification and single-use recovery. With STRIPE_LOCAL_PORT configured, it also checks checkout creation and signed webhook idempotency. Run `npm run build` for TypeScript checks and the production bundle.

Local checks cannot verify live DNS, TLS provisioning, real message delivery, merchant settlement, Cloudinary settings, backup restoration or operational load. Complete these checks against owner-controlled configurations before launch.
