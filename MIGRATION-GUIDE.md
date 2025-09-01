# File Structure Migration Guide

## Overview
This guide explains how to migrate from the legacy subject-based file structure to the new user-based hybrid structure.

## New Structure

### Before (Legacy):
```
audio-uploads/
├── English/
│   ├── Lesson1_2024-01-15.mp3
│   └── Lesson2_2024-01-16.mp3
├── Mathematics/
│   └── Lesson1_2024-01-15.mp3
└── Science/
    └── Lesson1_2024-01-17.mp3
```

### After (New):
```
audio-uploads/
├── users/
│   ├── user_123/
│   │   ├── English/
│   │   │   ├── 2024-01-15_Lesson1_abc123.mp3
│   │   │   └── 2024-01-16_Lesson2_def456.mp3
│   │   ├── Mathematics/
│   │   │   └── 2024-01-15_Lesson1_ghi789.mp3
│   │   └── Science/
│   │       └── 2024-01-17_Lesson1_jkl012.mp3
│   └── user_456/
│       └── English/
│           └── 2024-01-15_Lesson1_mno345.mp3
└── legacy/
    └── (moved legacy files during migration)
```

## Benefits of New Structure

1. **User Isolation**: Each user has their own folder space
2. **Better Privacy**: Files are naturally segregated by user
3. **Scalability**: Easy to implement user quotas and permissions
4. **Collision Prevention**: No filename conflicts between users
5. **Enterprise Ready**: Standard practice for multi-tenant applications

## Prerequisites

1. **Environment Variables**: Ensure you have:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_key  # Admin key for migration
   ```

2. **Database Backup**: Take a backup of your `files` table before migration

3. **Storage Backup**: Consider backing up your storage bucket

## Migration Steps

### Step 1: Test Your Current Setup
```bash
# Make sure your app is working with current files
npm run dev
```

### Step 2: Run the Migration Script
```bash
# This will migrate files to new structure while keeping old ones
npm run migrate-files
```

The migration script will:
- ✅ Fetch all files that need migration
- ✅ Create new user-based folder structure
- ✅ Copy files to new locations
- ✅ Update database records with new paths
- ✅ Keep references to old paths for rollback

### Step 3: Test the New Structure
1. **Upload a new file** - should go to new structure automatically
2. **Open Storage Files Modal** - should show files from database
3. **Download files** - should work with new paths
4. **Use chatbot** - should work with new file references

### Step 4: Cleanup Legacy Files (Optional)
⚠️ **Only run this after confirming everything works!**
```bash
# This will remove the old files from storage
npm run cleanup-legacy
```

## Migration Script Output

The script provides detailed logging:

```
🚀 Starting file structure migration...
📋 Fetching files for migration...
📁 Found 15 files to migrate

🔄 Processing file: English/Lesson1_2024-01-15.mp3
  📁 Old path: English/Lesson1_2024-01-15.mp3
  📁 New path: users/user_123/English/2024-01-15_Lesson1_abc123.mp3
  📤 Copying file to new location...
  💾 Updating database record...
  ✅ File migrated successfully

📊 Migration Summary:
✅ Successfully migrated: 15 files
❌ Failed migrations: 0 files
```

## Database Changes

The migration adds these fields to the `files` table:
- `migration_date`: When the file was migrated
- `legacy_path`: Original file path (for rollback)

## New File Upload Behavior

After migration, new files will be uploaded with this naming pattern:
- **Path**: `users/{user_id}/{subject}/{date}_Lesson{number}_{uuid}.{ext}`
- **Example**: `users/123/English/2024-01-15_Lesson1_abc123.mp3`

## Rollback Plan

If you need to rollback:

1. **Restore database backup**
2. **Files remain in legacy locations** (not deleted during migration)
3. **Revert code changes** to use old structure

## File Access Security

The new structure enables:
- **Row Level Security (RLS)** on storage bucket
- **User-specific file access** via database relationships
- **Proper file isolation** between users

## Troubleshooting

### Common Issues:

1. **Permission Errors**
   - Ensure `SUPABASE_SERVICE_KEY` has storage admin permissions

2. **Migration Fails Partway**
   - Script is idempotent - safe to run multiple times
   - Failed files will be retried on next run

3. **File Not Found Errors**
   - Check if files were already migrated
   - Verify file paths in database match storage

### Verification Queries:

```sql
-- Check migration status
SELECT 
  count(*) as total_files,
  count(migration_date) as migrated_files,
  count(*) - count(migration_date) as remaining_files
FROM files;

-- See file path patterns
SELECT file_path, stored_filename 
FROM files 
LIMIT 10;
```

## Support

If you encounter issues:
1. Check the migration script logs
2. Verify your environment variables
3. Test with a small subset of files first
4. Ensure your Supabase project has sufficient storage

---

**Next Steps**: After successful migration, you can implement Row Level Security and user quotas based on the new folder structure.
