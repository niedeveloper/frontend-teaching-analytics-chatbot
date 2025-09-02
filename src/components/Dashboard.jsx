"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { getAuth, signOut } from "firebase/auth";
import firebaseApp from "../lib/firebase";
import { supabase } from "../lib/supabaseClient";
import { MessageSquare, Eye, Download, Play, Clock, FileText, Hash, Calendar, ArrowRight, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Separator from '@radix-ui/react-separator';

import TopNav from "./TopNav.jsx";
import SummaryCards from "./SummaryCard.jsx";
import TrendChart from "./TrendChart.jsx";
import ClassFileTable from "./ClassFileTable.jsx";
import DataUploadForm from "./DataUploadForm.jsx";
import ChatHistoryModal from "./ChatHistoryModal.jsx";
import StorageFilesModal from "./StorageFilesModal.jsx";

export default function Dashboard() {
  const { user, setUser } = useUser();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [summary, setSummary] = useState({
    classes: 0,
    lectures: 0,
    chatSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [tableLoading, setTableLoading] = useState(false);
  
  // Chat history state
  const [chatSessions, setChatSessions] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [selectedChatSession, setSelectedChatSession] = useState(null);
  const [showChatHistoryModal, setShowChatHistoryModal] = useState(false);
  const [fileNamesMap, setFileNamesMap] = useState({});
  const [showStorageFilesModal, setShowStorageFilesModal] = useState(false);
  
  // Task status state
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Ref for ClassFileTable to scroll to
  const classFileTableRef = useRef(null);

  // Data fetching
  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.email) return;
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_id, first_name, email")
          .eq("email", user.email)
          .single();
        if (userError) throw new Error("Failed to fetch user data");
        setUserData(userData);
        const userId = userData.user_id;
        const { data: classesData } = await supabase
          .from("classes")
          .select("class_id")
          .eq("user_id", userId);
        const { data: lecturesData } = await supabase
          .from("files")
          .select("file_id, classes!inner(user_id)")
          .eq("classes.user_id", userId);
        const { count: chatSessionsCount, error: chatSessionsError } =
          await supabase
            .from("chatbot_sessions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);
        if (chatSessionsError)
          throw new Error("Error fetching chat sessions count");
        setSummary({
          classes: classesData?.length || 0,
          lectures: lecturesData?.length || 0,
          chatSessions: chatSessionsCount || 0,
        });
        console.log("User ID for chat sessions:", userId);
        await fetchTableData(userId);
        await fetchChatSessions(userId);
        await fetchTasks(userId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
    // eslint-disable-next-line
  }, [user]);

  const fetchFileNamesForSessions = async (sessions) => {
    try {
      const allFileIds = [...new Set(sessions.flatMap(session => session.file_ids || []))];
      
      if (allFileIds.length === 0) {
        setFileNamesMap({});
        return;
      }
      
      console.log("Fetching file names for IDs:", allFileIds);
      
      const { data: files, error } = await supabase
        .from("files")
        .select("file_id, stored_filename")
        .in("file_id", allFileIds);
      
      if (error) {
        console.error("Error fetching file names:", error);
        return;
      }
      
      console.log("Fetched files:", files);
      
      const fileNamesMap = {};
      files.forEach(file => {
        fileNamesMap[file.file_id] = file.stored_filename;
      });
      
      setFileNamesMap(fileNamesMap);
    } catch (err) {
      console.error("Failed to fetch file names:", err);
    }
  };

  const fetchTableData = async (userId) => {
    setTableLoading(true);
    try {
      const { data } = await supabase
        .from("classes")
        .select(
          `
          class_id,
          class_name,
          files (
            file_id,
            stored_filename
          )
        `
        )
        .eq("user_id", userId);
      setTableData(data || []);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchChatSessions = async (userId) => {
    setChatHistoryLoading(true);
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from("chatbot_sessions")
        .select(`
          session_id,
          started_at,
          ended_at,
          file_ids,
          conversation
        `)
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(10);
      
      if (sessionsError) {
        console.error("Error fetching chat sessions:", sessionsError);
        throw sessionsError;
      }
      
      console.log("User ID:", userId);
      console.log("Fetched chat sessions:", sessions);
      
      setChatSessions(sessions || []);
      await fetchFileNamesForSessions(sessions || []);
      
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
      setChatSessions([]);
    } finally {
      setChatHistoryLoading(false);
    }
  };

  const fetchTasks = async (userId) => {
    setTasksLoading(true);
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          task_id,
          file_id,
          task_type,
          status,
          created_at,
          updated_at,
          started_at,
          completed_at,
          error_message,
          retry_count,
          metadata,
          files!inner(
            stored_filename,
            classes!inner(
              user_id,
              class_name
            )
          )
        `)
        .eq("files.classes.user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        throw tasksError;
      }
      
      console.log("Fetched tasks:", tasksData);
      setTasks(tasksData || []);
      
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleFileSelection = (fileId, isChecked) => {
    setSelectedFiles((prev) =>
      isChecked ? [...prev, fileId] : prev.filter((id) => id !== fileId)
    );
  };

  const handleGoToChatbot = () => {
    if (selectedFiles.length > 0) {
      router.push(`/chatbot?files=${selectedFiles.join(",")}`);
    } else {
      alert("Please select at least one file.");
    }
  };

  const handleViewChat = (session) => {
    setSelectedChatSession(session);
    setShowChatHistoryModal(true);
  };

  const handleResumeChat = (session) => {
    alert("Resume functionality is work in progress. Coming soon!");
  };

  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    await signOut(auth);
    setUser(null);
    router.push("/login");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  if (error) return <div className="text-red-500">{error}</div>;

  const filteredTableData = tableData.filter((item) =>
    item.class_name?.toLowerCase().includes(filterClass.toLowerCase())
  );

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (started, ended) => {
    const duration = new Date(ended) - new Date(started);
    const minutes = Math.round(duration / 1000 / 60);
    return `${minutes} min`;
  };

  const getFileNames = (fileIds) => {
    if (!fileIds || fileIds.length === 0) return "No files";
    const names = fileIds.map(id => fileNamesMap[id]).filter(Boolean);
    if (names.length === 0) {
      return fileIds.length === 1 ? `1 file` : `${fileIds.length} files`;
    }
    const cleanNames = names.map(name => name.replace(/\.xlsx$/i, ''));
    if (cleanNames.length === 1) return cleanNames[0];
    if (cleanNames.length === 2) return `${cleanNames[0]}, ${cleanNames[1]}`;
    if (cleanNames.length <= 5) return cleanNames.join(', ');
    const firstFive = cleanNames.slice(0, 5).join(', ');
    const remaining = cleanNames.length - 5;
    return `${firstFive} +${remaining} more`;
  };

  const getTaskStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          icon: Clock, 
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          label: 'Pending'
        };
      case 'processing':
        return { 
          icon: Loader2, 
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          label: 'Processing'
        };
      case 'completed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-600 bg-green-50 border-green-200',
          label: 'Completed'
        };
      case 'failed':
        return { 
          icon: XCircle, 
          color: 'text-red-600 bg-red-50 border-red-200',
          label: 'Failed'
        };
      default:
        return { 
          icon: AlertCircle, 
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          label: 'Unknown'
        };
    }
  };

  // Function to scroll to the ClassFileTable
  const handleFileTextClick = () => {
    // Scroll to the ClassFileTable
    classFileTableRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to open storage files modal
  const handleLessonsClick = () => {
    setShowStorageFilesModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100">
      <TopNav userData={userData} handleLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-2 md:px-8 pt-10 space-y-8">
        <SummaryCards 
          summary={summary} 
          handleFileTextClick={handleFileTextClick} // Pass the function as prop
          handleLessonsClick={handleLessonsClick} // Pass the new lessons handler
        />
        <DataUploadForm />
        <TrendChart />

        {/* ClassFileTable is always visible */}
        <div ref={classFileTableRef}>
          <ClassFileTable
            filterClass={filterClass}
            setFilterClass={setFilterClass}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            filteredTableData={tableData}
            tableLoading={tableLoading}
            handleFileSelection={handleFileSelection}
            handleGoToChatbot={handleGoToChatbot}
          />
        </div>

        {/* Chat History Section */}
        <Tooltip.Provider>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Recent Conversations</h3>
                    <p className="text-gray-600 mt-1">Your teaching analytics chat history and insights</p>
                  </div>
                </div>
                {chatSessions.length > 0 && (
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {chatSessions.length} session{chatSessions.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">

              {/* Loading State */}
              {chatHistoryLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <p className="mt-4 text-gray-600 font-medium">Loading conversations...</p>
                </div>
              ) : chatSessions.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16">
                  <div className="bg-gray-50 p-6 rounded-2xl inline-block mb-4">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No conversations yet</h4>
                  <p className="text-gray-500 mb-4">Start analyzing your teaching data to see conversations here</p>
                  <button
                    onClick={() => router.push('/chatbot')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Start First Conversation
                  </button>
                </div>
              ) : (
                /* Chat Sessions Grid */
                <div className="grid gap-4">
                  {chatSessions.map((session) => (
                    <div
                      key={session.session_id}
                      className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-200"
                    >
                      {/* Session Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 mb-1">
                            Chat Session
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(session.started_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Hash className="w-4 h-4" />
                              <span>{session.session_id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button
                                onClick={() => handleResumeChat(session)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-all duration-200 focus:ring-2 focus:ring-green-500 focus:outline-none"
                              >
                                <Play className="w-4 h-4" />
                                Resume
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-sm">
                                Continue this conversation
                                <Tooltip.Arrow className="fill-gray-900" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button
                                onClick={() => handleViewChat(session)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="bg-gray-900 text-white px-2 py-1 rounded text-sm">
                                View conversation details
                                <Tooltip.Arrow className="fill-gray-900" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </div>
                      </div>
                      
                      <Separator.Root className="bg-gray-200 h-px w-full mb-4" />
                      
                      {/* Session Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Files Analyzed */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <FileText className="w-4 h-4" />
                            Files Analyzed
                          </div>
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {getFileNames(session.file_ids) || 'No files selected'}
                          </div>
                        </div>
                        
                        {/* Duration */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4" />
                            Duration
                          </div>
                          <div className="text-sm text-gray-900 font-medium">
                            {formatDuration(session.started_at, session.ended_at)}
                          </div>
                        </div>
                        
                        {/* Messages */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <MessageSquare className="w-4 h-4" />
                            Messages
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 font-medium">
                              {session.conversation?.length || 0} messages
                            </span>
                            {(session.conversation?.length || 0) > 0 && (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Tooltip.Provider>

        {/* Task Status Section */}
        <Tooltip.Provider>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-lg">
                    <Loader2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Processing Tasks</h3>
                    <p className="text-gray-600 mt-1">Monitor your file processing status</p>
                  </div>
                </div>
                {tasks.length > 0 && (
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Loading State */}
              {tasksLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-100 border-t-green-600"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="mt-4 text-gray-600 font-medium">Loading tasks...</p>
                </div>
              ) : tasks.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16">
                  <div className="bg-gray-50 p-6 rounded-2xl inline-block mb-4">
                    <CheckCircle className="w-12 h-12 text-gray-300 mx-auto" />
                  </div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">No processing tasks</h4>
                  <p className="text-gray-500 mb-4">Upload some audio files to see processing tasks here</p>
                </div>
              ) : (
                /* Tasks Grid */
                <div className="grid gap-4">
                  {tasks.map((task) => {
                    const statusInfo = getTaskStatusInfo(task.status);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <div
                        key={task.task_id}
                        className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-green-200 transition-all duration-200"
                      >
                        {/* Task Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">
                              {task.files?.stored_filename || 'Unknown File'}
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDate(task.created_at)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Hash className="w-4 h-4" />
                                <span>{task.task_id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${statusInfo.color}`}>
                            <StatusIcon className={`w-4 h-4 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                            <span className="text-sm font-medium">{statusInfo.label}</span>
                          </div>
                        </div>
                        
                        <Separator.Root className="bg-gray-200 h-px w-full mb-4" />
                        
                        {/* Task Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Subject */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <FileText className="w-4 h-4" />
                              Subject
                            </div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {task.files?.classes?.class_name || task.metadata?.subject || 'Unknown'}
                            </div>
                          </div>
                          
                          {/* Task Type */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <Loader2 className="w-4 h-4" />
                              Task Type
                            </div>
                            <div className="text-sm text-gray-900 font-medium">
                              {task.task_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          </div>
                          
                          {/* Retry Count */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <AlertCircle className="w-4 h-4" />
                              Attempts
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 font-medium">
                                {task.retry_count + 1}
                              </span>
                              {task.retry_count > 0 && (
                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                                  Retried
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Error Message */}
                        {task.error_message && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-1">
                              <XCircle className="w-4 h-4" />
                              Error Details
                            </div>
                            <p className="text-sm text-red-700">{task.error_message}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Tooltip.Provider>
      </div>

      {/* Chat History Modal */}
      <ChatHistoryModal
        open={showChatHistoryModal}
        onClose={() => setShowChatHistoryModal(false)}
        chatSession={selectedChatSession}
        fileSummaries={selectedChatSession?.files || []}
      />

      {/* Storage Files Modal */}
      <StorageFilesModal
        open={showStorageFilesModal}
        onClose={() => setShowStorageFilesModal(false)}
      />
    </div>
  );
}
