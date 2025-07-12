'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';
import { getAuth, signOut } from 'firebase/auth';
import firebaseApp from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { LogOut, Bot, LayoutDashboard, FileText, Folder, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const { user, setUser } = useUser();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [summary, setSummary] = useState({ classes: 0, lectures: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filterClass, setFilterClass] = useState('');
  const [tableLoading, setTableLoading] = useState(false);

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

        setSummary({
          classes: classesData?.length || 0,
          lectures: lecturesData?.length || 0,
        });

        await fetchTableData(userId);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
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

  const teachingStyleData = [
    { style: 'Lecture', percentage: 40 },
    { style: 'Discussion', percentage: 25 },
    { style: 'Q&A', percentage: 15 },
    { style: 'Group Work', percentage: 10 },
    { style: 'Other', percentage: 10 },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-lg p-8 space-y-8 hidden md:block">
        <div className="flex items-center space-x-2">
          <LayoutDashboard className="text-white" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div>
          <p className="text-blue-100 text-sm">Hello 👋</p>
          <p className="text-lg font-medium">{userData?.first_name || 'User'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white hover:cursor-pointer px-4 py-2 rounded transition shadow"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 space-y-8 bg-gradient-to-br from-blue-50 to-white min-h-screen text-gray-900">
        {/* Top bar (navbar feel) */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-blue-800">Teaching Analytics Dashboard</h1>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 text-center transition hover:scale-105">
            <Folder className="text-blue-500 w-8 h-8 mx-auto mb-2" />
            <h2 className="text-3xl font-bold text-blue-600">{summary.classes}</h2>
            <p className="text-gray-500">Classes</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 text-center transition hover:scale-105">
            <FileText className="text-green-500 w-8 h-8 mx-auto mb-2" />
            <h2 className="text-3xl font-bold text-green-600">{summary.lectures}</h2>
            <p className="text-gray-500">Lectures</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 text-center transition hover:scale-105">
            <FileText className="text-green-500 w-8 h-8 mx-auto mb-2" />
            <h2 className="text-3xl font-bold text-green-600">N</h2>
            <p className="text-gray-500">Chat Sessions</p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6">
          <h3 className="text-blue-700 font-semibold mb-4">Teaching Style Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={teachingStyleData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="style" />
              <YAxis />
              <Tooltip />
              {/* <Bar dataKey="percentage" fill="#2563eb"/> */}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class + File Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
            <input
              type="text"
              placeholder="Filter by class name..."
              className="border rounded px-3 py-2 w-full md:w-1/3"
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
            />
            <button
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition shadow hover:cursor-pointer"
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
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
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
                      <tr key={item.class_id} className="border-b">
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
                            className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition shadow hover:cursor-pointer"
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
