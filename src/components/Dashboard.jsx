"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";
import { getAuth, signOut } from "firebase/auth";
import firebaseApp from "../lib/firebase";
import { supabase } from "../lib/supabaseClient";

import TopNav from "./TopNav.jsx";
import SummaryCards from "./SummaryCard.jsx";
import TrendChart from "./TrendChart.jsx";
import ClassFileTable from "./ClassFileTable.jsx";

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
        await fetchTableData(userId);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100">
      <TopNav userData={userData} handleLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-2 md:px-8 pt-10 space-y-8">
        <SummaryCards summary={summary} />
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
      </div>
    </div>
  );
}
