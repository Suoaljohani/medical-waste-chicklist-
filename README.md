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

## How a round works

1. Each department has a QR code at its entrance (admin → الحاويات والباركود → باركود القسم).
2. The employee scans it with the phone camera or the in-app scanner. The round opens with the department confirmed.
3. The round lists the department's floor containers and wall-mounted sharps containers, remaining ones first.
4. For each container: answer every item مطابق / غير مطابق. A non-compliant item needs a short note; the on-the-spot action and a photo are optional.
5. Sign and save. Unsaved answers stay on the phone as a draft until the server accepts them.
6. Admins follow up non-compliant items under الملاحظات (open → in progress → closed). Completing an inspection does not close its notes.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Staff | Scan a department or pick it from the list |
| `/d/<dept>` | Staff | The round: containers of the department and today's progress |
| `/d/<dept>/<container>` | Staff | Inspect one container → sign → saved |
| `/c/<container>` | Staff | Printed container label: confirms the department, then opens the container |
| `/admin` | Admin | Today's rounds by department, open notes, 14-day trend, latest inspections |
| `/admin/observations` | Admin | Follow up non-compliant items |
| `/admin/records` | Admin | Every inspection, with correction and delete |
| `/admin/reports` | Admin | Month report per container as PDF / Excel / Word |
| `/admin/containers` | Admin | Containers per department, inspection items per kind, QR codes and printable labels |
| `/admin/departments` | Admin | Departments |
| `/admin/checklists` | Admin | Other checklists not tied to a container |
| `/admin/staff` | Admin | Staff accounts |
| `/admin/settings` | Admin | Report header, copyright owner, admin password |

Design decisions are documented in `DESIGN.md`.

## Preview data

`DEMO_DATA=1` (local file store only) loads a clearly labelled preview data set: five made-up departments,
38 containers and two weeks of inspections. Every screen shows «بيانات توضيحية للمعاينة» while it is on. It is never
written to Supabase.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · Supabase (Postgres) ·
signature_pad · jsQR · qrcode · exceljs · docx · jsPDF + html-to-image. Font: Janna LT (bundled).

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
