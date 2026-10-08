-- =====================================================================
--  CareNest HIMS — Module 1: Doctor ⇄ Nurse Case Flow
--  Compatible with MySQL 8.0+ and MariaDB 10.6+
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS clinic_ledger;
DROP TABLE IF EXISTS practice_expenses;
DROP TABLE IF EXISTS freelance_payments;
DROP TABLE IF EXISTS freelance_services;
DROP TABLE IF EXISTS workplaces;
DROP TABLE IF EXISTS vendor_payments;
DROP TABLE IF EXISTS vendor_delivery_items;
DROP TABLE IF EXISTS vendor_deliveries;
DROP TABLE IF EXISTS vendor_order_items;
DROP TABLE IF EXISTS vendor_orders;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS visit_lab_tests;
DROP TABLE IF EXISTS visits;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS clinic_members;
DROP TABLE IF EXISTS clinics;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Accounts: platform admins (the software team), doctors and nurses.
-- Patients log in separately with Case ID + mobile.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role               ENUM('admin','doctor','nurse') NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  email              VARCHAR(160) NOT NULL UNIQUE,
  phone              VARCHAR(20),
  address            VARCHAR(255),
  city               VARCHAR(80),
  password_hash      VARCHAR(100) NOT NULL,
  qualification      VARCHAR(160),          -- e.g. "MBBS, MD (General Medicine)"
  registration_no    VARCHAR(60),           -- medical council reg. no. (printed on sheet)
  specialization     VARCHAR(120),
  max_clinics        TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- clinics a doctor may own (set by admin)
  practice_type      ENUM('clinic','freelance','both') NOT NULL DEFAULT 'clinic', -- clinic owner, visiting doctor, or both
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  token_version      INT UNSIGNED NOT NULL DEFAULT 0,       -- bump to sign the user out everywhere
  failed_logins      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until       DATETIME NULL,
  last_login_at      DATETIME NULL,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Clinics. One doctor can own many clinics; each clinic has its own
