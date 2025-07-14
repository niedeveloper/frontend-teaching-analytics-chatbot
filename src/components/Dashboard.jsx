'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { getAuth, signOut } from 'firebase/auth';
import firebaseApp from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import {
  LogOut, Bot, LayoutDashboard, FileText, Folder, Check, User2,
} from 'lucide-react';
import ReactD3Cloud from 'react-d3-cloud';

export default function Dashboard() {
  const { user, setUser } = useUser();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [summary, setSummary] = useState({ classes: 0, lectures: 0, chatSessions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [wordCloudWords, setWordCloudWords] = useState([]);

  // Fetch logic (unchanged from before)
  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.email) return;
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('user_id, first_name, email')
          .eq('email', user.email)
          .single();
        if (userError) throw new Error('Failed to fetch user data');
        setUserData(userData);
        const userId = userData.user_id;
        const { data: classesData } = await supabase
          .from('classes')
          .select('class_id')
          .eq('user_id', userId);
        const { data: lecturesData } = await supabase
          .from('files')
          .select('file_id, classes!inner(user_id)')
          .eq('classes.user_id', userId);
        const { count: chatSessionsCount, error: chatSessionsError } = await supabase
          .from('chatbot_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (chatSessionsError) throw new Error('Error fetching chat sessions count');
        setSummary({
          classes: classesData?.length || 0,
          lectures: lecturesData?.length || 0,
          chatSessions: chatSessionsCount || 0,
        });
        await fetchTableData(userId);
        await fetchWordCloudData(userId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
    // eslint-disable-next-line
  }, [user]);

  const fetchTableData = async (userId) => {
    setTableLoading(true);
    try {
      const { data } = await supabase
        .from('classes')
        .select(`
          class_id,
          class_name,
          files (
            file_id,
            stored_filename
          )
        `)
        .eq('user_id', userId);
      setTableData(data || []);
    } finally {
      setTableLoading(false);
    }
  };

  const handleFileSelection = (fileId, isChecked) => {
    if (isChecked) {
      setSelectedFiles(prev => [...prev, fileId]);
    } else {
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleGoToChatbot = () => {
    if (selectedFiles.length > 0) {
      router.push(`/chatbot?files=${selectedFiles.join(',')}`);
    } else {
      alert('Please select at least one file.');
    }
  };

  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    await signOut(auth);
    setUser(null);
    router.push('/login');
  };

  const filteredTableData = tableData.filter(item =>
    item.class_name?.toLowerCase().includes(filterClass.toLowerCase())
  );

  const fetchWordCloudData = async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('chatbot_sessions')
      .select('conversation')
      .eq('user_id', userId);
    if (error) return;
    const allText = (data || [])
      .flatMap(session => session.conversation?.map?.(msg => msg.content) ?? [])
      .join(' ')
      .toLowerCase();
    const stopwords = new Set([
      'the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'for', 'on', 'that', 'with', 'as', 'was', 'at', 'by',
      'an', 'be', 'this', 'are', 'from', 'or', 'but', 'not', 'have', 'has', 'had', 'you', 'i', 'we', 'they',
      'he', 'she', 'his', 'her', 'their', 'my', 'me', 'our', 'your', 'so', 'if', 'can', 'will', 'just', 'do',
      'did', 'does', 'about', 'what', 'which', 'who', 'how', 'when', 'where', 'why', 'all', 'any', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'too', 'very', 's', 't', 'll', 'm', 're',
      've', 'd', 'o', 'y'
    ]);
    const wordCounts = {};
    allText.split(/\s+/).forEach(word => {
      const clean = word.replace(/[^a-zA-Z]/g, '');
      if (clean && !stopwords.has(clean) && clean.length > 2) {
        wordCounts[clean] = (wordCounts[clean] || 0) + 1;
      }
    });
    const words = Object.entries(wordCounts)
      .map(([text, value]) => ({ text, value }))
      .filter(w => w.text.length > 2);
    const sortedWords = words.sort((a, b) => b.value - a.value).slice(0, 40);
    setWordCloudWords(sortedWords);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100">
      {/* Top Nav */}
      <nav className="sticky top-0 z-10 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 shadow-md px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo + Title */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/20 text-white w-10 h-10 flex items-center justify-center font-bold text-lg shadow">
              <LayoutDashboard className="w-6 h-6" />
            </span>
            <span className="ml-2 text-xl font-bold text-white drop-shadow-sm">Teaching Analytics Dashboard</span>
          </div>
          {/* Right */}
          <div className="flex items-center gap-4">
            <span className="text-white/80 font-medium hidden sm:block">
              Hello, {userData?.first_name || "User"}
            </span>
            <span className="bg-white/20 text-white rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg">
              <User2 className="w-6 h-6" />
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/20 text-white hover:bg-red-500/80 hover:text-white px-4 py-2 rounded-full shadow transition font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Content */}
      <div className="max-w-7xl mx-auto px-2 md:px-8 pt-10 space-y-8">
        {/* Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gradient-to-tr from-indigo-100 to-white rounded-2xl shadow-lg border border-indigo-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
            <Folder className="text-indigo-600 w-8 h-8 mb-2" />
            <h2 className="text-3xl font-bold text-indigo-800">{summary.classes}</h2>
            <p className="text-gray-500">Classes</p>
          </div>
          <div className="bg-gradient-to-tr from-green-100 to-white rounded-2xl shadow-lg border border-green-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
            <FileText className="text-green-600 w-8 h-8 mb-2" />
            <h2 className="text-3xl font-bold text-green-800">{summary.lectures}</h2>
            <p className="text-gray-500">Lectures</p>
          </div>
          <div className="bg-gradient-to-tr from-purple-100 to-white rounded-2xl shadow-lg border border-purple-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
            <Bot className="text-purple-600 w-8 h-8 mb-2" />
            <h2 className="text-3xl font-bold text-purple-800">{summary.chatSessions}</h2>
            <p className="text-gray-500">Chat Sessions</p>
          </div>
        </section>
        {/* Word Cloud */}
        <section className="rounded-2xl shadow-lg bg-white/90 border border-blue-100 px-2 md:px-6 py-6 flex flex-col items-center">
          <h2 className="text-indigo-700 font-semibold mb-4 text-lg md:text-xl">Teaching Style Word Cloud</h2>
          {wordCloudWords.length > 0 ? (
            <div className="w-full max-w-lg h-[240px]">
              <ReactD3Cloud
                data={wordCloudWords}
                fontSizeMapper={word => Math.log2(word.value + 1) * 25}
                width={400}
                height={220}
              />
            </div>
          ) : (
            <div className="text-gray-300 text-center">No conversation data yet.</div>
          )}
        </section>
        {/* Table/List */}
        <section className="bg-white/95 rounded-2xl shadow-lg border border-blue-100 p-2 md:p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
            <input
              type="text"
              placeholder="Filter by class name..."
              className="border border-blue-200 rounded-lg px-3 py-2 w-full md:w-1/3 focus:ring focus:ring-blue-200"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            />
            <button
              className={`flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-full font-semibold hover:scale-105 hover:bg-indigo-700 shadow transition
                ${selectedFiles.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
              onClick={handleGoToChatbot}
              disabled={selectedFiles.length === 0}
            >
              <Bot className="w-4 h-4" />
              Chatbot ({selectedFiles.length})
            </button>
          </div>
          <div className="overflow-x-auto">
            {tableLoading ? (
              <div className="text-center py-4">Loading files...</div>
            ) : (
              <>
                <table className="min-w-full text-sm hidden md:table rounded-xl overflow-hidden">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="p-2">
                        <input
                          type="checkbox"
                          onChange={e => {
                            const allIds = filteredTableData.flatMap(item =>
                              item.files?.map(file => file.file_id) || []
                            );
                            setSelectedFiles(e.target.checked ? allIds : []);
                          }}
                          checked={
                            selectedFiles.length > 0 &&
                            selectedFiles.length ===
                              filteredTableData.flatMap(item => item.files?.map(file => file.file_id)).length
                          }
                        />
                      </th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Files</th>
                      <th className="text-center p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableData.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-gray-400 py-4">
                          No classes found.
                        </td>
                      </tr>
                    ) : (
                      filteredTableData.map(item => (
                        <tr key={item.class_id} className="border-b even:bg-blue-50 hover:bg-blue-100 transition">
                          <td className="p-2 align-top">
                            <input
                              type="checkbox"
                              checked={item.files?.every(file => selectedFiles.includes(file.file_id))}
                              onChange={e => {
                                const fileIds = item.files?.map(file => file.file_id) || [];
                                setSelectedFiles(prev =>
                                  e.target.checked
                                    ? [...prev, ...fileIds]
                                    : prev.filter(id => !fileIds.includes(id))
                                );
                              }}
                            />
                          </td>
                          <td className="p-2 font-medium">{item.class_name}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-2">
                              {item.files?.map(file => (
                                <label
                                  key={file.file_id}
                                  className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.file_id)}
                                    onChange={e => handleFileSelection(file.file_id, e.target.checked)}
                                  />
                                  {file.stored_filename}
                                </label>
                              )) || <span className="text-gray-400">No files</span>}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => {
                                const fileIds = item.files?.map(file => file.file_id) || [];
                                if (fileIds.length > 0) setSelectedFiles(fileIds);
                              }}
                              className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white shadow transition"
                            >
                              <Check className="w-3 h-3 inline mr-1" />
                              Select All
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {/* Mobile card view */}
                <div className="flex flex-col gap-4 md:hidden">
                  {filteredTableData.length === 0 ? (
                    <div className="text-center text-gray-400 py-6">No classes found.</div>
                  ) : (
                    filteredTableData.map(item => (
                      <div key={item.class_id} className="bg-blue-50 rounded-xl p-4 shadow flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{item.class_name}</div>
                          <button
                            onClick={() => {
                              const fileIds = item.files?.map(file => file.file_id) || [];
                              if (fileIds.length > 0) setSelectedFiles(fileIds);
                            }}
                            className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition"
                          >
                            <Check className="w-3 h-3 inline mr-1" />
                            Select All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.files?.map(file => (
                            <label
                              key={file.file_id}
                              className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={selectedFiles.includes(file.file_id)}
                                onChange={e => handleFileSelection(file.file_id, e.target.checked)}
                              />
                              {file.stored_filename}
                            </label>
                          )) || <span className="text-gray-400">No files</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
