# Medical Waste Checklist · Alhadithah General Hospital

Digital daily checklists for medical waste management. Staff open the page, pick a checklist,
tick the items or enter readings (date, day and time are recorded automatically), sign with a
finger and submit. Admins get a live dashboard, can manage everything, and export a month as
**PDF (same layout as the paper form)**, **Excel** or **Word**.

## Checklists included

| Checklist | Layout |
| --- | --- |
| Daily Medical Waste Segregation Audit | items down the side, entries across |
| Sharps Container Check | one row per entry |
| Temporary Waste Storage Area Daily Inspection | items down the side, entries across |
| Daily Waste Collection & Weighing Log | one row per entry |
| Waste Handover to Licensed Contractor | one row per entry |
| Spill Kit & PPE Check | items down the side, entries across |
| Waste Handler Safety Compliance | one row per entry |

Admins can edit these, add more from the built-in templates (ward segregation audit, trolley
cleaning log, autoclave cycle log, …) or create new ones from scratch.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Staff | Choose a department |
| `/d/waste` | Staff | Enter name once, pick a checklist |
| `/d/waste/<checklist>` | Staff | Fill in → sign → “Successfully checked” |
| `/c/<checklist-id>` | Staff | QR code shortcut straight to a checklist |
| `/admin` | Admin | Live dashboard (updates every 5 s) |
| `/admin/records` | Admin | View, correct or delete submissions |
| `/admin/reports` | Admin | Preview and export PDF / Excel / Word |
| `/admin/checklists` | Admin | Add, edit, reorder, hide, delete checklists, fields, lock codes and QR codes |
| `/admin/departments` | Admin | Add, edit, hide, delete departments |
| `/admin/staff` | Admin | Staff accounts (optional sign-in with employee number) |
| `/admin/settings` | Admin | Report header lines, copyright name, admin password |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · Supabase (Postgres) ·
signature_pad · exceljs · docx · jsPDF + html-to-image.

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Admin sign-in password (can later be changed from Settings) |
| `SESSION_SECRET` | yes | Any long random string, used to sign the admin cookie |
| `SUPABASE_URL` | for production | Project URL from Supabase → Project Settings → API |
| `SUPABASE_KEY` | for production | Publishable (anon) key, used only on the server |
| `CHK_DB_SECRET` | for production | Random secret; its SHA-256 is stored in `private.app_config` (see `supabase/migrations/0001_init.sql`) |

Without the Supabase variables the app runs on a local JSON file (`.data/db.json`), which is
fine for development but **does not persist on Vercel**.

## Set up Supabase

1. Create a project at supabase.com.
2. In **SQL Editor** run `supabase/migrations/0001_init.sql` (tables, server-only API, starter checklists).
3. If you use a different `CHK_DB_SECRET`, change the hash near the end of that file
   (`printf '%s' "$CHK_DB_SECRET" | sha256sum`).
4. Set `SUPABASE_URL`, `SUPABASE_KEY` and `CHK_DB_SECRET`. The tables are closed to the public key;
   the app reaches them only through the secret-checked functions.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

## Deploy to Vercel

Import the repository in Vercel, add the environment variables above, deploy.
