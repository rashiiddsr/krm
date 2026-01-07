-- Schema MySQL untuk KRM MOBILINDO (XAMPP / MySQL)
-- Pastikan database sudah dibuat terlebih dahulu, misalnya: CREATE DATABASE krm_mobilindo;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  no_hp VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'sales') NOT NULL,
  profile_photo_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, email, full_name, username, no_hp, password_hash, role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@krm.com',
  'Administrator',
  'admin',
  '0812345678',
  'admin',
  'admin'
)
ON DUPLICATE KEY UPDATE email = email;

CREATE TABLE IF NOT EXISTS prospects (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  nama VARCHAR(255) NOT NULL,
  no_hp VARCHAR(50) NOT NULL,
  alamat TEXT NOT NULL,
  kebutuhan TEXT NOT NULL,
  status ENUM('menunggu_follow_up', 'dalam_follow_up', 'selesai') NOT NULL DEFAULT 'menunggu_follow_up',
  sales_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prospects_sales
    FOREIGN KEY (sales_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS follow_ups (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  prospect_id CHAR(36) NOT NULL,
  assigned_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NOT NULL,
  scheduled_date DATETIME NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'rescheduled') NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_followups_prospect
    FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_followups_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_followups_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  type ENUM('new_prospect', 'follow_up_assigned', 'follow_up_updated') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id CHAR(36) NOT NULL,
  reference_type ENUM('prospect', 'follow_up') NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_prospects_sales_id ON prospects(sales_id);
CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_follow_ups_prospect_id ON follow_ups(prospect_id);
CREATE INDEX idx_follow_ups_assigned_to ON follow_ups(assigned_to);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
