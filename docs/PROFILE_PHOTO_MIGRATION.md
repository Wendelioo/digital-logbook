# Profile Photo Migration Guide

## Problem Statement

The original schema used `MEDIUMTEXT` to store Base64-encoded image data URLs (e.g., `data:image/jpeg;base64,/9j/4AAQ...`). This approach has several issues:

1. **Storage inefficiency**: Base64 encoding increases file size by ~33%
2. **Performance degradation**: TEXT fields are optimized for character data, not binary
3. **Memory overhead**: Large TEXT fields consume more memory during queries
4. **Character encoding issues**: Risk of data corruption with multibyte characters

## Solution: Use MEDIUMBLOB

The schema has been updated to use `MEDIUMBLOB` (Binary Large Object) which:
- Stores raw binary data without encoding overhead
- Supports images up to **16MB** (sufficient for profile photos)
- Provides faster read/write operations
- Eliminates encoding/decoding CPU overhead

---

## Database Migration Steps

### Step 1: Backup Your Database
```bash
# Windows PowerShell
mysqldump -u root -p logbookdb > logbookdb_backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

### Step 2: Apply Schema Changes

**Option A - Fresh Installation** (if no production data):
```sql
-- Drop and recreate database with new schema
SOURCE c:\Users\Wendel\digital-logbook\database\logbookschema.sql
```

**Option B - Migrate Existing Data** (if you have users with photos):
```sql
USE logbookdb;

-- 1. Create temporary columns for binary data
ALTER TABLE admins ADD COLUMN profile_photo_new MEDIUMBLOB NULL;
ALTER TABLE teachers ADD COLUMN profile_photo_new MEDIUMBLOB NULL;
ALTER TABLE students ADD COLUMN profile_photo_new MEDIUMBLOB NULL;

-- 2. Convert Base64 data to binary (if you have existing Base64 data)
-- Note: This requires manual conversion or a script, see below

-- 3. Drop old TEXT columns and rename new ones
ALTER TABLE admins DROP COLUMN profile_photo;
ALTER TABLE admins CHANGE COLUMN profile_photo_new profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB';

ALTER TABLE teachers DROP COLUMN profile_photo;
ALTER TABLE teachers CHANGE COLUMN profile_photo_new profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB';

ALTER TABLE students DROP COLUMN profile_photo;
ALTER TABLE students CHANGE COLUMN profile_photo_new profile_photo MEDIUMBLOB NULL COMMENT 'Binary image data (JPEG/PNG) - stores up to 16MB';
```

### Step 3: Verify Migration
```sql
-- Check column types
DESCRIBE admins;
DESCRIBE teachers;
DESCRIBE students;

