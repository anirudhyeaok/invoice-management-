# Accounts Payable Prototype

A local full-stack course prototype for tracking supplier invoices. It extracts details from uploaded documents, compares invoices with optional purchase orders, routes invoices for manager review, and records approval history. It does not move real money.

## What it includes

- Clerk, manager, and admin sign-in with role-based access.
- Invoice upload and OCR for PDF, JPG, and PNG documents.
- Vendor directory and purchase-order matching.
- Manager approval queue, approve/reject comments, correction and resubmission, and status history.
- On-hold status with a reason; managers/admins can pause eligible invoices and release them back to their previous step.
- Clerk payment page for manager-approved INR invoices, using Razorpay-hosted checkout and server-side signature/capture verification. Test keys only; live keys are rejected.
- Manager/admin invoice CSV export with date and status filters, including approval, exception, and payment details.
- Synthetic demo users, vendors, purchase orders, and invoices.

The vendor names and records created by the seed script are sample data to make the prototype usable. Managers and admins can add custom vendors from **Vendors**; new vendors then appear in invoice intake. Clerks can select vendors but cannot create them.

## Run on Windows

Requirements: Node.js 20 or newer and MongoDB Community Server. The developer machine may also have the project-local MongoDB files under `.local-mongodb`; that ignored folder is not included in a GitHub clone. The startup script uses the local copy when present, uses `mongod.exe` from `PATH` when available, or connects to a MongoDB service already listening on port 27017.

1. Install dependencies: `npm run install:all`.
2. Copy `server/.env.example` to `server/.env` and set a private `JWT_SECRET`. The default database URI is local MongoDB.
3. Make sure MongoDB is running locally (or `mongod.exe` is available on `PATH`).
4. Start the database launcher, API, and frontend: `npm run dev`.
5. Open the Vite address shown in the terminal. It is usually `http://localhost:5173`; if that port is busy Vite prints another one.
6. If you need to create the demo records on a fresh database, open a second terminal and run `npm --prefix server run seed`.

The database records and uploaded documents are stored in MongoDB. Invoice uploads are placed in GridFS, so links keep working after the API restarts. The database files are stored in `.local-mongodb/data/` when the project-local server is used. In MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open `ap-system`.

## Payment checkout

The Payments page is available to Clerks and Admins. It only offers manager-approved INR invoices. The API creates a Razorpay order from the saved invoice amount, and the checkout opens on Razorpay's hosted payment page. The app records an invoice as paid only after the server validates the checkout signature and confirms that Razorpay captured the matching amount and currency.

Create **test mode** API keys in the Razorpay dashboard, then add them to `server/.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

The secret stays on the API server. The app refuses live keys, and the test gateway does not charge real money. If keys are absent, the Payments page explains that checkout is not connected. To test payment, use Razorpay's test checkout methods shown in its dashboard.

## Invoice CSV export

Managers and Admins can open **CSV report** and download the complete invoice register, optionally filtered by status and invoice date. The file includes invoice totals, vendors, purchase orders, line items, discrepancies, workflow notes, comments, approval data, provider IDs, payment attempts, and timestamps. It opens in spreadsheet software; no separate charts or report dashboards are part of this prototype.

## Demo sign-in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@apSystem.com` | `Admin@123` |
| Manager | `manager@apSystem.com` | `Manager@123` |
| Clerk | `clerk@apSystem.com` | `Clerk@123` |

These credentials are only for the local demo. Change them before using a shared or deployed environment. There is no public sign-up; admins create staff accounts from **Team members**.

## Prototype limits and next work

OCR can misread amounts, dates, vendors, and scanned layouts; a person must verify the extracted fields. Scanned PDFs are processed from the first page. The interface does not show an OCR confidence meter. Email reminders are deferred. The hosted payment page is a real provider checkout in test mode, not an in-app control that pretends to send payment.

## Deploy on Vercel

The repository is split into a React frontend and an Express API. In Vercel, create two projects from this repository:

1. **Frontend project:** set Root Directory to `client`. Vercel builds the Vite app. Set `VITE_API_BASE_URL` to the API deployment URL followed by `/api`, for example `https://your-api.vercel.app/api`.
2. **API project:** set Root Directory to `server`. Vercel detects the exported Express app. Set `NODE_ENV=production`, `MONGO_URI` to a MongoDB Atlas database URI, `JWT_SECRET` to a long private value, `CLIENT_URL` to the frontend deployment URL, and the two Razorpay **test** keys above.
3. Add the Vercel API deployment's origin to the Atlas network access list according to the connection option available on your Atlas plan. Use test keys and synthetic records for a class demo.

The API stores invoice documents in MongoDB GridFS, so it does not depend on Vercel's temporary filesystem. The local upload limit is 10 MB; the Vercel upload limit is 4 MB to stay below Vercel Functions' request-size limit. This project is configured for a desktop browser workflow; it is not a mobile app. Email reminders remain deferred.

## GitHub hygiene

- `.env` files, local uploaded documents, MongoDB data, logs, dependencies, and build output are ignored by Git.
- `.env.example` files contain placeholders only. Never commit real database credentials, JWT secrets, private invoices, or production payment keys.
- Demo accounts and seeded records are fictional course data; do not use the demo passwords on a public deployment.

## Project layout

- `client/` — React and Vite frontend.
- `server/` — Express API, Mongoose models, OCR services, role checks, and invoice workflows.
- `scripts/` — local MongoDB startup helper.
