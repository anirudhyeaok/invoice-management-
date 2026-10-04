# Accounts Payable Prototype

A local full-stack course prototype for tracking supplier invoices. It extracts details from uploaded documents, compares invoices with optional purchase orders, routes invoices for manager review, and records approval history. It does not move real money.

## What it includes

- Clerk, manager, and admin sign-in with role-based access.
- Invoice upload and OCR for PDF, JPG, and PNG documents.
- Vendor directory and purchase-order matching.
- Manager approval queue, approve/reject comments, correction and resubmission, and status history.
- On-hold status with a reason; managers/admins can pause eligible invoices and release them back to their previous step.
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

The database files are stored in `.local-mongodb/data/` when the project-local server is used. In MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open `ap-system`.

## Demo sign-in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@apSystem.com` | `Admin@123` |
| Manager | `manager@apSystem.com` | `Manager@123` |
| Clerk | `clerk@apSystem.com` | `Clerk@123` |

These credentials are only for the local demo. Change them before using a shared or deployed environment. There is no public sign-up; admins create staff accounts from **Team members**.

## Prototype limits and next work

OCR can misread amounts, dates, vendors, and scanned layouts; a person must verify the extracted fields. Scanned PDFs are processed from the first page. The approval workflow records decisions, but email reminders are not configured. Payment simulation and the fuller reporting pages are the next planned implementation; no real payment is initiated.

## GitHub hygiene

- `.env` files, uploaded documents, MongoDB data, logs, dependencies, and build output are ignored by Git.
- `.env.example` files contain placeholders only. Never commit real database credentials, JWT secrets, private invoices, or production payment keys.
- Demo accounts and seeded records are fictional course data; do not use the demo passwords on a public deployment.

## Project layout

- `client/` — React and Vite frontend.
- `server/` — Express API, Mongoose models, OCR services, role checks, and invoice workflows.
- `scripts/` — local MongoDB startup helper.
