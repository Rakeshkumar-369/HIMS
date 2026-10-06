-- =====================================================================
--  CareNest HIMS — Module 1: Doctor ⇄ Nurse Case Flow
--  Compatible with MySQL 8.0+ and MariaDB 10.6+
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

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
-- Staff accounts (doctors & nurses). Patients log in separately.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role            ENUM('doctor','nurse') NOT NULL,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  phone           VARCHAR(20),
  password_hash   VARCHAR(100) NOT NULL,
  qualification   VARCHAR(160),          -- e.g. "MBBS, MD (General Medicine)"
  registration_no VARCHAR(60),           -- medical council reg. no. (printed on sheet)
  specialization  VARCHAR(120),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT UNSIGNED NULL,     -- doctor who created a nurse account
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE clinic_members (
  clinic_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (clinic_id, user_id),
  CONSTRAINT fk_cm_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  created_by         INT UNSIGNED NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pat_clinic (clinic_id),
  INDEX idx_pat_phone (phone),
  INDEX idx_pat_name (full_name),
  CONSTRAINT fk_pat_clinic FOREIGN KEY (clinic_id) REFERENCES clinics(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE visit_lab_tests (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_id   INT UNSIGNED NOT NULL,
  test_name  VARCHAR(80) NOT NULL,
  INDEX idx_lab_visit (visit_id),
  CONSTRAINT fk_lab_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
