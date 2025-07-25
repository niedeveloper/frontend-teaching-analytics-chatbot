import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { askChatbot, fetchLessonSummaries } from "../lib/api";
import ReactMarkdown from "react-markdown";
import Modal from "./Modal";
import { useUser } from "../context/UserContext";
import React from "react";

// Inline summary table component for chat
function InlineSummaryTable({ fileSummaries }) {
  // Reuse Modal's parsing logic
  const TEACHING_AREA_CODES = [
    "1.1 Establishing Interaction and rapport",
    "1.2 Setting and Maintaining Rules and Routine",
    "3.1 Activating prior knowledge",
    "3.2 Motivating learners for learning engagement",
    "3.3 Using Questions to deepen learning",
    "3.4 Facilitating collaborative learning",
    "3.5 Concluding the lesson",
    "4.1 Checking for understanding and providing feedback",
  ];
  function parseTeachingAreaStats(summary) {
    const lines = summary.split("\n");
    const stats = {};
    let inStats = false;
    for (const line of lines) {
      if (line.startsWith("TEACHING AREA STATISTICS:")) {
        inStats = true;
        continue;
      }
      if (inStats) {
        if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) break;
        const match = line.match(/^([^.]+\.\d [^:]+): (\d+) utterances \(([^)]+)%\)(?: - (\d+) questions)?/);
        if (match) {
          stats[match[1].trim()] = {
            value: parseInt(match[2], 10),
            percent: parseFloat(match[3]),
            questions: match[4] ? parseInt(match[4], 10) : undefined,
          };
        }
      }
    }
    TEACHING_AREA_CODES.forEach((code) => {
      if (!stats[code]) stats[code] = { value: 0, percent: 0, questions: 0 };
    });
    return stats;
  }
  function statsToTable(statsObj) {
    return TEACHING_AREA_CODES.map((code) => ({
      name: code,
      value: statsObj[code]?.value || 0,
      percent: statsObj[code]?.percent || 0,
      questions: statsObj[code]?.questions || 0,
    }));
  }
  // Parse QUESTION ANALYSIS section
  function parseSection(summary, sectionHeader) {
    const lines = summary.split("\n");
    const sectionLines = [];
    let inSection = false;
    for (const line of lines) {
      if (line.startsWith(sectionHeader)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (line.trim() === "" || line.match(/^([A-Z ]+):/)) break;
        sectionLines.push(line.trim());
      }
    }
    // Parse lines like '- Key: Value' into { key, value }
    return sectionLines
      .map((line) => {
        const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
        if (match) {
          return { key: match[1].trim(), value: match[2].trim() };
        }
        return null;
      })
      .filter(Boolean);
  }
  // Render a table for each file
  return (
    <div className="flex flex-row gap-6 overflow-x-auto pb-2">
      {fileSummaries.map((file, idx) => {
        const summary = (file.data_summary || "").replace(/\\n/g, "\n");
        const stats = parseTeachingAreaStats(summary);
        const tableData = statsToTable(stats);
        // Find the row with the highest percent
        const maxPercent = Math.max(...tableData.map((row) => row.percent));
        const questionAnalysis = parseSection(summary, "QUESTION ANALYSIS:");
        const keyInsights = parseSection(summary, "KEY INSIGHTS:");
        return (
          <div
            key={file.file_id || idx}
            className="min-w-[400px] max-w-[450px] flex-shrink-0 overflow-x-auto mb-6 bg-white rounded-lg shadow p-3"
          >
            <div className="font-semibold mb-1 text-blue-700">
              {file.stored_filename || `File #${idx + 1}`}
            </div>
            <table className="min-w-[350px] border text-xs bg-white rounded shadow mb-3">
              <thead>
                <tr>
                  <th className="border px-2 py-1">Teaching Area</th>
                  <th className="border px-2 py-1">Utterances</th>
                  <th className="border px-2 py-1">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr
                    key={row.name}
                    className={row.percent === maxPercent ? "bg-yellow-200" : ""}
                  >
                    <td className="border px-2 py-1 text-left">{row.name}</td>
                    <td className="border px-2 py-1 text-center">{row.value}</td>
                    <td className="border px-2 py-1 text-center">{row.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {questionAnalysis.length > 0 && (
              <div className="mb-2">
                <div className="font-semibold text-blue-700 mb-1">Question Analysis</div>
                <ul className="list-disc pl-5 text-xs">
                  {questionAnalysis.map((item, i) => (
                    <li key={i}><span className="font-medium">{item.key}:</span> {item.value}</li>
                  ))}
                </ul>
              </div>
            )}
            {keyInsights.length > 0 && (
              <div>
                <div className="font-semibold text-blue-700 mb-1">Key Insights</div>
                <ul className="list-disc pl-5 text-xs">
                  {keyInsights.map((item, i) => (
                    <li key={i}><span className="font-medium">{item.key}:</span> {item.value}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Helper to detect summary requests
function isSummaryRequest(text) {
  return /summary|summarize|data overview|lesson overview/i.test(text);
}

// Helper to generate unique IDs for messages
function uniqueId() {
  return Date.now() + Math.random();
}

export default function Chatbot({ fileIds }) {
  const [fileNames, setFileNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [botLoading, setBotLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const { user } = useUser();

  // Session info
  const [sessionId] = useState(() =>
    crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  );
  const [startedAt] = useState(() => new Date().toISOString());

  const [fileSummaries, setFileSummaries] = useState([]);

  // Ref to always have the latest messages
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handler to save session and navigate
  const handleBackToDashboard = async () => {
    const hasUserMessage = messages.some((msg) => msg.role === "user");
    if (!hasUserMessage || !user?.email) {
      router.push("/dashboard");
      return;
    }
    const endedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("users")
      .select("user_id")
      .eq("email", user.email)
      .single();
    if (error || !data) {
      console.error("Failed to fetch user_id:", error);
      router.push("/dashboard");
      return;
    }
    const user_id = data.user_id;

    // Transform messages to API format for consistent storage
    const conversationForStorage = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const { error: insertError } = await supabase
      .from("chatbot_sessions")
      .insert([
        {
          session_id: sessionId,
          user_id,
          file_ids: fileIds,
          conversation: conversationForStorage,
          started_at: startedAt,
          ended_at: endedAt,
        },
      ]);
    if (insertError) {
      console.error("Failed to save chat session:", insertError);
    }
    router.push("/dashboard");
  };

  useEffect(() => {
    async function fetchFileNames() {
      if (!fileIds || fileIds.length === 0) {
        setFileNames([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("files")
        .select("file_id, stored_filename")
        .in("file_id", fileIds);
      if (error) {
        setFileNames([]);
      } else {
        setFileNames(data.map((f) => f.stored_filename));
      }
      setLoading(false);
    }
    fetchFileNames();
  }, [fileIds]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!loading && messages.length === 0) {
      setMessages([
        {
          id: 1,
          role: "assistant",
          content:
            fileNames.length > 0
              ? `Hello! I'm your Teaching Analytics Chatbot. I can see you've selected these files to analyze: "${fileNames.join(
                  ", "
                )}". You can ask me anything about these lectures!`
              : "Hello! I'm your Teaching Analytics Chatbot. How can I help you with your lecture questions today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [loading, fileNames, messages.length]);

  const handleSend = async () => {
    if (!input.trim()) return;
    let summaryMessage = null;
    if (isSummaryRequest(input)) {
      // Fetch and display summary table before chatbot response
      const fileSummaries = await fetchLessonSummaries(fileIds);
      summaryMessage = {
        id: messages.length + 1,
        role: "assistant",
        type: "summary-table",
        fileSummaries,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, {
        id: messages.length + 2,
        role: "user",
        content: input,
        timestamp: new Date(),
      }, summaryMessage]);
    } else {
      setMessages((prev) => [...prev, {
        id: messages.length + 1,
        role: "user",
        content: input,
        timestamp: new Date(),
      }]);
    }
    setInput("");
    setBotLoading(true);

    try {
      // Only include user/assistant messages with string content in history
      const conversationHistory = messages
        .filter((msg) =>
          (!msg.type || msg.type === undefined) &&
          msg.role &&
          typeof msg.content === "string" &&
          msg.content.trim() !== ""
        )
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
      if (!isSummaryRequest(input)) {
        conversationHistory.push({ role: "user", content: input });
      }
      const reader = await askChatbot({
        fileIds,
        question: input,
        conversation_history: conversationHistory,
      });
      let botText = "";
      let done = false;
      let botMessageId = messages.length + (summaryMessage ? 3 : 2);
      let assistantMessageAdded = false;
      const decoder = new TextDecoder();
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          botText += chunk;
          if (!assistantMessageAdded) {
            setMessages((prev) => [
              ...prev,
              {
                id: botMessageId,
                role: "assistant",
                content: botText,
                timestamp: new Date(),
              },
            ]);
            assistantMessageAdded = true;
            setBotLoading(false);
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessageId ? { ...msg, content: botText } : msg
              )
            );
          }
        }
      }
      setBotLoading(false);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: messages.length + (summaryMessage ? 3 : 2),
          role: "assistant",
          content: "Error contacting backend.",
          timestamp: new Date(),
        },
      ]);
      setBotLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const fetchFileSummaries = async () => {
    if (!fileIds || fileIds.length === 0) return;
    const { data, error } = await supabase
      .from("files")
      .select("file_id, stored_filename, data_summary")
      .in("file_id", fileIds);
    if (!error && data) setFileSummaries(data);
  };

  // Call this when opening the modal:
  const handleOpenModal = async () => {
    await fetchFileSummaries();
    setShowModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <div className="bg-blue-600 text-white p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-full flex items-center justify-center w-10 h-10 shadow-sm">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.93V19a1 1 0 11-2 0v-2.07A8.001 8.001 0 014 12a8 8 0 0116 0 8.001 8.001 0 01-7 6.93z" />
            </svg>
          </div>
          <div>
            <h5 className="mb-0 font-bold">Teaching Analytics Chatbot</h5>
            <small className="opacity-75">
              Ask questions about your lectures
            </small>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-white text-blue-600 font-semibold px-4 py-2 rounded shadow hover:bg-blue-50 hover:cursor-pointer transition shadow"
            onClick={handleOpenModal}
          >
            View Summary
          </button>
          <button
            className="bg-white text-blue-600 font-semibold px-4 py-2 rounded shadow hover:bg-blue-50 hover:cursor-pointer transition"
            onClick={handleBackToDashboard}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {fileNames.length > 0 && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="text-blue-700 font-semibold mb-1">
            <svg
              className="inline w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 17v-2a4 4 0 014-4h3a4 4 0 014 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            Selected Files for Analysis
          </div>
          <div className="text-sm mb-2">
            You've selected <strong>{fileNames.length} file(s)</strong>. You can
            now ask me anything about these lectures!
          </div>
          <div className="flex flex-wrap gap-2">
            {fileNames.map((name, idx) => (
              <span
                key={idx}
                className="bg-blue-600 text-white rounded px-2 py-1 text-xs"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-white">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-3 flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-2xl shadow px-4 py-2 max-w-[70%] ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <div>
                {msg.type === "summary-table" ? (
                  <InlineSummaryTable fileSummaries={msg.fileSummaries} />
                ) : msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              <div
                className={`text-xs mt-1 ${
                  msg.role === "user" ? "text-blue-200" : "text-gray-400"
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {botLoading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl shadow px-4 py-2 max-w-[70%] bg-gray-100 text-gray-800 flex items-center gap-2">
              <svg
                className="w-4 h-4 animate-spin text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                ></path>
              </svg>
              Analyzing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            className="flex-1 border rounded-2xl px-4 py-2 shadow-sm resize-none focus:outline-blue-400"
            placeholder={
              fileNames.length > 0
                ? "Ask me anything about your selected lectures..."
                : "Type your message here..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ minHeight: 40, maxHeight: 120 }}
            disabled={loading || botLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow disabled:opacity-50"
            disabled={!input.trim() || botLoading || loading}
            aria-label="Send"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.94 2.94a1.5 1.5 0 012.12 0l12 12a1.5 1.5 0 01-2.12 2.12l-12-12a1.5 1.5 0 010-2.12z" />
              <path d="M2.94 17.06a1.5 1.5 0 002.12 0l12-12a1.5 1.5 0 00-2.12-2.12l-12 12a1.5 1.5 0 000 2.12z" />
            </svg>
          </button>
        </form>
        <div className="text-center mt-2">
          <small className="text-gray-400">
            Press Enter to send, Shift+Enter for new line
          </small>
        </div>
      </div>
      {/* Place Modal here, outside of other divs */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        fileSummaries={fileSummaries}
      />
    </div>
  );
}
