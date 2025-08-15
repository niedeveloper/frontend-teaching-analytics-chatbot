"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { getAuth, signOut } from "firebase/auth";
import firebaseApp from "../lib/firebase";
import { supabase } from "../lib/supabaseClient";
import { MessageSquare, Eye, Download } from "lucide-react";

import TopNav from "./TopNav.jsx";
import SummaryCards from "./SummaryCard.jsx";
import TrendChart from "./TrendChart.jsx";
import ClassFileTable from "./ClassFileTable.jsx";
import DataUploadForm from "./DataUploadForm.jsx";
import ChatHistoryModal from "./ChatHistoryModal.jsx";

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
      // Collect all unique file IDs from all sessions
      const allFileIds = [...new Set(sessions.flatMap(session => session.file_ids || []))];
      
      if (allFileIds.length === 0) {
        setFileNamesMap({});
        return;
      }
      
      console.log("Fetching file names for IDs:", allFileIds);
      
      // Fetch file names for all unique file IDs
      const { data: files, error } = await supabase
        .from("files")
        .select("file_id, stored_filename")
        .in("file_id", allFileIds);
      
      if (error) {
        console.error("Error fetching file names:", error);
        return;
      }
      
      console.log("Fetched files:", files);
      
      // Create a map of file_id to filename
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
      // Fetch chat sessions directly by user_id
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
        .limit(10); // Show last 10 sessions
      
      if (sessionsError) {
        console.error("Error fetching chat sessions:", sessionsError);
        throw sessionsError;
      }
      
      console.log("User ID:", userId);
      console.log("Fetched chat sessions:", sessions);
      
      // Set the sessions directly - we don't need to fetch files separately for display
      setChatSessions(sessions || []);
      
      // Fetch file names for all sessions
      await fetchFileNamesForSessions(sessions || []);
      
    } catch (err) {
      console.error("Failed to fetch chat sessions:", err);
      setChatSessions([]);
    } finally {
      setChatHistoryLoading(false);
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
    // TODO: Implement resume functionality later
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

  // filteredTableData logic for the table component
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
    
    // Get the actual file names from our map
    const names = fileIds.map(id => fileNamesMap[id]).filter(Boolean);
    
    if (names.length === 0) {
      // Fallback to count if names haven't loaded yet
      return fileIds.length === 1 ? `1 file` : `${fileIds.length} files`;
    }
    
    // Remove .xlsx extension from all names
    const cleanNames = names.map(name => name.replace(/\.xlsx$/i, ''));
    
    // Display file names, showing at least 5 if available
    if (cleanNames.length === 1) {
      return cleanNames[0];
    } else if (cleanNames.length === 2) {
      return `${cleanNames[0]}, ${cleanNames[1]}`;
    } else if (cleanNames.length <= 5) {
      // Show all names if 5 or fewer
      return cleanNames.join(', ');
    } else {
      // Show first 5 names + count of remaining
      const firstFive = cleanNames.slice(0, 5).join(', ');
      const remaining = cleanNames.length - 5;
      return `${firstFive} +${remaining} more`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100">
      <TopNav userData={userData} handleLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-2 md:px-8 pt-10 space-y-8">
        <SummaryCards summary={summary} />
        <DataUploadForm />
        <TrendChart />
        <ClassFileTable
          filterClass={filterClass}
          setFilterClass={setFilterClass}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          filteredTableData={filteredTableData}
          tableLoading={tableLoading}
          handleFileSelection={handleFileSelection}
          handleGoToChatbot={handleGoToChatbot}
        />
        
        {/* Chat History Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Recent Chat Sessions</h3>
              <p className="text-gray-600">View and download your recent conversations with the teaching analytics chatbot</p>
            </div>
          </div>

          {chatHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading chat sessions...</span>
            </div>
          ) : chatSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No chat sessions yet. Start a conversation to see your history here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Conversation</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Files Analyzed</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Duration</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Messages</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {chatSessions.map((session) => (
                    <tr key={session.session_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                                                 <div className="text-sm font-medium text-gray-900">
                           {`Chat Session - ${formatDate(session.started_at)}`}
                         </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(session.started_at)} • ID: {session.session_id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          <div className="break-words">
                            {getFileNames(session.file_ids)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {formatDuration(session.started_at, session.ended_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {session.conversation?.length || 0} messages
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResumeChat(session)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Resume
                          </button>
                          <button
                            onClick={() => handleViewChat(session)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Chat History Modal */}
      <ChatHistoryModal
        open={showChatHistoryModal}
        onClose={() => setShowChatHistoryModal(false)}
        chatSession={selectedChatSession}
        fileSummaries={selectedChatSession?.files || []}
      />
    </div>
  );
}