-- theme, print header, fee and data.
-- ---------------------------------------------------------------------
CREATE TABLE clinics (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id          INT UNSIGNED NOT NULL,
  name              VARCHAR(120) NOT NULL UNIQUE,
  code              VARCHAR(12)  NOT NULL UNIQUE,      -- short code, e.g. "SUN"
  tagline           VARCHAR(160),
  address           VARCHAR(255),
  city              VARCHAR(80),
  phone             VARCHAR(20),
  email             VARCHAR(160),
  registration_no   VARCHAR(60),                       -- clinic / establishment reg.
  timings           VARCHAR(160),
  consultation_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,
  theme             VARCHAR(24) NOT NULL DEFAULT 'mint',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinic_owner FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clinic_members (
  clinic_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (clinic_id, user_id),
  CONSTRAINT fk_cm_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Patient case file. case_no is the unique 9-digit ID.
-- ---------------------------------------------------------------------
CREATE TABLE patients (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_no            CHAR(9) NOT NULL UNIQUE,
  clinic_id          INT UNSIGNED NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  gender             ENUM('Male','Female','Other') NOT NULL,
  dob                DATE NULL,
  age_years          TINYINT UNSIGNED NULL,           -- when DOB is unknown
  phone              VARCHAR(20),
  address            VARCHAR(255),
  blood_group        VARCHAR(5),
  guardian_name      VARCHAR(120),                    -- relative / emergency contact
  emergency_phone    VARCHAR(20),
  occupation         VARCHAR(80),
  known_conditions   TEXT,                            -- JSON array: ["Hypertension","Diabetes"]
  allergies          VARCHAR(255),
  habits             VARCHAR(255),                    -- smoking / alcohol etc.
  portal_failed      TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- patient-portal lockout
  portal_locked_until DATETIME NULL,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pat_clinic (clinic_id),
  INDEX idx_pat_phone (phone),
  INDEX idx_pat_name (full_name),
  CONSTRAINT fk_pat_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- A visit = one entry in the day's queue + the doctor's consultation.
-- ---------------------------------------------------------------------
CREATE TABLE visits (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id          INT UNSIGNED NOT NULL,
  clinic_id           INT UNSIGNED NOT NULL,
  visit_date          DATE NOT NULL,
  token_no            SMALLINT UNSIGNED NOT NULL,
  status              ENUM('waiting','with_doctor','completed','cancelled') NOT NULL DEFAULT 'waiting',
  visit_type          ENUM('new','follow_up','emergency') NOT NULL DEFAULT 'new',
  priority            TINYINT(1) NOT NULL DEFAULT 0,

  -- Vitals (nurse)
  bp_systolic         SMALLINT UNSIGNED,
  bp_diastolic        SMALLINT UNSIGNED,
  pulse               SMALLINT UNSIGNED,
  temperature         DECIMAL(4,1),        -- °F
  spo2                TINYINT UNSIGNED,
  weight_kg           DECIMAL(5,1),
  height_cm           DECIMAL(5,1),
  blood_sugar         SMALLINT UNSIGNED,   -- random blood sugar mg/dL
  resp_rate           TINYINT UNSIGNED,

  complaints          TEXT,
  complaint_duration  VARCHAR(60),
  current_medicines   TEXT,
  nurse_notes         TEXT,

  -- Consultation (doctor)
  doctor_id           INT UNSIGNED NULL,
  observations        TEXT,
  diagnosis           VARCHAR(255),
  lab_other           VARCHAR(255),
  advice              TEXT,                -- diet / lifestyle advice (printed)
  doctor_comment      TEXT,                -- PRIVATE: never printed / never shown to patient
  next_visit_label    VARCHAR(20),
  next_visit_date     DATE NULL,

  -- Billing
  fee                 DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_mode        ENUM('Cash','UPI','Card','Free') NOT NULL DEFAULT 'Cash',

  created_by          INT UNSIGNED NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  called_at           DATETIME NULL,
  completed_at        DATETIME NULL,

  INDEX idx_visit_day (clinic_id, visit_date, status),
  INDEX idx_visit_patient (patient_id),
  CONSTRAINT fk_visit_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_clinic  FOREIGN KEY (clinic_id)  REFERENCES clinics(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE visit_lab_tests (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id   INT UNSIGNED NOT NULL,
  test_name  VARCHAR(80) NOT NULL,
  INDEX idx_lab_visit (visit_id),
  CONSTRAINT fk_lab_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE prescriptions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id    INT UNSIGNED NOT NULL,
  medicine    VARCHAR(120) NOT NULL,
  dosage      VARCHAR(40),       -- 1-0-1
  timing      VARCHAR(40),       -- After food
  duration    VARCHAR(40),       -- 5 days
  instructions VARCHAR(160),
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_rx_visit (visit_id),
  INDEX idx_rx_med (medicine),
  CONSTRAINT fk_rx_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Clinic ledger: manual income (other than consultation) & outflow.
-- Consultation income is derived from visits.fee.
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinic_id   INT UNSIGNED NOT NULL,
  txn_date    DATE NOT NULL,
  kind        ENUM('income','expense') NOT NULL,
  category    VARCHAR(60) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  note        VARCHAR(255),
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_txn (clinic_id, txn_date),
  CONSTRAINT fk_txn_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Server-side sessions: a signed cookie is only valid while its row exists,
-- so signing out, password changes and deactivation end sessions at once.
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id          CHAR(43) PRIMARY KEY,
  kind        ENUM('staff','patient') NOT NULL,
  subject_id  INT UNSIGNED NOT NULL,
  ip          VARCHAR(64),
  user_agent  VARCHAR(255),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  INDEX idx_sess_subject (kind, subject_id),
  INDEX idx_sess_exp (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Security audit trail (logins, admin actions, record access).
-- Keep at least 180 days.
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_type  ENUM('admin','doctor','nurse','patient','anonymous') NOT NULL,
  actor_id    INT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(40),
  entity_id   VARCHAR(40),
  ip          VARCHAR(64),
  detail      VARCHAR(255),
  INDEX idx_audit_at (at),
  INDEX idx_audit_actor (actor_type, actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  Vendors & purchases
--  A vendor book belongs either to a clinic (clinic_id) or to a
--  freelance doctor's own practice (doctor_id) — exactly one is set.
-- =====================================================================
CREATE TABLE vendors (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinic_id          INT UNSIGNED NULL,
  doctor_id          INT UNSIGNED NULL,
  name               VARCHAR(120) NOT NULL,
  category           VARCHAR(60) NOT NULL,           -- shown as the expense category in Accounts
  contact_person     VARCHAR(120),
  phone              VARCHAR(20),
  email              VARCHAR(160),
  address            VARCHAR(255),
  city               VARCHAR(80),
  gstin              VARCHAR(20),
  payment_terms_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- bill is due this many days after delivery
  notes              VARCHAR(255),
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendor_clinic (clinic_id),
  INDEX idx_vendor_doctor (doctor_id),
  CONSTRAINT fk_vendor_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_vendor_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_orders (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id    INT UNSIGNED NOT NULL,
  order_no     VARCHAR(30) NOT NULL,
  ordered_at   DATETIME NOT NULL,
  expected_on  DATE NULL,
  status       ENUM('ordered','partial','delivered','cancelled') NOT NULL DEFAULT 'ordered',
  notes        VARCHAR(255),
  created_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vo_vendor (vendor_id, ordered_at),
  CONSTRAINT fk_vo_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_order_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED NOT NULL,
  item          VARCHAR(120) NOT NULL,
  qty           DECIMAL(10,2) NOT NULL,
  unit          VARCHAR(20),
  rate          DECIMAL(12,2) NOT NULL DEFAULT 0,      -- per unit, before GST
  gst_pct       DECIMAL(5,2) NOT NULL DEFAULT 0,
  received_qty  DECIMAL(10,2) NOT NULL DEFAULT 0,
  INDEX idx_voi_order (order_id),
  CONSTRAINT fk_voi_order FOREIGN KEY (order_id) REFERENCES vendor_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_deliveries (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED NOT NULL,
  delivered_at  DATETIME NOT NULL,
  invoice_no    VARCHAR(40),
  amount        DECIMAL(12,2) NOT NULL,               -- bill value of what arrived (incl. GST)
  notes         VARCHAR(255),
  created_by    INT UNSIGNED NULL,
  INDEX idx_vd_order (order_id),
  CONSTRAINT fk_vd_order FOREIGN KEY (order_id) REFERENCES vendor_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_delivery_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_id   INT UNSIGNED NOT NULL,
  order_item_id INT UNSIGNED NOT NULL,
  qty           DECIMAL(10,2) NOT NULL,
  batch_no      VARCHAR(40),
  expiry_date   DATE NULL,
  CONSTRAINT fk_vdi_delivery FOREIGN KEY (delivery_id) REFERENCES vendor_deliveries(id) ON DELETE CASCADE,
  CONSTRAINT fk_vdi_item FOREIGN KEY (order_item_id) REFERENCES vendor_order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vendor_payments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id   INT UNSIGNED NOT NULL,
  paid_on     DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  mode        ENUM('Cash','UPI','Bank','Cheque','Card') NOT NULL DEFAULT 'UPI',
  reference   VARCHAR(60),
  notes       VARCHAR(255),
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vp_vendor (vendor_id, paid_on),
  CONSTRAINT fk_vp_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Everything that counts as clinic income/expense, in one place:
-- manual entries + vendor payments (expenses are counted when paid).
CREATE VIEW clinic_ledger AS
  SELECT t.id, t.clinic_id, t.txn_date, t.kind, t.category, t.amount, t.note, 'manual' COLLATE utf8mb4_unicode_ci AS source, NULL AS vendor_id
    FROM transactions t
  UNION ALL
  SELECT p.id, v.clinic_id, p.paid_on, 'expense' COLLATE utf8mb4_unicode_ci, v.category, p.amount,
         CONCAT(v.name, IF(p.reference IS NULL OR p.reference = '', '', CONCAT(' · ', p.reference))) COLLATE utf8mb4_unicode_ci,
         'vendor' COLLATE utf8mb4_unicode_ci, v.id
    FROM vendor_payments p JOIN vendors v ON v.id = p.vendor_id
   WHERE v.clinic_id IS NOT NULL;

-- =====================================================================
--  Freelance / visiting doctor practice
-- =====================================================================
CREATE TABLE workplaces (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id       INT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  kind            VARCHAR(40) NOT NULL DEFAULT 'Hospital',   -- Hospital, Clinic, Nursing home, Camp, Home visit, Teleconsult
  city            VARCHAR(80),
  address         VARCHAR(255),
  contact_person  VARCHAR(120),
  phone           VARCHAR(20),
  pay_model       VARCHAR(30) NOT NULL DEFAULT 'per_case',   -- per_case, per_procedure, per_visit, retainer, share
  default_fee     DECIMAL(12,2) NOT NULL DEFAULT 0,
  share_pct       DECIMAL(5,2) NULL,
  tds_pct         DECIMAL(5,2) NOT NULL DEFAULT 0,
  credit_days     SMALLINT UNSIGNED NOT NULL DEFAULT 30,      -- usual time they take to pay
  theme           VARCHAR(24) NOT NULL DEFAULT 'sky',
  notes           VARCHAR(255),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wp_doctor (doctor_id),
  CONSTRAINT fk_wp_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE freelance_services (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id          INT UNSIGNED NOT NULL,
  workplace_id       INT UNSIGNED NOT NULL,
  service_at         DATETIME NOT NULL,
  service_type       VARCHAR(40) NOT NULL,          -- Consultation, Procedure, Surgery, On-call, Ward round, Teleconsult
  procedure_name     VARCHAR(160),
  patient_name       VARCHAR(120),
  patient_age        TINYINT UNSIGNED NULL,
  patient_gender     ENUM('Male','Female','Other') NULL,
  patient_phone      VARCHAR(20),
  hospital_ref       VARCHAR(40),                   -- the hospital's own IP/OP/UHID number
  amount_billed      DECIMAL(12,2) NOT NULL DEFAULT 0,   -- "cost mentioned"
  written_off        DECIMAL(12,2) NOT NULL DEFAULT 0,   -- amount the doctor gave up on
  expected_on        DATE NULL,
  notes              VARCHAR(255),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fs_doctor (doctor_id, service_at),
  INDEX idx_fs_wp (workplace_id, service_at),
  CONSTRAINT fk_fs_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fs_wp FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Money received from a workplace ("cost realised"). It settles that workplace's
-- pending services oldest first. tds_amount = tax the hospital deducted at source.
CREATE TABLE freelance_payments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id     INT UNSIGNED NOT NULL,
  workplace_id  INT UNSIGNED NOT NULL,
  received_on   DATE NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,             -- money actually received
  tds_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  mode          ENUM('Cash','UPI','Bank','Cheque','Card') NOT NULL DEFAULT 'Bank',
  reference     VARCHAR(60),
  notes         VARCHAR(255),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fp_doctor (doctor_id, received_on),
  INDEX idx_fp_wp (workplace_id, received_on),
  CONSTRAINT fk_fp_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fp_wp FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The freelance doctor's own running costs (travel, insurance, CME…)
CREATE TABLE practice_expenses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id     INT UNSIGNED NOT NULL,
  spent_on      DATE NOT NULL,
  category      VARCHAR(60) NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  workplace_id  INT UNSIGNED NULL,
  note          VARCHAR(255),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pe_doctor (doctor_id, spent_on),
  CONSTRAINT fk_pe_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pe_wp FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
