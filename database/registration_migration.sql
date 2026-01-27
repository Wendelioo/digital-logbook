-- ============================================================================
-- STUDENT REGISTRATION SYSTEM MIGRATION
-- ============================================================================
-- This migration adds support for student self-registration with working student approval

USE logbookdb;

-- Step 1: Add account_status column to users table
ALTER TABLE users 
ADD COLUMN account_status ENUM('pending', 'active', 'suspended', 'rejected') 
DEFAULT 'active' 
COMMENT 'Account approval status for registration workflow'
AFTER user_type;

-- Step 2: Create registration_approvals table for tracking approvals/rejections
CREATE TABLE IF NOT EXISTS registration_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'Foreign key to users.id - the student being approved/rejected',
    approved_by_user_id INT NULL COMMENT 'Foreign key to users.id - working student or admin who processed the request',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Approval status',
    rejection_reason TEXT NULL COMMENT 'Reason for rejection (if applicable)',
    processed_at TIMESTAMP NULL COMMENT 'When the approval/rejection occurred',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_approved_by (approved_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT 'Tracks student registration approval workflow';

-- Step 3: Update existing users to 'active' status (backward compatibility)
UPDATE users SET account_status = 'active' WHERE account_status IS NULL;

-- Step 4: Add index for efficient pending registration queries
ALTER TABLE users ADD INDEX idx_account_status (account_status);

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- To rollback these changes, run:
-- ALTER TABLE users DROP COLUMN account_status;
-- DROP TABLE IF EXISTS registration_approvals;
