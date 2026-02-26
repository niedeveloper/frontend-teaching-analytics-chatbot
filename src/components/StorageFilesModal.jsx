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
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (open && user?.email) {
      initializeUserBrowser();
    }
  }, [open, user]);

  useEffect(() => {
    if (userId && open && currentPath) {
      fetchFolderContents(currentPath);
    }
  }, [userId, open, currentPath]);

  const initializeUserBrowser = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", user.email)
        .single();

      if (userError || !userData) {
        throw new Error("User not found");
      }

      const userId = userData.user_id;
      const initialPath = `users/${userId}`;

      setUserId(userId);
      setCurrentPath(initialPath);
      setBreadcrumbs([{ name: 'Home', path: initialPath }]);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchFolderContents = async (path) => {
    try {
      setLoading(true);
      setError(null);

      const listUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/upload`;
      const listResponse = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefix: path, limit: 100, offset: 0 })
      });

      let storageItems = [];
      let storageError = null;

      if (listResponse.ok) {
        storageItems = await listResponse.json();
      } else {
        const errorData = await listResponse.json();
        storageError = { message: `${listResponse.status}: ${errorData.message || 'Unknown error'}` };
      }

      if (storageError) {
        throw new Error(`Failed to fetch folder contents: ${storageError.message}`);
      }

      if (!storageItems) {
        setItems([]);
        return;
      }

      const folders = storageItems
        .filter(item => item.id === null)
        .map(folder => ({
          type: 'folder',
          name: folder.name,
          path: path ? `${path}/${folder.name}` : folder.name,
          lastModified: folder.updated_at || folder.created_at
        }));

      const files = storageItems
        .filter(item => item.id !== null)
        .filter(item => !item.name.startsWith('.emptyFolderPlaceholder') &&
                       !item.name.includes('placeholder') &&
                       !item.name.startsWith('.'))
        .map(file => ({
          type: 'file',
          name: file.name,
          path: path ? `${path}/${file.name}` : file.name,
          size: formatFileSize(file.metadata?.size || 0),
          lastModified: file.updated_at || file.created_at,
          mimeType: file.metadata?.mimetype
        }));

      setItems([...folders, ...files]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderItem) => {
    const newPath = folderItem.path;
    setCurrentPath(newPath);
    setBreadcrumbs([...breadcrumbs, { name: folderItem.name, path: newPath }]);
  };

  const navigateToBreadcrumb = (breadcrumb) => {
    const index = breadcrumbs.findIndex(b => b.path === breadcrumb.path);
    setCurrentPath(breadcrumb.path);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const goBack = () => {
    if (breadcrumbs.length > 1) {
      navigateToBreadcrumb(breadcrumbs[breadcrumbs.length - 2]);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileType = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return `audio/${extension}`;
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'mp3': case 'mp4': case 'wav': case 'm4a': case 'flac':
        return <Music className="w-5 h-5" />;
      case 'xlsx': case 'xls': case 'csv': case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp':
        return <FileImage className="w-5 h-5" />;
      case 'js': case 'ts': case 'jsx': case 'tsx': case 'json':
        return <FileCode className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFileColor = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'mp3': case 'mp4': case 'wav': case 'm4a': case 'flac':
        return 'text-purple-600 bg-purple-100';
      case 'xlsx': case 'xls': case 'csv':
        return 'text-green-600 bg-green-100';
      case 'pdf':
        return 'text-red-600 bg-red-100';
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp':
        return 'text-blue-600 bg-blue-100';
      case 'js': case 'ts': case 'jsx': case 'tsx': case 'json':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleDownload = async (file) => {
    try {
      let cleanPath = file.path;
      if (cleanPath.startsWith('upload/')) cleanPath = cleanPath.substring('upload/'.length);
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);

      const { data, error } = await supabase.storage.from('upload').download(cleanPath);

      if (error) {
        const { data: publicData } = supabase.storage.from('upload').getPublicUrl(cleanPath);
        const link = document.createElement('a');
        link.href = publicData.publicUrl;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const blob = new Blob([data], { type: getFileType(file.name) });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-5xl translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white">
                  File Browser
                </Dialog.Title>
                <Dialog.Description className="text-gray-600 dark:text-gray-400 mt-1">
                  Browse your uploaded files and folders
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <Separator.Root className="bg-gray-200 dark:bg-gray-700 h-px w-full" />

          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            {currentPath && (
              <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl border border-gray-200 dark:border-gray-600">
                {breadcrumbs.length > 1 && (
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={goBack}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

                <div className="flex items-center gap-2 flex-1 overflow-x-auto">
                  {breadcrumbs.map((breadcrumb, index) => (
                    <div key={breadcrumb.path} className="flex items-center gap-2 flex-shrink-0">
                      {index > 0 && <span className="text-gray-400 text-sm">/</span>}
                      <button
                        onClick={() => navigateToBreadcrumb(breadcrumb)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
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

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Folder className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading files...</p>
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
                <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-2xl inline-block mb-4">
                  <Folder className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto" />
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No files found</p>
                <p className="text-gray-500 dark:text-gray-400">This folder is empty</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                      item.type === 'folder'
                        ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 border-blue-100 dark:border-blue-900/30 cursor-pointer shadow-sm hover:shadow-md'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md'
                    }`}
                    onClick={item.type === 'folder' ? () => navigateToFolder(item) : undefined}
                  >
                    <div className={`p-3 rounded-xl transition-all duration-200 ${
                      item.type === 'folder'
                        ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                        : `${getFileColor(item.name)} group-hover:scale-105`
                    }`}>
                      {item.type === 'folder' ? <Folder className="w-6 h-6" /> : getFileIcon(item.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate text-lg">
                        {item.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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

                    {item.type === 'file' && (
                      <Tooltip.Provider>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload({ path: item.path, name: item.name });
                              }}
                              className="p-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
