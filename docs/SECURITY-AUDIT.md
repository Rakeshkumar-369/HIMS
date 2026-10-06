# CareNest HIMS — Application Security Audit Report

| | |
|---|---|
| **Application** | CareNest HIMS — Module 1 (Doctor ⇄ Nurse case flow, patient portal, platform admin) |
| **Components** | React 19 web client · Node.js / Express 5 API · MySQL 8 |
| **Audit date** | 6 October 2026 |
| **Approach** | Source-code review + hands-on testing against a production build (`NODE_ENV=production`) |
| **References** | OWASP Top 10 (2021), OWASP ASVS 4.0 (Level 2), CERT-In Directions of 28 April 2022 (logging, time sync, incident reporting) |
| **Result** | 18 findings identified (4 High, 7 Medium, 7 Low). **All 18 fixed and re-tested.** No open High/Medium issues. |

> This is an internal pre-release security review written in the format used for CERT-In style audits. Before the system goes live with real patient data, have a **formal VAPT carried out by a CERT-In empanelled auditing organisation** and obtain their certificate — see *Section 6*.

---

## 1. Scope

| In scope | Out of scope |
|---|---|
| All API routes under `/api` (auth, admin, clinics, patients, visits, dashboard, transactions, portal, live channel) | Hosting infrastructure, OS, network and TLS configuration (depends on where you deploy) |
| Web client (session handling, storage, rendering, PDF/print) | Physical security of clinic laptops |
| Database schema & seed scripts | Third-party services (none used) |
| Third-party npm dependencies | |

User roles tested: **platform admin**, **doctor (clinic owner)**, **associate doctor**, **nurse**, **patient (portal)**, **anonymous**.

## 2. Summary of findings

| ID | Severity | Finding | OWASP | Status |
|---|---|---|---|---|
| H-01 | High | Session token kept in `localStorage` — readable by any script (XSS → account takeover) | A07 | ✅ Fixed |
| H-02 | High | Session token sent in the URL for the live channel (`?token=`) — leaks into logs/history | A07 / A09 | ✅ Fixed |
| H-03 | High | No brute-force protection on staff login or patient portal login (Case ID + mobile is guessable) | A07 | ✅ Fixed |
| H-04 | High | Built-in fallback JWT signing secret if `JWT_SECRET` was not set (forgeable sessions) | A02 / A05 | ✅ Fixed |
| M-01 | Medium | Sign-out, password change and deactivation did not end existing sessions (tokens valid until expiry) | A07 | ✅ Fixed |
| M-02 | Medium | Content-Security-Policy disabled; no HSTS / Referrer-Policy | A05 | ✅ Fixed |
| M-03 | Medium | CORS reflected any origin | A05 | ✅ Fixed |
| M-04 | Medium | Weak password policy (6 characters), low bcrypt cost, staff given passwords chosen by others | A07 | ✅ Fixed |
| M-05 | Medium | No security audit trail (logins, failures, record access, admin actions) | A09 | ✅ Fixed |
| M-06 | Medium | Cookie-based sessions need CSRF protection | A01 | ✅ Fixed |
| M-07 | Medium | Open self-registration: anyone could create a doctor account and clinics | A01 / A04 | ✅ Fixed |
| L-01 | Low | Account enumeration through sign-up message and login response time | A07 | ✅ Fixed |
| L-02 | Low | Malformed IDs / over-long fields caused HTTP 500 errors | A04 / A05 | ✅ Fixed |
| L-03 | Low | `%` and `_` in search text acted as SQL `LIKE` wildcards | A03 | ✅ Fixed |
| L-04 | Low | "Display to doctor" accepted any user ID as the doctor | A01 | ✅ Fixed |
| L-05 | Low | Unsaved consultation drafts (incl. private notes) kept in `localStorage` on shared PCs | A04 | ✅ Fixed |
| L-06 | Low | API responses with medical data were cacheable by the browser/proxies | A05 | ✅ Fixed |
| L-07 | Low | 1 MB request-body limit (larger than needed) | A05 | ✅ Fixed |

