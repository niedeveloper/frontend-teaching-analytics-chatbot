import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Chatbot({ fileIds }) {
  const [fileNames, setFileNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();

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

    setTimeout(() => {
      const botMessage = {
        id: messages.length + 2,
        sender: 'bot',
        text: fileNames.length > 0
          ? "I'm analyzing your selected lectures. In a real implementation, this would connect to your backend to provide actual answers about your specific lecture files."
          : "This is a simulated response. In a real implementation, this would connect to your backend to provide actual answers about your lectures.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setBotLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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
        <button
          className="bg-white text-blue-600 font-semibold px-4 py-2 rounded shadow hover:bg-blue-50 hover:cursor-pointer transition"
          onClick={() => router.push('/dashboard')}
        >
          ← Back to Dashboard
        </button>
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
              <div>{msg.text}</div>
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
    </div>
  );
}
