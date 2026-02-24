"use client";
import React, { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Toast from '@radix-ui/react-toast';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../context/UserContext';

const TEACHING_AREAS = [
  { code: "1.1", name: "Establishing Interaction and rapport" },
  { code: "1.2", name: "Setting and Maintaining Rules and Routine" },
  { code: "3.1", name: "Activating prior knowledge" },
  { code: "3.2", name: "Motivating learners for learning engagement" },
  { code: "3.3", name: "Using Questions to deepen learning" },
  { code: "3.4", name: "Facilitating collaborative learning" },
  { code: "3.5", name: "Concluding the lesson" },
  { code: "4.1", name: "Checking for understanding and providing feedback" },
];

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
    lessonDate: new Date().toISOString().split('T')[0],
    file: null,
    focusAreas: []
  });

  if (!user?.email) return null;

  const handleFocusAreaToggle = (code) => {
    setFormData(prev => {
      const updated = prev.focusAreas.includes(code)
        ? prev.focusAreas.filter(c => c !== code)
        : [...prev.focusAreas, code];
      return { ...prev, focusAreas: updated };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user?.email) {
      setErrorMessage('Please log in to upload files');
      setShowErrorToast(true);
      return;
    }

    if (!formData.subject || !formData.lessonNumber || !formData.lessonDate || !formData.file) {
      setErrorMessage('Please fill in all fields and select a file');
      setShowErrorToast(true);
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        throw new Error('User not found in database');
      }

      const userId = userData.user_id;
      setUploadProgress(15);

      const subject = formData.subject;
      const selectedSubject = subjectMapping[subject];
      const lessonDate = new Date(formData.lessonDate);

      const day = lessonDate.getDate().toString().padStart(2, '0');
      const month = (lessonDate.getMonth() + 1).toString().padStart(2, '0');
      const year = lessonDate.getFullYear();
      const dateString = `${day}-${month}-${year}`;

      const fileExtension = formData.file.name.split('.').pop() || 'mp3';
      const fileName = `${selectedSubject.schoolCode}_${selectedSubject.code}_L${formData.lessonNumber}_${dateString}.${fileExtension}`;
      const filePath = `users/${userId}/${subject}/audio/${fileName}`;

      setUploadProgress(25);

      const urlRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { token } = await urlRes.json();

      const { error: uploadError } = await supabase.storage
        .from('upload')
        .uploadToSignedUrl(filePath, token, formData.file, {
          contentType: formData.file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(50);
      setUploadProgress(75);
      setUploadProgress(90);

      const taskData = {
        task_type: 'audio_processing',
        status: 'pending',
        user_id: userId,
        metadata: {
          file_path: filePath,
          filename: fileName,
          original_filename: formData.file.name,
          subject: formData.subject,
          school_code: selectedSubject.schoolCode,
          subject_code: selectedSubject.code,
          lesson_number: parseInt(formData.lessonNumber),
          lesson_date: formData.lessonDate,
          focus_areas: formData.focusAreas.length > 0 ? formData.focusAreas : null
        }
      };

      const { error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) {
        setErrorMessage('File uploaded successfully, but task creation failed. Processing may be delayed.');
        setShowErrorToast(true);
        return;
      }

      setUploadProgress(100);

      const fileSizeMB = (formData.file?.size / (1024 * 1024)).toFixed(1);
      setUploadedFileName(fileName);
      setUploadedFileSize(fileSizeMB);

      setFormData({
        subject: '',
        lessonNumber: '',
        lessonDate: new Date().toISOString().split('T')[0],
        file: null,
        focusAreas: []
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setShowSuccessToast(true);

      setTimeout(() => {
        onClose();
      }, 4000);

    } catch (error) {
      setErrorMessage(error.message);
      setShowErrorToast(true);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setFormData({
      subject: '',
      lessonNumber: '',
      lessonDate: new Date().toISOString().split('T')[0],
      file: null,
      focusAreas: []
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <Dialog.Title className="text-xl font-semibold text-indigo-700 dark:text-indigo-400 mb-4">
                  Upload Lesson Audio
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="space-y-4" aria-label="Lesson audio upload form">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject *
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100 ${
                        formData.subject ? 'border-green-300 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <option value="">Select a subject</option>
                      {Object.keys(subjectMapping).map((subject) => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Choose the subject that was taught in this lesson
                    </p>
                  </div>

                  <div>
                    <label htmlFor="lesson-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lesson Number *
                    </label>
                    <input
                      id="lesson-number"
                      type="number"
                      min="1"
                      value={formData.lessonNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, lessonNumber: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100 ${
                        formData.lessonNumber ? 'border-green-300 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="e.g., 1, 2, 3..."
                      aria-describedby="lesson-number-help"
                    />
                    <p id="lesson-number-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter a positive number for the lesson
                    </p>
                  </div>

                  <div>
                    <label htmlFor="lesson-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lesson Date *
                    </label>
                    <input
                      id="lesson-date"
                      type="date"
                      value={formData.lessonDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, lessonDate: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark] ${
                        formData.lessonDate ? 'border-green-300 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      aria-describedby="lesson-date-help"
                    />
                    <p id="lesson-date-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Select the date when this lesson was taught
                    </p>
                  </div>

                  <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Audio File *
                    </label>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      formData.file
                        ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
                        : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
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
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          <p>File size: {(formData.file.size / (1024 * 1024)).toFixed(1)}MB</p>
                          <p>Type: {formData.file.type || 'Unknown'}</p>
                        </div>
                      )}
                      <p id="file-help" className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Supports .mp3 and .mp4 files up to 300MB
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Focus Areas
                      </label>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formData.focusAreas.length === 0 ? 'All areas (default)' : `${formData.focusAreas.length} selected`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      {TEACHING_AREAS.map((area) => (
                        <label
                          key={area.code}
                          className="flex items-start gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={formData.focusAreas.includes(area.code)}
                            onChange={() => handleFocusAreaToggle(area.code)}
                            className="mt-0.5 w-4 h-4 shrink-0 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-tight">
                            <span className="font-mono font-semibold text-gray-400 dark:text-gray-500">{area.code} </span>
                            {area.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Leave unchecked to process all areas equally.
                    </p>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
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
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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

      <Toast.Provider>
        <Toast.Root
          className={`fixed top-4 right-4 z-[200] bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-sm ${
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

      <Toast.Provider>
        <Toast.Root
          className={`fixed top-4 right-4 z-[200] bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 max-w-sm ${
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
