-- Migration 004: Notifications
-- Adds a notifications table for persistent, per-user notifications
-- with read/unread tracking and category-based filtering.

USE logbookdb;
GO

IF OBJECT_ID('notifications', 'U') IS NULL
BEGIN
    CREATE TABLE notifications (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        user_id         INT NOT NULL,
        category        NVARCHAR(50) NOT NULL,
        title           NVARCHAR(200) NOT NULL,
        message         NVARCHAR(500) NOT NULL,
        tone            NVARCHAR(20) NOT NULL DEFAULT 'info'
                            CHECK (tone IN ('info', 'warning', 'success')),
        is_read         BIT NOT NULL DEFAULT 0,
        reference_type  NVARCHAR(50) NULL,
        reference_id    INT NULL,
        created_at      DATETIME NOT NULL DEFAULT GETDATE(),
        read_at         DATETIME NULL,
        CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
    CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
    CREATE INDEX idx_notifications_category ON notifications(category);

    PRINT 'notifications table created.';
END
ELSE
BEGIN
    PRINT 'notifications table already exists, skipping.';
END
GO
