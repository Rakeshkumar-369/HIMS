# CareNest HIMS — Module 1: Doctor ⇄ Nurse case flow

A calm, fast clinic system for small and "unorganised" practices — works with one doctor alone, a doctor + nurse, or a team, and lets one doctor run several clinics.

**Stack:** React 19 + Vite + Tailwind CSS v4 · Node.js + Express 5 · MySQL 8 (or MariaDB 10.6+) · Recharts

## Quick start

```bash
npm run setup                     # install server and client packages
cp server/.env.example server/.env   # then put your MySQL password in it
npm run db:reset                  # create database, tables and demo data
npm run dev                       # API on :4000, app on http://localhost:5173
                                  # (npm run dev:lan also opens it to phones on your Wi-Fi)
```

| Demo login | |
|---|---|
| Doctor | `doctor@demo.com` / `demo123` (owns 2 clinics) |
| Nurse (Sunrise) | `nurse@demo.com` / `demo123` |
| Nurse (Green Valley) | `nurse2@demo.com` / `demo123` |
| Patient portal | Case ID `100200300` + mobile `9000000001` |

The demo queue is created for the day you run `db:reset`; run it again to get a fresh "today".

Full step-by-step instructions for Windows/macOS are in **`docs/CareNest-HIMS-Local-Setup-Guide.docx`**.

## What's in Module 1

- **New case file** — unique 9-digit case ID, demographics, vitals (with automatic out-of-range flags and BMI), known conditions, complaints (tap chips), current medicines, note for doctor, emergency flag.
- **Today (day view)** — live queue with tokens, *Display to doctor*, back-to-queue, cancel, vitals edit, completed list with one-tap A4 print. Returning patients: `Ctrl K` → *Add to today's queue*.
- **Consult room** — the case appears on the doctor's laptop/phone the moment the nurse sends it (Server-Sent Events). Observations, diagnosis (frequent-diagnosis chips), lab investigation chips, prescription builder with auto-filled dose from the doctor's history, *Repeat last Rx*, advice chips, next visit (1 week / 15 days / 1 month / 3 months / SOS / date), fee & payment mode, **private comment** (never printed or shown to nurse/patient). Drafts auto-save.
- **No-nurse mode** — the doctor can register and *Call in* patients directly.
- **A4 case sheet** — clinic letterhead, doctor details, demographics, vitals, complaints, known conditions, observations, diagnosis, ℞ table, investigations, advice, next visit. Full multi-visit record too.
- **Clinic mapping** — unique clinic names, per-clinic data, team (nurses/doctors), fee, and a colour theme per clinic (8 pastel themes, one click).
- **Insights dashboard** — 1 week / 10 days / 1 month / 6 months / 1 year, per clinic or all: cases, age & gender, diagnoses, known conditions, income vs outflow, expense categories, medicines and lab investigations. Every chart has a table view.
- **Accounts** — consultation fees counted automatically + quick income/expense entries.
- **Patient portal** — Case ID + mobile login, view history and download the complete case sheet as a PDF.
- **Shared case IDs** — a patient registered at one of a doctor's clinics is found at the doctor's other clinics by their 9-digit Case ID, with full history.
- **Download PDF** — every A4 sheet can be saved as a real PDF file (laptop and phone), besides printing.
- **Dark mode** — Light / Dark / Same-as-device, one tap from the top bar; print sheets and PDFs always stay white.

## Project layout

```
server/   Express API (src/routes/*), schema + seed (db/)
client/   React app (src/pages/*, src/components/*)
docs/     Local setup guide (.docx)
```

## Production build

```bash
npm run build && npm start   # serves the built app + API on http://localhost:4000
```
