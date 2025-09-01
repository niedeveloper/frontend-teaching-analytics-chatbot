/**
 * Migration Script: Legacy Subject Structure → User-Based Structure
 * 
 * Migrates from:
 *   audio-uploads/English/Lesson1_2024-01-15.mp3
 * 
 * To:
 *   audio-uploads/users/user_123/English/2024-01-15_Lesson1_abc123.mp3
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin operations
);

/**
 * Generate new filename in the format: YYYY-MM-DD_LessonX_shortUuid.ext
 */
function generateNewFilename(lessonDate, lessonNumber, originalExtension) {
  const date = new Date(lessonDate).toISOString().split('T')[0];
  const shortUuid = uuidv4().split('-')[0]; // First 8 characters of UUID
  return `${date}_Lesson${lessonNumber}_${shortUuid}.${originalExtension}`;
}

/**
 * Generate new file path: users/user_id/subject/filename
 */
function generateNewFilePath(userId, subject, filename) {
  return `users/${userId}/${subject}/${filename}`;
}

/**
 * Main migration function
 */
async function migrateFileStructure() {
  console.log('🚀 Starting file structure migration...');
  
  try {
    // Step 1: Get all files that need migration (files with old structure)
    console.log('📋 Fetching files for migration...');
    
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select(`
        file_id,
        stored_filename,
        file_path,
        original_filename,
        lesson_number,
        lesson_date,
        classes!inner(
          user_id,
          class_name
        )
      `)
      .not('file_path', 'like', 'users/%'); // Only files NOT already in new structure
    
    if (filesError) {
      throw new Error(`Failed to fetch files: ${filesError.message}`);
    }
    
    console.log(`📁 Found ${files.length} files to migrate`);
    
    if (files.length === 0) {
      console.log('✅ No files need migration. All files are already in new structure.');
      return;
    }
    
    // Step 2: Process each file
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const file of files) {
      try {
        console.log(`\n🔄 Processing file: ${file.stored_filename}`);
        
        const userId = file.classes.user_id;
        const subject = file.classes.class_name;
        const originalExtension = file.original_filename.split('.').pop() || 'mp3';
        
        // Generate new filename and path
        const newFilename = generateNewFilename(
          file.lesson_date,
          file.lesson_number,
          originalExtension
        );
        const newFilePath = generateNewFilePath(userId, subject, newFilename);
        
        console.log(`  📁 Old path: ${file.file_path}`);
        console.log(`  📁 New path: ${newFilePath}`);
        
        // Step 3: Copy file in storage to new location
        console.log('  📤 Copying file to new location...');
        
        // First, download the file from old location
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('audio-uploads')
          .download(file.file_path);
        
        if (downloadError) {
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }
        
        // Upload to new location
        const { error: uploadError } = await supabase.storage
          .from('audio-uploads')
          .upload(newFilePath, fileData, {
            upsert: false,
            contentType: fileData.type
          });
        
        if (uploadError) {
          throw new Error(`Failed to upload to new location: ${uploadError.message}`);
        }
        
        // Step 4: Update database record
        console.log('  💾 Updating database record...');
        
        const { error: updateError } = await supabase
          .from('files')
          .update({
            stored_filename: newFilename,
            file_path: newFilePath,
            migration_date: new Date().toISOString(),
            legacy_path: file.file_path // Keep reference to old path
          })
          .eq('file_id', file.file_id);
        
        if (updateError) {
          throw new Error(`Failed to update database: ${updateError.message}`);
        }
        
        console.log('  ✅ File migrated successfully');
        successCount++;
        
        // Optional: Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error migrating file ${file.stored_filename}:`, error.message);
        errors.push({
          file: file.stored_filename,
          error: error.message
        });
        errorCount++;
      }
    }
    
    // Step 5: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} files`);
    console.log(`❌ Failed migrations: ${errorCount} files`);
    
    if (errors.length > 0) {
      console.log('\n❌ Migration Errors:');
      errors.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
    }
    
    if (successCount > 0) {
      console.log('\n⚠️  IMPORTANT NEXT STEPS:');
      console.log('1. Test the application with the new file structure');
      console.log('2. Once confirmed working, run cleanup script to remove legacy files');
      console.log('3. Update any hardcoded paths in your application code');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

/**
 * Cleanup function to remove legacy files (run after confirming migration success)
 */
async function cleanupLegacyFiles() {
  console.log('🧹 Starting cleanup of legacy files...');
  
  try {
    // Get all files that have been migrated (have migration_date)
    const { data: migratedFiles, error: filesError } = await supabase
      .from('files')
      .select('file_id, legacy_path')
      .not('migration_date', 'is', null)
      .not('legacy_path', 'is', null);
    
    if (filesError) {
      throw new Error(`Failed to fetch migrated files: ${filesError.message}`);
    }
    
    console.log(`🗑️  Found ${migratedFiles.length} legacy files to clean up`);
    
    let cleanupCount = 0;
    const cleanupErrors = [];
    
    for (const file of migratedFiles) {
      try {
        console.log(`🗑️  Removing legacy file: ${file.legacy_path}`);
        
        const { error: deleteError } = await supabase.storage
          .from('audio-uploads')
          .remove([file.legacy_path]);
        
        if (deleteError) {
          throw new Error(`Failed to delete legacy file: ${deleteError.message}`);
        }
        
        // Clear legacy_path from database
        await supabase
          .from('files')
          .update({ legacy_path: null })
          .eq('file_id', file.file_id);
        
        cleanupCount++;
        
      } catch (error) {
        console.error(`❌ Error cleaning up ${file.legacy_path}:`, error.message);
        cleanupErrors.push({
          path: file.legacy_path,
          error: error.message
        });
      }
    }
    
    console.log(`\n✅ Cleanup completed: ${cleanupCount} legacy files removed`);
    
    if (cleanupErrors.length > 0) {
      console.log('\n❌ Cleanup Errors:');
      cleanupErrors.forEach(({ path, error }) => {
        console.log(`  - ${path}: ${error}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Cleanup failed:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'migrate') {
  migrateFileStructure();
} else if (command === 'cleanup') {
  cleanupLegacyFiles();
} else {
  console.log(`
📋 File Structure Migration Tool

Usage:
  node scripts/migrate-file-structure.js migrate  - Migrate files to new structure
  node scripts/migrate-file-structure.js cleanup  - Remove legacy files (run after testing)

Environment variables required:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_KEY
  `);
}