## 3. Findings and fixes in detail

### H-01 · Session token in `localStorage`
**Risk:** any injected script (malicious browser extension, future XSS bug) could read the token and impersonate a doctor.
**Fix:** sessions now live in an **`httpOnly`, `SameSite=Strict` cookie** (`Secure` automatically when served over HTTPS). JavaScript can no longer read it. Files: `server/src/middleware/auth.js`, `client/src/lib/api.js`.
**Re-test:** `document.cookie` and `localStorage` contain no session token ✅.

### H-02 · Token in URL for the live channel
**Fix:** the Server-Sent Events endpoint authenticates with the same cookie; no token in any URL.

### H-03 · Brute force on sign-in
**Fix:**
- IP rate limit: 20 sign-in attempts / 15 min, 600 API calls / min (`express-rate-limit`).
- **Account lockout:** 5 wrong passwords → locked 15 minutes (staff); 5 wrong mobile numbers for a Case ID → portal locked 15 minutes.
- Admins can unlock an account from the console.
**Re-test:** 6th wrong password returns *“Account temporarily locked”* ✅.

### H-04 · Fallback signing secret
**Fix:** in production the server **refuses to start** without a random `JWT_SECRET` of ≥ 32 characters. In development it uses a temporary random secret and warns. `npm run secret` writes a strong secret into `server/.env`. Tokens are verified with an explicit `HS256` allow-list.
**Re-test:** forged token with `alg: none` and token with a tampered signature → `401` ✅.

### M-01 · Sessions not revocable
**Fix:** new **server-side `sessions` table**. A cookie is valid only while its session row exists. Sign-out deletes it; a password change, admin password reset or deactivation ends **all** sessions of that user (plus a `token_version` check).
**Re-test:** copy of a cookie taken before sign-out → `401` after sign-out ✅.