-- Expected output:
-- profile_photo | mediumblob | YES | | NULL |
```

---

## Go Code Implementation

### Current Implementation (Needs Update)

The current code treats `profile_photo` as a string (Base64 data URL):
```go
// auth.go - Current implementation
var photoURL sql.NullString
// ... scan from database ...
if photoURL.Valid {
    user.PhotoURL = &photoURL.String  // ❌ This won't work with BLOB
}
```

### Updated Implementation for BLOB Storage

You need to update your Go code to handle binary data:

#### 1. Update User Struct (app.go)
```go
type User struct {
    ID            int     `json:"id"`
    Username      string  `json:"username"`
    Role          string  `json:"role"`
    // ... other fields ...
    
    // Option A: Send binary data as Base64 to frontend
    ProfilePhoto  *string `json:"profile_photo,omitempty"` // Base64-encoded for JSON
    
    // Option B: Send as byte array (less common)
    // ProfilePhotoBytes []byte `json:"-"` // Don't serialize to JSON
}
```

#### 2. Update Database Read Operations (auth.go)

```go
// loadUserProfile - Updated to handle BLOB
func (a *App) loadUserProfile(user *User) error {
    var detailQuery string
    switch user.Role {
    case "admin":
        detailQuery = `SELECT first_name, middle_name, last_name, gender, 
                       employee_number, email, profile_photo 
                       FROM admins WHERE user_id = ?`
    case "teacher":
        detailQuery = `SELECT first_name, middle_name, last_name, 
                       employee_number, email, contact_number, profile_photo 
                       FROM teachers WHERE user_id = ?`
    case "student":
        detailQuery = `SELECT first_name, middle_name, last_name, 
                       student_number, email, contact_number, profile_photo 
                       FROM students WHERE user_id = ? AND is_working_student = FALSE`
    case "working_student":
        detailQuery = `SELECT first_name, middle_name, last_name, 
                       student_number, email, contact_number, profile_photo 
                       FROM students WHERE user_id = ? AND is_working_student = TRUE`
    default:
        return fmt.Errorf("unknown user role: %s", user.Role)
    }

    var firstName, middleName, lastName, gender sql.NullString
    var employeeID, studentID sql.NullString
    var email, contactNumber sql.NullString
    var photoBytes []byte  // ✅ Changed from sql.NullString to []byte

    switch user.Role {
    case "admin":
        err := a.db.QueryRow(detailQuery, user.ID).Scan(
            &firstName, &middleName, &lastName, &gender, 
            &employeeID, &email, &photoBytes)  // ✅ Scan into []byte
        if err != nil {
            return err
        }
        if gender.Valid {
            user.Gender = &gender.String
        }
        if employeeID.Valid {
            user.EmployeeID = &employeeID.String
        }
    case "teacher":
        err := a.db.QueryRow(detailQuery, user.ID).Scan(
            &firstName, &middleName, &lastName, 
            &employeeID, &email, &contactNumber, &photoBytes)  // ✅ Scan into []byte
        if err != nil {
            return err
        }
        if employeeID.Valid {
            user.EmployeeID = &employeeID.String
        }
        if contactNumber.Valid {
            user.ContactNumber = &contactNumber.String
        }
    case "student", "working_student":
        err := a.db.QueryRow(detailQuery, user.ID).Scan(
            &firstName, &middleName, &lastName, 
            &studentID, &email, &contactNumber, &photoBytes)  // ✅ Scan into []byte
        if err != nil {
            return err
        }
        if studentID.Valid {
            user.StudentID = &studentID.String
        }
        if contactNumber.Valid {
            user.ContactNumber = &contactNumber.String
        }
    }

    // Set common fields
    if firstName.Valid {
        user.FirstName = &firstName.String
    }
    if middleName.Valid {
        user.MiddleName = &middleName.String
    }
    if lastName.Valid {
        user.LastName = &lastName.String
    }
    if email.Valid {
        user.Email = &email.String
    }
    
    // ✅ Convert binary data to Base64 for frontend
    if len(photoBytes) > 0 {
        // Detect image type from first bytes (magic numbers)
        mimeType := detectImageMimeType(photoBytes)
        base64Data := base64.StdEncoding.EncodeToString(photoBytes)
        dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
        user.ProfilePhoto = &dataURL
    }

    return nil
}

// Helper function to detect image MIME type
func detectImageMimeType(data []byte) string {
    if len(data) < 4 {
        return "application/octet-stream"
    }
    
    // JPEG magic number: FF D8 FF
    if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
        return "image/jpeg"
    }
    // PNG magic number: 89 50 4E 47
    if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
        return "image/png"
    }
    // GIF magic number: 47 49 46
    if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 {
        return "image/gif"
    }
    // WebP magic number: 52 49 46 46 ... 57 45 42 50
    if len(data) >= 12 && data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
        data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50 {
        return "image/webp"
    }
    
    return "image/jpeg" // Default fallback
}
```

**Add this import at the top of auth.go:**
```go
import (
    "database/sql"
    "encoding/base64"  // ✅ Add this
    "fmt"
    "log"
    "os"
)
```

#### 3. Update Database Write Operations

Create or update user profile photo:

```go
// UpdateUserProfilePhoto - New method to update profile photo
func (a *App) UpdateUserProfilePhoto(userID int, imageBase64 string) error {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    base64Data := imageBase64
    if strings.HasPrefix(imageBase64, "data:") {
        parts := strings.Split(imageBase64, ",")
        if len(parts) == 2 {
            base64Data = parts[1]
        }
    }
    
    // Decode Base64 to binary
    imageBytes, err := base64.StdEncoding.DecodeString(base64Data)
    if err != nil {
        return fmt.Errorf("failed to decode base64 image: %w", err)
    }
    
    // Validate image size (e.g., max 5MB)
    maxSize := 5 * 1024 * 1024 // 5MB
    if len(imageBytes) > maxSize {
        return fmt.Errorf("image too large: %d bytes (max %d bytes)", len(imageBytes), maxSize)
    }
    
    // Determine which table to update based on user role
    var query string
    var role string
    err = a.db.QueryRow("SELECT user_type FROM users WHERE id = ?", userID).Scan(&role)
    if err != nil {
        return err
    }
    
    switch role {
    case "admin":
        query = "UPDATE admins SET profile_photo = ? WHERE user_id = ?"
    case "teacher":
        query = "UPDATE teachers SET profile_photo = ? WHERE user_id = ?"
    case "student", "working_student":
        query = "UPDATE students SET profile_photo = ? WHERE user_id = ?"
    default:
        return fmt.Errorf("invalid user role: %s", role)
    }
    
    // Store binary data in database
    _, err = a.db.Exec(query, imageBytes, userID)
    return err
}
```

#### 4. Update classes.go (GetClassStudents method)

```go
// Around line 1054 in classes.go - Update profile photo handling
var middleName, email, contactNumber sql.NullString
var photoBytes []byte  // ✅ Changed from sql.NullString

