import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { askChatbot } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal';
import { useUser } from '../context/UserContext';

export default function Chatbot({ fileIds }) {
  const [fileNames, setFileNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const { user } = useUser();

  // Session info
  const [sessionId] = useState(() => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()));
  const [startedAt] = useState(() => new Date().toISOString());

  const [fileSummaries, setFileSummaries] = useState([]);


  // Ref to always have the latest messages
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handler to save session and navigate
  const handleBackToDashboard = async () => {
    const hasUserMessage = messages.some(msg => msg.sender === 'user');
    if (!hasUserMessage || !user?.email) {
      router.push('/dashboard');
      return;
    }
    const endedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', user.email)
      .single();
    if (error || !data) {
      console.error('Failed to fetch user_id:', error);
      router.push('/dashboard');
      return;
    }
    const user_id = data.user_id;
    const { error: insertError } = await supabase.from('chatbot_sessions').insert([
      {
        session_id: sessionId,
        user_id,
        file_ids: fileIds,
        conversation: messages,
        started_at: startedAt,
        ended_at: endedAt,
      }
    ]);
    if (insertError) {
      console.error('Failed to save chat session:', insertError);
    }
    router.push('/dashboard');
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
        .from('files')
        .select('file_id, stored_filename')
        .in('file_id', fileIds);
      if (error) {
        setFileNames([]);
      } else {
        setFileNames(data.map(f => f.stored_filename));
      }
      setLoading(false);
    }
    fetchFileNames();
  }, [fileIds]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!loading && messages.length === 0) {
      setMessages([
        {
          id: 1,
          sender: 'bot',
          text: fileNames.length > 0
            ? `Hello! I'm your Teaching Analytics Chatbot. I can see you've selected these files to analyze: "${fileNames.join(', ')}". You can ask me anything about these lectures!`
            : "Hello! I'm your Teaching Analytics Chatbot. How can I help you with your lecture questions today?",
          timestamp: new Date()
        }
      ]);
    }
  }, [loading, fileNames, messages.length]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      text: input,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setBotLoading(true);

    try {
      const reader = await askChatbot({
        fileIds,
        question: input,
        // conversation_history: [] // add if you want to support history
      });
      let botText = '';
      let done = false;
      let buffer = '';
      let botMessageId = messages.length + 2;
      // Add a placeholder bot message
      setMessages(prev => [
        ...prev,
        {
          id: botMessageId,
          sender: 'bot',
          text: '',
          timestamp: new Date()
        }
      ]);
      const decoder = new TextDecoder();
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          // Split on double newlines (SSE event boundary)
          let eventBoundary;
          while ((eventBoundary = buffer.indexOf('\n\n')) !== -1) {
            const eventStr = buffer.slice(0, eventBoundary).trim();
            buffer = buffer.slice(eventBoundary + 2);
            if (eventStr.startsWith('data:')) {
              const dataStr = eventStr.replace(/^data:\s*/, '');
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === 'content' && data.content) {
                    botText += data.content;
                    setMessages(prev => prev.map(msg =>
                      msg.id === botMessageId ? { ...msg, text: botText } : msg
                    ));
                  }
                  // Optionally handle metadata, complete, error, etc.
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        }
      }
      setBotLoading(false);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: messages.length + 2,
          sender: 'bot',
          text: 'Error contacting backend.',
          timestamp: new Date()
        }
      ]);
      setBotLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const fetchFileSummaries = async () => {
    if (!fileIds || fileIds.length === 0) return;
    const { data, error } = await supabase
      .from('files')
      .select('file_id, stored_filename, data_summary')
      .in('file_id', fileIds);
    console.log('data', data);
    if (!error && data) {
      setFileSummaries(data);
    }
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
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.93V19a1 1 0 11-2 0v-2.07A8.001 8.001 0 014 12a8 8 0 0116 0 8.001 8.001 0 01-7 6.93z" />
            </svg>
          </div>
          <div>
            <h5 className="mb-0 font-bold">Teaching Analytics Chatbot</h5>
            <small className="opacity-75">Ask questions about your lectures</small>
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
            <svg className="inline w-5 h-5 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 17v-2a4 4 0 014-4h3a4 4 0 014 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            Selected Files for Analysis
          </div>
          <div className="text-sm mb-2">
            You've selected <strong>{fileNames.length} file(s)</strong>. You can now ask me anything about these lectures!
          </div>
          <div className="flex flex-wrap gap-2">
            {fileNames.map((name, idx) => (
              <span key={idx} className="bg-blue-600 text-white rounded px-2 py-1 text-xs">{name}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-white">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-3 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl shadow px-4 py-2 max-w-[70%] ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              <div>
                {msg.sender === 'bot'
                  ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                  : msg.text}
              </div>
              <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {botLoading && (
          <div className="mb-3 flex justify-start">
            <div className="rounded-2xl shadow px-4 py-2 max-w-[70%] bg-gray-100 text-gray-800 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); handleSend(); }}>
          <textarea
            className="flex-1 border rounded-2xl px-4 py-2 shadow-sm resize-none focus:outline-blue-400"
            placeholder={fileNames.length > 0
              ? "Ask me anything about your selected lectures..."
              : "Type your message here..."}
            value={input}
            onChange={e => setInput(e.target.value)}
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
      <Modal open={showModal} onClose={() => setShowModal(false)} fileSummaries={fileSummaries} />
    </div>
  );
}
