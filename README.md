# CareNest HIMS

A calm, fast clinic management system for small and busy practices. It works for a doctor alone, a doctor with one nurse, or a full team, and one doctor can run several clinics.

**Module 1:** Doctor ⇄ Nurse case flow, patient portal, practice insights and a platform admin console.

**Stack:** React 19 · Vite · Tailwind CSS v4 · Node.js · Express 5 · MySQL 8 (or MariaDB 10.6+) · Recharts

## Quick start

```bash
npm run setup                          # install server and client packages
cp server/.env.example server/.env     # then put your MySQL password in it
npm run secret                         # writes a strong random JWT_SECRET into server/.env
npm run db:reset                       # create the database, tables and demo data
npm run dev                            # API on :4000, app on http://localhost:5173
                                       # (npm run dev:lan also opens it to phones on your Wi-Fi)
```

| Demo login | Email | Password |
|---|---|---|
| Platform admin | `admin@carenest.app` | `Admin@123` |
| Doctor (owns 2 clinics) | `doctor@demo.com` | `Demo@123` |
| Nurse – Sunrise Family Clinic | `nurse@demo.com` | `Demo@123` |
| Nurse – Green Valley Health Centre | `nurse2@demo.com` | `Demo@123` |
| Patient portal | Case ID `100200300` | Mobile `9000000001` |

The demo queue is created for the day you run `db:reset`; run it again for a fresh "today".
Step-by-step instructions for Windows and macOS: **`docs/CareNest-HIMS-Local-Setup-Guide.docx`**.

## Features

**Nurse & doctor**
- **New case file**: unique 9-digit Case ID, demographics, vitals with automatic out-of-range flags and BMI, known conditions, complaints (tap chips), current medicines, note for the doctor, emergency flag.
- **Today**: live queue with tokens and **Display to doctor**, back-to-queue, cancel, edit vitals, and a "seen" list with one-tap A4 print or PDF.
- **Consult room**: the case opens on the doctor's laptop or phone the moment the nurse sends it. It covers observations, diagnosis chips, lab investigations, a prescription builder (doses auto-filled from the doctor's habits, *Repeat last Rx*), advice, next visit, fee and a **private note** that is never printed or shown to nurse or patient.
- **Visit history**: every visit on one line, grouped by year and searchable. Pick any date (or use ↑/↓) to see that whole visit. It's available on the case file and inside the consult room.
- **Shared Case ID**: a patient registered at one of a doctor's clinics can be found at the doctor's other clinics by their Case ID.
- **No-nurse mode**: the doctor can register and call patients directly.

**Doctor**
- **Clinics**: unique names, per-clinic data, team, fee and a colour theme per clinic.
- **Insights**: 1 week to 1 year, per clinic or all. Cases, age and gender, diagnoses, conditions, income vs outflow, medicines and lab tests, each with a table view.
- **Accounts**: consultation fees are counted automatically, plus quick income and expense entries.

**Patients**
- **Portal**: sign in with Case ID + mobile, browse visits, and download the full case sheet as a PDF.

**Platform admin (the CareNest team)**
- Create doctor accounts (profile, address, contact details), set how many clinics each doctor may own, and create their clinics.
- Set and reset passwords (users must change them at first sign-in), unlock, deactivate or re-activate accounts.
- Security log of sign-ins, failed attempts, record access and admin actions.

**Everyone:** light and dark mode, pastel themes, keyboard shortcuts (`N`, `T`, `Ctrl K`).

**Phones & tablets**
- Bottom menu with **Today · Patients · ＋ New case · Consult · More**. The **More** sheet reaches every other screen, appearance and sign-out.
- Consult room splits into **Patient & history** and **Consultation** tabs, with a sticky "Complete" bar.
- Sticky "Register" button on the New case form. Visit history opens full-width with ← All visits and next/previous.
- Thumb-sized buttons, and no zoom-in when typing on iPhone.
- The admin console has its own bottom menu.
- **Install as an app** (PWA): open the site on the phone, then More → *Install the app* (Android / Chrome / Edge) or Safari → Share → *Add to Home Screen* (iPhone). It opens full-screen with its own icon. The app shell loads even with a weak connection, and patient data is never stored on the device.

## Security

Sessions use httpOnly, SameSite=Strict cookies backed by a server-side session table. Other protections:

- login rate limits and account lockout
- strict Content-Security-Policy and security headers
- CSRF header check
- bcrypt-hashed passwords with a password policy
- role-based access checks on every route
- audit log

See **`docs/SECURITY-AUDIT.md`** for the full audit report and the go-live checklist.

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | Install all packages |
| `npm run dev` / `npm run dev:lan` | Start API + web app for development |
| `npm run secret` | Generate a strong `JWT_SECRET` in `server/.env` |
| `npm run db:setup` | Create the database with empty tables |
| `npm run db:reset` | Recreate the tables with demo data (erases data!) |
| `npm run admin:create -- --email you@x.com --name "You" --password "Str0ngPassword1"` | Create or reset a platform admin |
| `npm run lint` | Lint server and client |
| `npm run build` then `npm start` | Production build served on http://localhost:4000 |

## Project layout

```
server/   Express API: src/routes, src/middleware, src/lib; db/schema.sql, db/seed.js; scripts/
client/   React app: src/pages (incl. admin/ and portal/), src/components, src/lib
docs/     Setup guide (.docx) and security audit report
```
