"use client";
import React, { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Toast from '@radix-ui/react-toast';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../context/UserContext';

// Subject mapping as provided
// File naming convention: Subject/LessonX_YYYY-MM-DD.ext
// Examples: English/Lesson1_2024-02-15.mp3, Mathematics/Lesson2_2024-02-15.mp3
// This creates organized folders by subject and readable filenames
const subjectMapping = {
  'English': { code: 'T1', schoolCode: 'N', classId: 1 },
  'Mathematics': { code: 'T2', schoolCode: 'N', classId: 2 },
  'Science (Primary)': { code: 'T3', schoolCode: 'N', classId: 3 },
  'Social Studies': { code: 'T1', schoolCode: 'Y', classId: 4 },
  'Geography': { code: 'T2', schoolCode: 'Y', classId: 5 },
  'History': { code: 'T3', schoolCode: 'Y', classId: 6 },
  'Chemistry': { code: 'T4', schoolCode: 'Y', classId: 7 },
  'Science (Secondary)': { code: 'T5', schoolCode: 'Y', classId: 8 }
};



export default function FileUploadModal({ isOpen, onClose }) {
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    subject: '',
    lessonNumber: '',
    lessonDate: new Date().toISOString().split('T')[0], // Default to today
    file: null
  });

  // Don't render if user is not authenticated
  if (!user?.email) {
    return null;
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation
      if (!file.type.includes('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.mp4')) {
        setErrorMessage('Please select an audio file (.mp3 or .mp4)');
        setShowErrorToast(true);
        return;
      }
      
      if (file.size > 300 * 1024 * 1024) {
        setErrorMessage('File size must be less than 300MB');
        setShowErrorToast(true);
        return;
      }
      
      setFormData(prev => ({ ...prev, file }));
      setErrorMessage('');
      setShowErrorToast(false);
    }
  };

  // Simple test upload function
  const handleSimpleUpload = async () => {
    if (!formData.file) {
      setErrorMessage('Please select a file first');
      setShowErrorToast(true);
      return;
    }

    console.log('=== SIMPLE UPLOAD TEST START ===');
    console.log('File to upload:', formData.file);
    console.log('File name:', formData.file.name);
    console.log('File size:', formData.file.size);
    console.log('File type:', formData.file.type);

    try {
      // Create filename for test upload using backend expected format
      const subject = formData.subject || 'English';
      const selectedSubject = subjectMapping[subject] || { schoolCode: 'N', code: 'T1' };
      const lessonNumber = formData.lessonNumber || 1;
      const lessonDate = formData.lessonDate ? new Date(formData.lessonDate) : new Date();
      
      // Convert date to DD-MM-YYYY format for backend
      const day = lessonDate.getDate().toString().padStart(2, '0');
      const month = (lessonDate.getMonth() + 1).toString().padStart(2, '0');
      const year = lessonDate.getFullYear();
      const dateString = `${day}-${month}-${year}`;
      
      const fileExtension = formData.file.name.split('.').pop() || 'mp3';
      
      // Generate filename: {schoolCode}_{subjectCode}_L{lessonNumber}_{DD-MM-YYYY}.{ext}
      const fileName = `${selectedSubject.schoolCode}_${selectedSubject.code}_L${lessonNumber}_${dateString}.${fileExtension}`;
      const filePath = `users/test_user/${subject}/audio/${fileName}`;
      console.log('Attempting to upload:', filePath);

      // Use service key for storage upload (bypasses RLS)
      const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/${filePath}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY}`,
          'Content-Type': formData.file.type,
          'Cache-Control': '3600',
          'x-upsert': 'false'
        },
        body: formData.file
      });

      console.log('Upload response status:', response.status);
      const responseText = await response.text();
      console.log('Upload response body:', responseText);

      if (response.ok) {
        console.log('=== SIMPLE UPLOAD SUCCESS ===');
        setErrorMessage('');
        setShowSuccessToast(true);
        setShowErrorToast(false);
      } else {
        throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
      }

    } catch (error) {
      console.error('=== SIMPLE UPLOAD ERROR ===');
      console.error('Simple upload error:', error);
      setErrorMessage(`Simple upload failed: ${error.message}`);
      setShowErrorToast(true);
      setShowSuccessToast(false);
    }
    
    console.log('=== SIMPLE UPLOAD TEST END ===');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('=== UPLOAD DEBUG START ===');
    console.log('Form data:', formData);
    console.log('User email:', user?.email);
    
    if (!user?.email) {
      setErrorMessage('Please log in to upload files');
      setShowErrorToast(true);
      return;
    }

    // Basic validation
    if (!formData.subject || !formData.lessonNumber || !formData.lessonDate || !formData.file) {
      setErrorMessage('Please fill in all fields and select a file');
      setShowErrorToast(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      // Step 1: Get user_id from users table
      console.log('Step 1: Getting user_id for email:', user.email);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', user.email)
        .single();
      
      console.log('User data result:', userData);
      console.log('User error:', userError);
      
      if (userError || !userData) {
        throw new Error('User not found in database');
      }
      
      const userId = userData.user_id;
      console.log('User ID found:', userId);
      setUploadProgress(15);
      
      // Step 2: Upload file to Supabase Storage
      // Create filename matching backend expected format: {schoolCode}_{subjectCode}_L{lessonNumber}_{DD-MM-YYYY}.{ext}
      const subject = formData.subject;
      const selectedSubject = subjectMapping[subject];
      const lessonDate = new Date(formData.lessonDate);
      
      // Convert date to DD-MM-YYYY format for backend
      const day = lessonDate.getDate().toString().padStart(2, '0');
      const month = (lessonDate.getMonth() + 1).toString().padStart(2, '0');
      const year = lessonDate.getFullYear();
      const dateString = `${day}-${month}-${year}`;
      
      const fileExtension = formData.file.name.split('.').pop() || 'mp3';
      
      // Generate filename: {schoolCode}_{subjectCode}_L{lessonNumber}_{DD-MM-YYYY}.{ext}
      const fileName = `${selectedSubject.schoolCode}_${selectedSubject.code}_L${formData.lessonNumber}_${dateString}.${fileExtension}`;
      const filePath = `users/${userId}/${subject}/audio/${fileName}`;
      console.log('Step 2: Uploading file to storage');
      console.log('File name:', fileName);
      console.log('File path:', filePath);
      console.log('File size:', formData.file.size);
      console.log('File type:', formData.file.type);
      console.log('Subject:', subject);
      console.log('Lesson number:', formData.lessonNumber);
      console.log('Date:', dateString);
              
      // Debug: Check available storage buckets
      console.log('Checking available storage buckets...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      console.log('Available buckets:', buckets);
      console.log('Buckets error:', bucketsError);
              
      setUploadProgress(25);
              
      // Use service key for storage upload (bypasses RLS)
      const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/${filePath}`;
              
              const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY}`,
                  'Content-Type': formData.file.type,
                  'Cache-Control': '3600',
                  'x-upsert': 'false'
                },
                body: formData.file
              });

              console.log('Upload response status:', response.status);
              const responseText = await response.text();
              console.log('Upload response body:', responseText);

              if (!response.ok) {
                throw new Error(`Upload failed with status ${response.status}: ${responseText}`);
              }

              // Parse the response to get the file path
              const uploadData = JSON.parse(responseText);
              console.log('Storage upload result:', uploadData);
              
              setUploadProgress(50);

      // Step 3: Skip database inserts for files and classes tables
      console.log('Step 3: Skipping database inserts for files and classes tables');
      console.log('Selected subject:', formData.subject);
      console.log('Subject mapping:', selectedSubject);
      setUploadProgress(75);

      // Step 4: Create task for processing
      console.log('Step 4: Creating processing task');
      console.log('File path:', filePath);
      console.log('Generated filename:', fileName);
      setUploadProgress(90);
      
      // Create task record for background processing
      const taskData = {
        task_type: 'audio_processing',
        status: 'pending',
        user_id: userId, // Add user_id for filtering
        metadata: {
          file_path: filePath,
          filename: fileName, // Store the parsed filename for backend processing
          original_filename: formData.file.name,
          subject: formData.subject,
          school_code: selectedSubject.schoolCode,
          subject_code: selectedSubject.code,
          lesson_number: parseInt(formData.lessonNumber),
          lesson_date: formData.lessonDate
        }
      };
      
      console.log('Creating task with data:', taskData);
      
      const { data: taskRecord, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      console.log('Task creation result:', taskRecord);
      console.log('Task creation error:', taskError);

      if (taskError) {
        console.warn('Task creation failed, but file is uploaded:', taskError);
        setErrorMessage('File uploaded successfully, but task creation failed. Processing may be delayed.');
        setShowErrorToast(true);
        return;
      }

      console.log('Task created successfully:', taskRecord.task_id);
      setUploadProgress(100);
      
      // Success
      const fileSizeMB = (formData.file?.size / (1024 * 1024)).toFixed(1);
      setUploadedFileName(fileName); // Use the parsed filename
      setUploadedFileSize(fileSizeMB);
      
      console.log('=== UPLOAD SUCCESS ===');
      console.log('File uploaded successfully:', formData.file.name);
      console.log('Parsed filename:', fileName);
      console.log('File size:', fileSizeMB, 'MB');
      console.log('Task created:', taskRecord);
      
      // Reset form data first
      setFormData({
        subject: '',
        lessonNumber: '',
        lessonDate: new Date().toISOString().split('T')[0],
        file: null
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Show success toast after form reset
      setShowSuccessToast(true);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 4000);

    } catch (error) {
      console.error('=== UPLOAD ERROR ===');
      console.error('Upload error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setErrorMessage(error.message);
      setShowErrorToast(true);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      console.log('=== UPLOAD DEBUG END ===');
    }
  };

  const resetForm = () => {
    setFormData({
      subject: '',
      lessonNumber: '',
      lessonDate: new Date().toISOString().split('T')[0],
      file: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setErrorMessage('');
    setUploadedFileName('');
    setUploadedFileSize('');
    setShowErrorToast(false);
    setShowSuccessToast(false);
  };

  const isFormValid = () => {
    return formData.subject && 
           formData.lessonNumber && 
           parseInt(formData.lessonNumber) > 0 && 
           formData.lessonDate && 
           formData.file;
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <Dialog.Title className="text-xl font-semibold text-indigo-700 mb-4">
                  Upload Lesson Audio
                </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="space-y-4" aria-label="Lesson audio upload form">
                  {/* Subject Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject *
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white ${
                        formData.subject ? 'border-green-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a subject</option>
                      {Object.keys(subjectMapping).map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose the subject that was taught in this lesson
                    </p>
                  </div>

                  {/* Lesson Number */}
                  <div>
                    <label htmlFor="lesson-number" className="block text-sm font-medium text-gray-700 mb-2">
                      Lesson Number *
                    </label>
                    <input
                      id="lesson-number"
                      type="number"
                      min="1"
                      value={formData.lessonNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, lessonNumber: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        formData.lessonNumber ? 'border-green-300' : 'border-gray-300'
                      }`}
                      placeholder="e.g., 1, 2, 3..."
                      aria-describedby="lesson-number-help"
                    />
                    <p id="lesson-number-help" className="text-xs text-gray-500 mt-1">
                      Enter a positive number for the lesson
                    </p>
                  </div>

                  {/* Lesson Date */}
                  <div>
                    <label htmlFor="lesson-date" className="block text-sm font-medium text-gray-700 mb-2">
                      Lesson Date *
                    </label>
                    <input
                      id="lesson-date"
                      type="date"
                      value={formData.lessonDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, lessonDate: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        formData.lessonDate ? 'border-green-300' : 'border-gray-300'
                      }`}
                      aria-describedby="lesson-date-help"
                    />
                    <p id="lesson-date-help" className="text-xs text-gray-500 mt-1">
                      Select the date when this lesson was taught
                    </p>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
                      Audio File *
                    </label>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      formData.file 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-gray-300 hover:border-indigo-400'
                    }`}>
                      <input
                        id="file-upload"
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.mp4,audio/*"
                        onChange={handleFileChange}
                        className="hidden"
                        aria-describedby="file-help"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                        aria-label="Select audio file"
                      >
                        {formData.file ? formData.file.name : 'Click to select audio file'}
                      </button>
                      {formData.file && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>File size: {(formData.file.size / (1024 * 1024)).toFixed(1)}MB</p>
                          <p>Type: {formData.file.type || 'Unknown'}</p>
                        </div>
                      )}
                      <p id="file-help" className="text-xs text-gray-500 mt-2">
                        Supports .mp3 and .mp4 files up to 300MB
                      </p>
                    </div>
                  </div>

                  {/* Simple Test Upload Button */}
                  {formData.file && (
                    <div className="border-t pt-4">
                      <button
                        type="button"
                        onClick={handleSimpleUpload}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition mb-2"
                      >
                        🧪 Test Simple Upload (Storage Only)
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        This button tests just the storage upload without database operations
                      </p>
                    </div>
                  )}

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !isFormValid()}
                      className={`flex-1 px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
                        isUploading || !isFormValid()
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isUploading && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isUploading ? 'Uploading...' : 'Upload File'}
                    </button>
                  </div>
                </form>

                <Dialog.Close asChild>
                  <button 
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                    aria-label="Close modal"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Success Toast */}
      <Toast.Provider>
        <Toast.Root
          className={`fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-sm ${
            showSuccessToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
          open={showSuccessToast}
          onOpenChange={setShowSuccessToast}
        >
          <Toast.Title className="font-medium">Upload Successful!</Toast.Title>
          <Toast.Description className="text-sm opacity-90 mt-1">
            Your file "{uploadedFileName}" ({uploadedFileSize}MB) has been uploaded and processing has started. This may take several hours to complete.
          </Toast.Description>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>

      {/* Error Toast */}
      <Toast.Provider>
        <Toast.Root
          className={`fixed top-4 right-4 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-sm ${
            showErrorToast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
          open={showErrorToast}
          onOpenChange={setShowErrorToast}
        >
          <Toast.Title className="font-medium">Upload Failed</Toast.Title>
          <Toast.Description className="text-sm opacity-90 mt-1">
            {errorMessage}
          </Toast.Description>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>
    </>
  );
}