err := rows.Scan(&student.StudentID, &student.FirstName, &middleName,
    &student.LastName, &email, &contactNumber, &photoBytes)  // ✅ Changed
if err != nil {
    log.Printf("Error scanning student row: %v", err)
    return nil, err
}

// ... other field mappings ...

// ✅ Convert binary photo to Base64 data URL
if len(photoBytes) > 0 {
    mimeType := detectImageMimeType(photoBytes)
    base64Data := base64.StdEncoding.EncodeToString(photoBytes)
    dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
    student.ProfilePhoto = &dataURL
}
```

---

## Frontend Implementation (React/TypeScript)

### File Upload Component Example

```tsx
// components/ProfilePhotoUpload.tsx
import React, { useState } from 'react';
import { UpdateUserProfilePhoto } from '../../wailsjs/go/main/App';

interface ProfilePhotoUploadProps {
  userId: number;
  currentPhotoUrl?: string;
  onUploadSuccess?: (photoUrl: string) => void;
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  userId,
  currentPhotoUrl,
  onUploadSuccess
}) => {
  const [preview, setPreview] = useState<string | undefined>(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Read file as Data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setPreview(dataUrl);

        try {
          // Send to backend (automatically converts to binary)
          await UpdateUserProfilePhoto(userId, dataUrl);
          onUploadSuccess?.(dataUrl);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
          setPreview(currentPhotoUrl);
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to read file');
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {preview && (
        <img
          src={preview}
          alt="Profile"
          className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
        />
      )}
      
      <label className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50">
        {uploading ? 'Uploading...' : 'Choose Photo'}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
      
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};
```

---

## Testing Checklist

- [ ] Database migration completed without errors
- [ ] Existing photos migrated (if applicable)
- [ ] New photo uploads work correctly
- [ ] Photos display in all dashboards (Admin, Teacher, Student, Working Student)
- [ ] File size validation enforced (max 5MB recommended)
- [ ] Image format validation (JPEG, PNG, GIF, WebP)
- [ ] Profile photo appears in class student lists
- [ ] Memory usage stable with multiple users
- [ ] Export reports include photos correctly (if applicable)

---

## Common Issues & Solutions

### Issue 1: "Invalid BLOB value" Error
**Cause**: Trying to insert Base64 string instead of binary data  
**Solution**: Ensure you decode Base64 before inserting: `base64.StdEncoding.DecodeString()`

### Issue 2: Photos Not Displaying
**Cause**: Frontend expecting data URL but receiving binary  
**Solution**: Always encode to Base64 data URL when sending to frontend

### Issue 3: "Packet too large" MySQL Error
**Cause**: Image exceeds MySQL's `max_allowed_packet` setting  
**Solution**: 
```sql
-- Check current limit
SHOW VARIABLES LIKE 'max_allowed_packet';

-- Increase limit (in my.cnf or via SET GLOBAL)
SET GLOBAL max_allowed_packet=67108864; -- 64MB
```

### Issue 4: Slow Query Performance
**Cause**: Selecting BLOB columns unnecessarily  
**Solution**: Only select `profile_photo` when needed:
```go
// Good: Only select photo when displaying profile
SELECT id, first_name, last_name, profile_photo FROM students WHERE user_id = ?

// Bad: Loading photos in list views (use pagination)
SELECT * FROM students LIMIT 1000  -- Loads all 1000 photos!
```

---

## Performance Best Practices

1. **Lazy Loading**: Don't load photos in list views; load on-demand
2. **Thumbnail Generation**: Store separate thumbnail BLOB for list views
3. **CDN/File Storage**: For production, consider storing files on disk/S3 and storing only file paths in database
4. **Caching**: Cache frequently accessed photos in memory or Redis

---

## Future Enhancements

Consider implementing:
- Image resizing/optimization before storage
- Multiple sizes (thumbnail, medium, full)
- File system storage with database references
- Cloud storage integration (AWS S3, Azure Blob)
- Image CDN for faster delivery

---

## References

- [MySQL BLOB Documentation](https://dev.mysql.com/doc/refman/8.0/en/blob.html)
- [Go sql.DB BLOB Handling](https://go.dev/doc/database/querying)
- [Base64 Encoding in Go](https://pkg.go.dev/encoding/base64)
