# Accounts Payable Invoice Management

A full-stack course project for tracking supplier invoices. It extracts details from uploaded documents, compares invoices with optional purchase orders, routes invoices for manager review, and records approval history. Payment recording updates the invoice status and history; it does not move money.

## What it includes

- Clerk, manager, and admin sign-in with role-based access.
- Invoice upload and OCR for PDF, JPG, and PNG documents.
- Vendor directory and purchase-order matching.
- Manager approval queue, approve/reject comments, correction and resubmission, and status history.
- On-hold status with a reason; managers/admins can pause eligible invoices and release them back to their previous step.
- Clerk payment page for manager-approved invoices. A clerk can record payment in the invoice workflow; no payment provider, card details, or money transfer is involved.
- Manager/admin invoice CSV export with date and status filters, including approval, exception, and payment details.
- Synthetic demo users, vendors, purchase orders, and invoices.

The vendor names and records created by the seed script are sample data. During invoice intake, staff type a vendor name to search matching vendors; if there is no match, a clerk can add that company by name on the spot. Contact details can be added later. Managers and admins can also add vendors from **Vendors**. Purchase orders remain optional and are shown only after selecting a vendor.

## Run on Windows

Requirements: Node.js 20 or newer and MongoDB Community Server. The developer machine may also have the project-local MongoDB files under `.local-mongodb`; that ignored folder is not included in a GitHub clone. The startup script uses the local copy when present, uses `mongod.exe` from `PATH` when available, or connects to a MongoDB service already listening on port 27017.

1. Install dependencies: `npm run install:all`.
2. Copy `server/.env.example` to `server/.env` and set a private `JWT_SECRET`. The default database URI is local MongoDB.
3. Make sure MongoDB is running locally (or `mongod.exe` is available on `PATH`).
4. Start the database launcher, API, and frontend: `npm run dev`.
5. Open the Vite address shown in the terminal. It is usually `http://localhost:5173`; if that port is busy Vite prints another one.
6. If you need to create the demo records on a fresh database, open a second terminal and run `npm --prefix server run seed`.

The database records and uploaded documents are stored in MongoDB. Invoice uploads are placed in GridFS, so links keep working after the API restarts. The database files are stored in `.local-mongodb/data/` when the project-local server is used. In MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open `ap-system`.

## Payment record

The Payments page is available to Clerks and Admins. After a manager approves an invoice, an authorized user can choose **Record payment** and confirm. The system marks the invoice paid and records who performed the action in the invoice history. It does not contact a bank, collect financial details, or move money. No payment gateway credentials are required.

## Invoice CSV export

Managers and Admins can open **CSV report** and download the complete invoice register, optionally filtered by status and invoice date. The file includes invoice totals, vendors, purchase orders, line items, discrepancies, workflow notes, comments, approval data, payment activity, and timestamps. It opens in spreadsheet software.

## Local demo sign-in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@apSystem.com` | `Admin@123` |
| Manager | `manager@apSystem.com` | `Manager@123` |
| Clerk | `clerk@apSystem.com` | `Clerk@123` |

These passwords are only for a local demo database. For deployment, seed a fresh Atlas database with private passwords using the `DEMO_ADMIN_PASSWORD`, `DEMO_MANAGER_PASSWORD`, and `DEMO_CLERK_PASSWORD` environment variables as described below. There is no public sign-up; admins create staff accounts from **Team members**.

## Current limits

OCR can misread amounts, dates, vendors, and scanned layouts; a person must verify the extracted fields. Scanned PDFs are processed from the first page. Recording a payment updates the invoice workflow and history; it does not contact a bank or move funds. This project is intended for a course demonstration, not production accounts payable processing.

## Deploy on Vercel

The repository is split into a React frontend and an Express API. In Vercel, create two projects from this repository:

1. **Create a MongoDB Atlas cluster.** Make a database user and copy the application's connection string. Replace its placeholder password and add a database name such as `ap-system-demo`. In Atlas Network Access, allow the API host to connect. Vercel Functions do not have a fixed outbound IP on every plan; if Atlas requires a broad allow-list entry to make the class demo connect, understand that it permits connections from any IP and use a dedicated demo database with no private information.
2. **API project:** import this same GitHub repository as a Vercel project and set Root Directory to `server`. Vercel recognizes the Express app. Set `NODE_ENV=production`, `MONGO_URI` to the Atlas connection string, `JWT_SECRET` to a long random private value, and `CLIENT_URL` to the deployed frontend's exact origin (for example `https://your-app.vercel.app`). No email or payment-provider keys are required.
3. **Frontend project:** import the repository again as a separate Vercel project and set Root Directory to `client`. Add `VITE_API_BASE_URL` with the API deployment URL plus `/api`, for example `https://your-api.vercel.app/api`. Deploy the API first so its URL is available.
4. **Seed the remote demo database (optional).** Use a fresh Atlas database. In PowerShell, set the Atlas URI and three private passwords for the seed process, then run the seed script:

   ```powershell
   $env:MONGO_URI = 'your Atlas connection string for ap-system-demo'
   $env:NODE_ENV = 'production'
   $env:DEMO_ADMIN_PASSWORD = 'a unique private password'
   $env:DEMO_MANAGER_PASSWORD = 'a different unique private password'
   $env:DEMO_CLERK_PASSWORD = 'another unique private password'
   npm --prefix server run seed
   ```

   Use your real Atlas URI and strong passwords in your terminal; do not paste secrets into source files or commit `.env`. The seed script adds fictional users, vendors, purchase orders, and invoices. Production-mode seeding refuses to run if those passwords are missing. Do not run it against a database containing records you need to preserve. After seeding, remove the temporary PowerShell variables and set local `MONGO_URI` back to localhost for local work.
5. Sign in with the addresses shown in the local-demo table and the private passwords you set for seeding. Use only fictional invoices and vendor details in a public demo.

Atlas is the persistent database for a deployed version. Invoice records and uploaded invoice PDFs/images are stored in MongoDB; documents use GridFS, so they survive function restarts and deployments. Vercel's local filesystem is temporary and is used only while processing an upload. The app limits Vercel uploads to 4 MB because Vercel Function request bodies are limited to 4.5 MB. You can inspect deployed records in MongoDB Compass by connecting it to the same Atlas URI, or in the Atlas Data Explorer. Local MongoDB data does not automatically appear in Atlas: seed fresh fictional demo data, or deliberately migrate records and files you actually want to keep.

## GitHub hygiene

- `.env` files, local uploaded documents, MongoDB data, logs, dependencies, and build output are ignored by Git.
- `.env.example` files contain placeholders only. Never commit real database credentials, JWT secrets, private invoices, or production payment keys.
- Demo accounts and seeded records are fictional course data; never use the local demo passwords in a shared deployment.

## Project layout

- `client/` — React and Vite frontend.
- `server/` — Express API, Mongoose models, OCR services, role checks, and invoice workflows.
- `scripts/` — local MongoDB startup helper.
