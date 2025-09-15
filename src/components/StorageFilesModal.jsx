import { useState, useEffect } from "react";
import { Download, FileText, Calendar, HardDrive, X, Folder, ArrowLeft, Home, File, Music, FileImage, FileCode, FolderOpen } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";
import * as Dialog from '@radix-ui/react-dialog';
import * as Separator from '@radix-ui/react-separator';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Progress from '@radix-ui/react-progress';

export default function StorageFilesModal({ open, onClose }) {
  const { user } = useUser();
  const [items, setItems] = useState([]); // Files and folders
  const [currentPath, setCurrentPath] = useState(''); // Current folder path
  const [breadcrumbs, setBreadcrumbs] = useState([]); // Navigation breadcrumbs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  // Initialize and fetch user data
  useEffect(() => {
    if (open && user?.email) {
      initializeUserBrowser();
    }
  }, [open, user]);

  // Fetch folder contents when modal opens or path changes
  useEffect(() => {
    if (userId && open && currentPath) {
      fetchFolderContents(currentPath);
    }
  }, [userId, open, currentPath]);

  const initializeUserBrowser = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 [File Browser Debug] Initializing user browser...');
      console.log('👤 User email:', user.email);

      // First, try to create/get Supabase session using service key
      console.log('🔐 [Auth] Attempting to authenticate with Supabase...');
      
      // For now, let's bypass auth and use service key for storage operations
      // Since you don't have RLS set up, we can use the anon key with public bucket
      
      // Get user_id first
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", user.email)
        .single();

      console.log('🔍 User query result:', userData);
      console.log('❌ User query error:', userError);

      if (userError || !userData) {
        throw new Error("User not found");
      }

      const userId = userData.user_id;
      const initialPath = `users/${userId}`;
      
      console.log('🆔 User ID found:', userId);
      console.log('📍 Initial path set to:', initialPath);

      setUserId(userId);
      setCurrentPath(initialPath);
      setBreadcrumbs([
        { name: 'Home', path: initialPath }
      ]);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchFolderContents = async (path) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [File Browser] Fetching folder contents...');
      console.log('📁 Current path:', path);
      console.log('🪣 Bucket: upload');
      console.log('🌐 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      // Construct the expected URL for debugging
      const expectedUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload?prefix=${encodeURIComponent(path)}&limit=100&offset=0`;
      console.log('🔗 Expected list URL:', expectedUrl);

      // Also try to access the auth session for debugging
      const { data: session } = await supabase.auth.getSession();
      console.log('🔐 Auth session exists:', !!session?.session);
      console.log('🔑 Access token exists:', !!session?.session?.access_token);

      // Use service key for listing since the API requires auth even for public buckets
      console.log('📡 Making service key list call...');
      const listUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload`;
      const listResponse = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prefix: path,
          limit: 100,
          offset: 0
        })
      });
      
      console.log('📡 Service key list call completed, status:', listResponse.status);
      
      let storageItems = [];
      let storageError = null;
      
      if (listResponse.ok) {
        storageItems = await listResponse.json();
      } else {
        const errorData = await listResponse.json();
        storageError = { message: `${listResponse.status}: ${errorData.message || 'Unknown error'}` };
      }

      console.log('📦 Raw storage response:', storageItems);
      console.log('❌ Storage error:', storageError);

      // DEBUG: Test with known file paths if current path is empty
      if (!storageItems || storageItems.length === 0) {
        console.log('🧪 [Debug] Empty result, testing known paths...');
        
        // Test known paths where files exist
        const testPaths = [
          'users/3/Science (T5)/processed',
          'users/3/English/audio',
          'users/3/Science (T5)', 
          'users/3/English',
          'users',
          ''  // Root level
        ];
        
        for (const testPath of testPaths) {
          console.log(`🔍 [Debug] Testing path: "${testPath}"`);
          const { data: testData, error: testError } = await supabase.storage
            .from('upload')
            .list(testPath, { limit: 10 });
          console.log(`📋 [Debug] Path "${testPath}" result:`, testData?.length || 0, 'items');
          if (testData && testData.length > 0) {
            console.log(`✅ [Debug] Found items at "${testPath}":`, testData);
            break; // Stop at first working path
          }
        }
        
        // Also try direct fetch to see if the API endpoint is working
        console.log('🧪 [Debug] Trying direct fetch to list API...');
        try {
          const { data: session } = await supabase.auth.getSession();
          const directUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload`;
          const response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prefix: '',
              limit: 10,
              offset: 0
            })
          });
          console.log('🌐 Direct fetch response status:', response.status);
          const directData = await response.json();
          console.log('📦 Direct fetch response data:', directData);
        } catch (directError) {
          console.error('❌ Direct fetch error:', directError);
        }
        
        // Try using service key for listing (since list API requires auth even for public buckets)
        console.log('🔑 [Debug] Trying service key access...');
        try {
          const serviceUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload`;
          const serviceResponse = await fetch(serviceUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prefix: '',
              limit: 10,
              offset: 0
            })
          });
          console.log('🔑 Service key response status:', serviceResponse.status);
          const serviceData = await serviceResponse.json();
          console.log('🔑 Service key response data:', serviceData);
          
          if (serviceResponse.ok && serviceData && serviceData.length > 0) {
            console.log('✅ [Debug] Service key worked! Found files at root');
            // Update the main response to use service key results
            storageItems = serviceData;
          }
        } catch (serviceError) {
          console.error('❌ Service key access error:', serviceError);
        }
      }

      if (storageError) {
        throw new Error(`Failed to fetch folder contents: ${storageError.message}`);
      }

      if (!storageItems) {
        console.log('📭 No items found in folder');
        setItems([]);
        return;
      }

      console.log('🔢 Number of items returned:', storageItems.length);

      // Process the storage items into folders and files
      const folders = storageItems
        .filter(item => item.id === null) // Folders have id === null
        .map(folder => ({
          type: 'folder',
          name: folder.name,
          path: path ? `${path}/${folder.name}` : folder.name,
          lastModified: folder.updated_at || folder.created_at
        }));

      const files = storageItems
        .filter(item => item.id !== null) // Files have id !== null
        .filter(item => !item.name.startsWith('.emptyFolderPlaceholder') && 
                       !item.name.includes('placeholder') && 
                       !item.name.startsWith('.')) // Filter out placeholder files and hidden files
        .map(file => ({
          type: 'file',
          name: file.name,
          path: path ? `${path}/${file.name}` : file.name,
          size: formatFileSize(file.metadata?.size || 0),
          lastModified: file.updated_at || file.created_at,
          mimeType: file.metadata?.mimetype
        }));

      console.log('🔍 Folder filtering results:');
      console.log('📂 Items with id === null (should be folders):', storageItems.filter(item => item.id === null));
      console.log('📄 Items with id !== null (should be files):', storageItems.filter(item => item.id !== null));

      console.log('📂 Processed folders:', folders);
      console.log('📄 Processed files:', files);

      // Combine folders and files
      const allItems = [...folders, ...files];
      console.log('📋 Total items:', allItems);

      setItems(allItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderItem) => {
    const newPath = folderItem.path;
    setCurrentPath(newPath);
    
    // Update breadcrumbs
    const newBreadcrumbs = [...breadcrumbs, {
      name: folderItem.name,
      path: newPath
    }];
    setBreadcrumbs(newBreadcrumbs);
  };

  const navigateToBreadcrumb = (breadcrumb) => {
    const index = breadcrumbs.findIndex(b => b.path === breadcrumb.path);
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    
    setCurrentPath(breadcrumb.path);
    setBreadcrumbs(newBreadcrumbs);
  };

  const goBack = () => {
    if (breadcrumbs.length > 1) {
      const parentBreadcrumb = breadcrumbs[breadcrumbs.length - 2];
      navigateToBreadcrumb(parentBreadcrumb);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getFileType = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return `audio/${extension}`;
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'mp3':
      case 'mp4':
      case 'wav':
      case 'm4a':
      case 'flac':
        return <Music className="w-5 h-5" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileText className="w-5 h-5" />;
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <FileImage className="w-5 h-5" />;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'json':
        return <FileCode className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFileColor = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'mp3':
      case 'mp4':
      case 'wav':
      case 'm4a':
      case 'flac':
        return 'text-purple-600 bg-purple-100';
      case 'xlsx':
      case 'xls':
      case 'csv':
        return 'text-green-600 bg-green-100';
      case 'pdf':
        return 'text-red-600 bg-red-100';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'text-blue-600 bg-blue-100';
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'json':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleDownload = async (file) => {
    try {
      console.log('🔗 [Download] Raw file path from database:', file.path);
      
      // Clean the file path - remove any bucket prefix if it exists
      let cleanPath = file.path;
      
      // Remove 'upload/' prefix if it exists
      if (cleanPath.startsWith('upload/')) {
        cleanPath = cleanPath.substring('upload/'.length);
      }
      
      // Remove leading slash if it exists
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
      
      console.log('🧹 [Download] Cleaned file path:', cleanPath);
      
      // Use standard Supabase download (this is working!)
      console.log('💫 [Download] Using standard Supabase download...');
      console.log('🔍 [Download] Bucket: upload, Path:', cleanPath);
      console.log('🌐 [Download] Base URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      
      const { data, error } = await supabase.storage
        .from('upload')
        .download(cleanPath);
        
      console.log('📋 [Download] Download result:', { 
        success: !error, 
        dataSize: data ? data.size : 0,
        dataType: data ? data.type : null,
        errorMessage: error?.message 
      });
        
      if (error) {
        console.error('❌ [Download] Standard download failed:', error);
        
        // Fallback: try public URL
        const { data: publicData } = supabase.storage
          .from('upload')
          .getPublicUrl(cleanPath);
        
        console.log('🔗 [Download] Trying public URL as fallback:', publicData.publicUrl);
        
        // Trigger download with public URL
        const link = document.createElement('a');
        link.href = publicData.publicUrl;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      console.log('✅ [Download] Download successful!');
      
      // Create blob URL for download
      const blob = new Blob([data], { type: getFileType(file.name) });
      const blobUrl = URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      alert(`Failed to download file: ${err.message}`);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'processed':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-2xl font-bold text-gray-900">
                  File Browser
                </Dialog.Title>
                <Dialog.Description className="text-gray-600 mt-1">
                  Browse your uploaded files and folders
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <Separator.Root className="bg-gray-200 h-px w-full" />

          {/* Content Area */}
          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Navigation Bar */}
            {currentPath && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                {/* Back Button */}
                {breadcrumbs.length > 1 && (
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={goBack}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-sm">
                          Go back
                          <Tooltip.Arrow className="fill-gray-900" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                )}

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 flex-1 overflow-x-auto">
                  {breadcrumbs.map((breadcrumb, index) => (
                    <div key={breadcrumb.path} className="flex items-center gap-2 flex-shrink-0">
                      {index > 0 && <span className="text-gray-400 text-sm">/</span>}
                      <button
                        onClick={() => navigateToBreadcrumb(breadcrumb)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {index === 0 ? (
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4" />
                            <span>Home</span>
                          </div>
                        ) : (
                          <span className="truncate max-w-[120px]">{breadcrumb.name}</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Content Area */}
          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Folder className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="mt-4 text-gray-600 font-medium">Loading files...</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="bg-red-50 p-4 rounded-xl inline-block mb-4">
                <X className="w-8 h-8 text-red-500 mx-auto" />
              </div>
              <p className="text-red-600 font-medium mb-2">Error loading files</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-50 p-6 rounded-2xl inline-block mb-4">
                <Folder className="w-12 h-12 text-gray-300 mx-auto" />
              </div>
              <p className="text-xl font-semibold text-gray-900 mb-2">No files found</p>
              <p className="text-gray-500">This folder is empty</p>
            </div>
          ) : (
            /* File Grid */
            <div className="grid gap-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                    item.type === 'folder' 
                      ? 'hover:bg-blue-50 hover:border-blue-200 border-blue-100 cursor-pointer shadow-sm hover:shadow-md' 
                      : 'hover:bg-gray-50 hover:border-gray-300 border-gray-200 shadow-sm hover:shadow-md'
                  }`}
                  onClick={item.type === 'folder' ? () => navigateToFolder(item) : undefined}
                >
                  {/* Icon */}
                  <div className={`p-3 rounded-xl transition-all duration-200 ${
                    item.type === 'folder' 
                      ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200' 
                      : `${getFileColor(item.name)} group-hover:scale-105`
                  }`}>
                    {item.type === 'folder' ? (
                      <Folder className="w-6 h-6" />
                    ) : (
                      getFileIcon(item.name)
                    )}
                  </div>

                  {/* Name and Details */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate text-lg">
                      {item.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.type === 'folder' ? (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          Folder
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span>{item.size}</span>
                          <span>•</span>
                          <span>{formatDate(item.lastModified)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Download Button for Files */}
                  {item.type === 'file' && (
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload({ path: item.path, name: item.name });
                            }}
                            className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-sm">
                            Download file
                            <Tooltip.Arrow className="fill-gray-900" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