### M-02 · Security headers
**Fix (Helmet):** strict CSP (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, fonts only from Google Fonts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, HSTS in production, `X-Powered-By` removed. The inline theme script was moved to `/mode.js` so no inline script is needed.
**Re-test:** full end-to-end run of the production build under the CSP — no violations, no console errors ✅.

### M-03 · CORS
**Fix:** only origins listed in `CLIENT_ORIGIN` are allowed (with credentials). In production the app and API share one origin.

### M-04 · Passwords
**Fix:** minimum 8 characters with letters **and** numbers (admin accounts: 10+), maximum 128; bcrypt cost raised to **12**. Accounts created by the admin or by a doctor (nurses, associate doctors) get a **temporary password and must set their own at first sign-in**; the server blocks every other API until they do. A new password must differ from the current one.

### M-05 · Audit trail
**Fix:** new `audit_logs` table recording sign-ins, failed sign-ins, lockouts, password changes/resets, patient-record views (staff and portal), staff added/removed, and every admin action, with time, user and IP address. Admins see it under **Security log**. Keep at least **180 days** (CERT-In).

### M-06 · CSRF
**Fix:** `SameSite=Strict` cookies **plus** every state-changing API call must carry the header `X-Requested-With: CareNest`, which another website cannot add without passing CORS.
**Re-test:** POST without the header → `403 Request blocked` ✅.

### M-07 · Open sign-up
**Fix:** self-registration is **off by default** (`ALLOW_SELF_SIGNUP=false`). Doctor accounts are created by the platform team in the **admin console**, which also sets how many clinics each doctor may own; the limit is enforced by the server.

### L-01 · Account enumeration
**Fix:** identical *“Incorrect email or password”* message for unknown and wrong accounts, with a dummy bcrypt comparison so response times match; sign-up conflicts use a generic message.

### L-02 · Error handling
**Fix:** route IDs must be positive integers (otherwise `404`); database input errors (too long / out of range / wrong type) return a friendly `400`; malformed JSON returns `400`; internal errors never return stack traces.

### L-03 · LIKE wildcards
**Fix:** `%`, `_` and `\` in search text are escaped. All SQL already used parameterised queries; dynamic column names come only from fixed allow-lists.

### L-04 · Doctor assignment
**Fix:** a `doctor_id` sent with *Display to doctor* must belong to a doctor of that clinic.

### L-05 · Drafts on shared computers
**Fix:** drafts are kept in `sessionStorage` (cleared when the tab closes) and wiped at sign-out.

### L-06 · Caching
**Fix:** every `/api` response carries `Cache-Control: no-store`.

### L-07 · Body size
**Fix:** JSON bodies limited to 200 KB.

## 4. Tests performed (production build)

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Nurse of clinic A reads clinic B's queue / a visit of clinic B | 403 | ✅ 403 |
| 2 | Nurse opens dashboard, accounts, admin API | 403 | ✅ 403 |
| 3 | Nurse tries to complete a consultation | 403 | ✅ 403 |
| 4 | Doctor's private comment visible to nurse / on print / in portal | Never | ✅ Never |
| 5 | Doctor of another practice searches a Case ID / opens the file / queues the patient | Empty / 403 | ✅ Empty / 403 |
| 6 | Admin account calls clinical APIs | 403 | ✅ 403 |
| 7 | JWT with `alg: none`; tampered signature | 401 | ✅ 401 |
| 8 | Reuse of a cookie after sign-out | 401 | ✅ 401 |
| 9 | 6 wrong passwords in a row | Lockout | ✅ Locked 15 min |
| 10 | State-changing request without CSRF header | 403 | ✅ 403 |
| 11 | SQL injection in search (`' OR '1'='1`) and in IDs (`1 OR 1=1`) | No data / 404 | ✅ `[]` / 404 |
| 12 | 300 KB request body; 300-character name | 400 | ✅ 400 |
| 13 | Path traversal (`/..%2f..%2fserver%2f.env`), `/.env` | No file served | ✅ App page only |
| 14 | First sign-in with an admin-issued password | Forced password change | ✅ |
| 15 | Clinic beyond the admin-set limit | Refused | ✅ |
| 16 | Dependency audit (`npm audit`) for server and client | 0 vulnerabilities | ✅ 0 |
| 17 | Full UI flows under CSP (admin, doctor, nurse, portal, PDF) | No CSP violations | ✅ |

## 5. Things that were already sound
- All SQL uses parameterised queries (`mysql2`).
- Every clinic, patient and visit route checks that the user belongs to that clinic (or a sister clinic of the same doctor for shared case files).
- Passwords are hashed with bcrypt; plain passwords are never stored or logged.
- React escapes all rendered text (no `dangerouslySetInnerHTML` anywhere).

## 6. Go-live checklist (hosting & organisation)
These cannot be fixed in code — they depend on where and how you run the system.

1. **HTTPS only** — put the app behind nginx/Caddy with a TLS certificate (TLS 1.2+); set `NODE_ENV=production` and `TRUST_PROXY=1`.
2. **Formal VAPT** by a **CERT-In empanelled** auditor before real patient data is used; repeat yearly and after major changes.
3. **Clock sync** — synchronise server time with NTP (e.g. NIC/NPL time servers) as required by CERT-In.
4. **Logs** — keep `audit_logs` and server logs for **180 days** within India; do not delete the table.
5. **Incident reporting** — report cyber incidents to CERT-In **within 6 hours**; name a point of contact.
6. **Database** — use a dedicated MySQL user with rights only on `carenest_hims` (never `root`); keep MySQL bound to `127.0.0.1`.
7. **Backups** — encrypted daily backups (`mysqldump`), kept off the server, restore tested monthly.
8. **Secrets** — run `npm run secret` on every server; never commit `server/.env`.
9. **Admin accounts** — replace the demo admin: `npm run admin:create -- --email … --password …`, then deactivate demo users or run `npm run db:setup` for an empty database.
10. **Patching** — update the OS, Node.js and MySQL monthly; run `npm audit` before each release.
11. **Privacy** — under the Digital Personal Data Protection Act 2023, display a privacy notice to patients, collect consent, and define how long records are kept.
