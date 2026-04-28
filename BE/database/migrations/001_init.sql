CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(100) NOT NULL,
  employee_no VARCHAR(50),
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  part_code VARCHAR(50),
  group_code VARCHAR(50),
  team VARCHAR(100),
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_users_employee_id (employee_id),
  KEY idx_users_part_code (part_code)
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_role (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  compressed_size BIGINT NULL,
  file_hash VARCHAR(128) NOT NULL,
  file_type ENUM('CERTIFICATE_PDF', 'PAPER_EXAM_SCAN', 'CERTIFICATE_TEMPLATE', 'OTHER') NOT NULL,
  storage_type ENUM('LOCAL', 'NAS', 'MINIO', 'S3') NOT NULL DEFAULT 'LOCAL',
  status ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
  uploaded_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_file_hash (file_hash),
  CONSTRAINT fk_files_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exams (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  part_code VARCHAR(50) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  pass_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  max_attempts INT NULL,
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_exams_part_status (part_code, status),
  CONSTRAINT fk_exams_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  type ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE') NOT NULL DEFAULT 'SINGLE_CHOICE',
  content TEXT NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  order_no INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_questions_exam_order (exam_id, order_no),
  CONSTRAINT fk_questions_exam FOREIGN KEY (exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  question_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  order_no INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_question_options_question_order (question_id, order_no),
  CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  employee_id VARCHAR(100) NOT NULL,
  employee_no VARCHAR(50),
  attempt_type ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
  status ENUM('PASSED', 'OFFLINE_UPLOADED', 'CANCELLED') NOT NULL DEFAULT 'PASSED',
  total_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  is_passed BOOLEAN NOT NULL DEFAULT TRUE,
  started_at DATETIME NULL,
  submitted_at DATETIME NULL,
  paper_exam_file_id BIGINT NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exam_attempts_exam_user (exam_id, user_id),
  KEY idx_exam_attempts_employee (employee_id),
  CONSTRAINT fk_exam_attempts_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
  CONSTRAINT fk_exam_attempts_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_exam_attempts_paper_file FOREIGN KEY (paper_exam_file_id) REFERENCES files(id),
  CONSTRAINT fk_exam_attempts_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  answer_text TEXT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT TRUE,
  score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attempt_answers_attempt (attempt_id),
  CONSTRAINT fk_attempt_answers_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id),
  CONSTRAINT fk_attempt_answers_question FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS attempt_answer_options (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  attempt_answer_id BIGINT NOT NULL,
  option_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt_answer_option (attempt_answer_id, option_id),
  CONSTRAINT fk_attempt_answer_options_answer FOREIGN KEY (attempt_answer_id) REFERENCES attempt_answers(id),
  CONSTRAINT fk_attempt_answer_options_option FOREIGN KEY (option_id) REFERENCES question_options(id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  validity_months INT NULL,
  template_file_id BIGINT NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_certificates_template_file FOREIGN KEY (template_file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS exam_certificates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  certificate_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_certificate (exam_id, certificate_id),
  CONSTRAINT fk_exam_certificates_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
  CONSTRAINT fk_exam_certificates_certificate FOREIGN KEY (certificate_id) REFERENCES certificates(id)
);

CREATE TABLE IF NOT EXISTS employee_certificates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(100) NOT NULL,
  employee_no VARCHAR(50),
  user_id BIGINT NOT NULL,
  certificate_id BIGINT NOT NULL,
  exam_id BIGINT NOT NULL,
  attempt_id BIGINT NULL,
  certificate_no VARCHAR(100) NOT NULL UNIQUE,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expired_at DATETIME NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  certificate_file_id BIGINT NULL,
  issued_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_employee_certificates_employee (employee_id),
  CONSTRAINT fk_employee_certificates_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_employee_certificates_certificate FOREIGN KEY (certificate_id) REFERENCES certificates(id),
  CONSTRAINT fk_employee_certificates_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
  CONSTRAINT fk_employee_certificates_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id),
  CONSTRAINT fk_employee_certificates_file FOREIGN KEY (certificate_file_id) REFERENCES files(id),
  CONSTRAINT fk_employee_certificates_issued_by FOREIGN KEY (issued_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exam_fail_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  exam_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  employee_id VARCHAR(100) NOT NULL,
  employee_no VARCHAR(50),
  total_score DECIMAL(5,2) NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exam_fail_logs_exam_user (exam_id, user_id),
  CONSTRAINT fk_exam_fail_logs_exam FOREIGN KEY (exam_id) REFERENCES exams(id),
  CONSTRAINT fk_exam_fail_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
);
