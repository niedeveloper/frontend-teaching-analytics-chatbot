import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from "react-markdown";
import { Download, X } from "lucide-react";
import GraphRenderer from "./GraphRenderer";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

// Inline summary table component for chat (copied from Chatbot.jsx)
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
        const match = line.match(
          /^([^.]+\.\d [^:]+): (\d+) utterances \(([^)]+)%\)(?: - (\d+) questions)?/
        );
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
     <div className="flex flex-col gap-4 pb-2">
       {fileSummaries.map((file, idx) => {
         const summary = (file.data_summary || "").replace(/\\n/g, "\n");
         const stats = parseTeachingAreaStats(summary);
         const tableData = statsToTable(stats);
         // Find the row with the highest percent
         const maxPercent = Math.max(...tableData.map((row) => row.percent));
         const questionAnalysis = parseSection(summary, "QUESTION ANALYSIS:");
         const speechAnalysis = parseSection(summary, "SPEECH ANALYSIS:");
         const keyInsights = parseSection(summary, "KEY INSIGHTS:");
         return (
           <div
             key={file.file_id || idx}
             className="w-full bg-white rounded-lg shadow p-3"
           >
            <div className="font-semibold mb-1 text-blue-700">
              {file.stored_filename || `File #${idx + 1}`}
            </div>
                         <table className="w-full border text-xs bg-white rounded shadow mb-3">
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
                    className={
                      row.percent === maxPercent ? "bg-yellow-200" : ""
                    }
                  >
                    <td className="border px-2 py-1 text-left">{row.name}</td>
                    <td className="border px-2 py-1 text-center">
                      {row.value}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {row.percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {questionAnalysis.length > 0 && (
              <div className="mb-2">
                <div className="font-semibold text-blue-700 mb-1">
                  Question Analysis
                </div>
                <ul className="list-disc pl-5 text-xs">
                  {questionAnalysis.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium">{item.key}:</span>{" "}
                      {item.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {speechAnalysis.length > 0 && (
              <div className="mb-2">
                <div className="font-semibold text-blue-700 mb-1">
                  Speech Analysis
                </div>
                <ul className="list-disc pl-5 text-xs">
                  {speechAnalysis.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium">{item.key}:</span>{" "}
                      {item.value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {keyInsights.length > 0 && (
              <div>
                <div className="font-semibold text-blue-700 mb-1">
                  Key Insights
                </div>
                <ul className="list-disc pl-5 text-xs">
                  {keyInsights.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium">{item.key}:</span>{" "}
                      {item.value}
                    </li>
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

export default function ChatHistoryModal({ open, onClose, chatSession, fileSummaries = [] }) {
  const [downloading, setDownloading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [chartImages, setChartImages] = useState({});
  const [capturingCharts, setCapturingCharts] = useState(false);
  const chatContentRef = useRef();

  // Memoized empty arrays for filter fallbacks (matching live chat behavior)
  const emptyLessonFilter = useMemo(() => [], []);
  const emptyAreaFilter = useMemo(() => [], []);

  // Initialize all messages as selected when modal opens
  useEffect(() => {
    if (open && chatSession?.conversation) {
      setSelectedMessages(new Set(chatSession.conversation.map((_, index) => index)));
      // Capture charts when modal opens
      captureCharts();
    }
  }, [open, chatSession]);

  // Capture charts as images for PDF generation
  const captureCharts = async () => {
    if (!chatSession?.conversation) return;
    
    setCapturingCharts(true);
    const images = {};
    
    try {
      // Wait a bit for charts to fully render
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      for (let i = 0; i < chatSession.conversation.length; i++) {
        const msg = chatSession.conversation[i];
        if (msg.message_type === "graph") {
          // Find the chart DOM element by message index
          const chartElement = document.querySelector(`[data-message-id="${i}"] .chart-container`);
          if (chartElement) {
            try {
              // Use the same method as GraphRenderer - html-to-image with toPng
              const dataUrl = await toPng(chartElement, {
                backgroundColor: "white",
                cacheBust: true,
                style: {
                  // Override any problematic CSS properties
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }
              });
              images[i] = dataUrl;
            } catch (error) {
              console.warn(`Failed to capture chart for message ${i}:`, error);
              // Store a fallback indicator
              images[i] = 'capture_failed';
            }
          }
        }
      }
      
      setChartImages(images);
    } catch (error) {
      console.error('Error capturing charts:', error);
    } finally {
      setCapturingCharts(false);
    }
  };

  if (!open || !chatSession) return null;

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (timestamp) =>
    new Date(timestamp).toLocaleDateString([], {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const handleMessageToggle = (messageIndex) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageIndex)) {
      newSelected.delete(messageIndex);
    } else {
      newSelected.add(messageIndex);
    }
    setSelectedMessages(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedMessages.size === chatSession.conversation?.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(chatSession.conversation?.map((_, index) => index) || []));
    }
  };

    const handleDownload = async () => {
    if (!chatSession.conversation) return;
    
    // If no messages are selected, select all
    const messagesToDownload = selectedMessages.size > 0 
      ? chatSession.conversation.filter((_, index) => selectedMessages.has(index))
      : chatSession.conversation;
    
    if (messagesToDownload.length === 0) {
      alert("Please select at least one message to download.");
      return;
    }
    
    setDownloading(true);
    try {
      // Create a print-friendly version of the chat
      const printWindow = window.open('', '_blank');
      
      // Create the HTML content for printing with proper markdown rendering
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Chat Session - ${formatDate(chatSession.started_at)}</title>
          <script src="https://unpkg.com/react-markdown@8.0.7/dist/react-markdown.min.js"></script>
          <script src="https://unpkg.com/remark-gfm@3.0.1/dist/remark-gfm.min.js"></script>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              .page-break { page-break-before: always; }
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.5;
              color: #333;
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #2563eb;
            }
            
            .header h1 {
              color: #2563eb;
              font-size: 24px;
              margin: 0 0 8px 0;
              font-weight: 700;
            }
            
            .header .meta {
              color: #6b7280;
              font-size: 14px;
              margin: 4px 0;
            }
            
            .message {
              margin-bottom: 20px;
              display: flex;
            }
            
            .message.user {
              justify-content: flex-end;
            }
            
            .message.assistant {
              justify-content: flex-start;
            }
            
            .bubble {
              max-width: 70%;
              padding: 14px 18px;
              border-radius: 16px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              position: relative;
              font-size: 13px;
              word-wrap: break-word;
              overflow-wrap: break-word;
              box-sizing: border-box;
            }
            
            .bubble.user {
              background: #2563eb;
              color: white;
              margin-left: auto;
            }
            
            .bubble.assistant {
              background: #f3f4f6;
              color: #1f2937;
              border: 1px solid #e5e7eb;
            }
            
            .bubble .content {
              margin-bottom: 8px;
              word-wrap: break-word;
            }
            
            .bubble .timestamp {
              font-size: 10px;
              opacity: 0.8;
              text-align: right;
              margin-top: 6px;
            }
            
            /* Markdown styling */
            .markdown-content h1, .markdown-content h2, .markdown-content h3, 
            .markdown-content h4, .markdown-content h5, .markdown-content h6 {
              margin: 14px 0 6px 0;
              font-weight: 600;
              line-height: 1.2;
            }
            
            .markdown-content h1 { font-size: 1.3em; }
            .markdown-content h2 { font-size: 1.15em; }
            .markdown-content h3 { font-size: 1.05em; }
            
            .markdown-content p {
              margin: 5px 0;
              line-height: 1.4;
              font-size: 13px;
            }
            
            .markdown-content ul, .markdown-content ol {
              margin: 6px 0;
              padding-left: 20px;
            }
            
            .markdown-content li {
              margin: 3px 0;
            }
            
            .markdown-content strong {
              font-weight: 600;
            }
            
            .markdown-content em {
              font-style: italic;
            }
            
            .markdown-content code {
              background: rgba(0,0,0,0.1);
              padding: 2px 4px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              font-size: 0.8em;
            }
            
            .markdown-content pre {
              background: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 6px;
              padding: 12px;
              overflow-x: auto;
              margin: 12px 0;
            }
            
            .markdown-content pre code {
              background: none;
              padding: 0;
            }
            
            .markdown-content blockquote {
              border-left: 4px solid #2563eb;
              margin: 16px 0;
              padding-left: 16px;
              color: #6b7280;
            }
            
            /* Enhanced styling for teaching analytics content */
            .markdown-content h3 {
              color: #1e40af;
              border-bottom: 2px solid #dbeafe;
              padding-bottom: 4px;
            }
            
            .markdown-content h4 {
              color: #374151;
              font-weight: 600;
            }
            
            .trend-highlight {
              background: #f0f9ff;
              padding: 6px 10px;
              border-radius: 6px;
              border-left: 3px solid #0ea5e9;
              margin: 6px 0;
            }
            
            .lesson-data {
              color: #059669;
              font-weight: 500;
            }
            
            .insight-box {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 8px;
              padding: 14px;
              margin: 14px 0;
            }
            
            /* Special content styling */
            .special-content {
              background: #f8fafc;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
              margin: 12px 0;
              text-align: center;
            }
            
            .special-content .icon {
              font-size: 20px;
              margin-bottom: 8px;
            }
            
            .special-content .title {
              font-weight: 600;
              color: #1e40af;
              margin-bottom: 6px;
              font-size: 14px;
            }
            
            .special-content .description {
              color: #64748b;
              font-size: 12px;
            }
            
            /* Chart image styling */
            .chart-image {
              text-align: center;
              margin: 16px 0;
              padding: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
            }
            
            .chart-image img {
              width: 100%;
              max-width: 1200px;
              height: auto;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .chart-caption {
              margin-top: 12px;
              text-align: left;
              font-size: 11px;
              color: #374151;
              line-height: 1.3;
            }
            
            .chart-caption strong {
              color: #1e40af;
              font-weight: 600;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            
            .footer p {
              margin: 5px 0;
            }
            
            /* Summary table container styling */
            .summary-tables-container {
              max-width: 100%;
              overflow: hidden;
            }
            
            .summary-tables-container > div {
              max-width: 100% !important;
              width: 100% !important;
              box-sizing: border-box;
            }
            
            .summary-tables-container table {
              max-width: 100% !important;
              width: 100% !important;
              table-layout: fixed;
              box-sizing: border-box;
            }
            
            .summary-tables-container td {
              word-wrap: break-word;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            
            @media print {
              .bubble {
                box-shadow: none;
                border: 1px solid #d1d5db;
              }
              
              .bubble.user {
                background: #dbeafe !important;
                color: #1e40af !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .bubble.assistant {
                background: #f9fafb !important;
                color: #374151 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .chart-image img {
                border: 1px solid #000;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Chat Session</h1>
            <div class="meta">${formatDate(chatSession.started_at)} • ${formatTime(chatSession.started_at)}</div>
            <div class="meta">Session ID: ${chatSession.session_id}</div>
            <div class="meta">Files Analyzed: ${chatSession.file_ids?.length || 0}</div>
          </div>
          
          ${messagesToDownload.map((msg, index) => {
            const isUser = msg.role === 'user';
            const timestamp = formatTime(msg.timestamp || new Date(chatSession.started_at).getTime() + (index * 60000));
            
            let content = '';
            if (msg.message_type === "summary_table") {
              // Generate HTML for summary tables
              const fileSummaries = msg.fileSummaries || [];
              let summaryTableHTML = '';
              
              if (fileSummaries.length > 0) {
                                 summaryTableHTML = `
                   <div class="summary-tables-container" style="display: flex; flex-direction: column; gap: 20px; margin: 15px 0;">
                    ${fileSummaries.map((file, idx) => {
                      const summary = (file.data_summary || "").replace(/\\n/g, "\n");
                      
                      // Parse teaching area statistics
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
                          const match = line.match(
                            /^([^.]+\.\d [^:]+): (\d+) utterances \(([^)]+)%\)(?: - (\d+) questions)?/
                          );
                          if (match) {
                            stats[match[1].trim()] = {
                              value: parseInt(match[2], 10),
                              percent: parseFloat(match[3]),
                              questions: match[4] ? parseInt(match[4], 10) : undefined,
                            };
                          }
                        }
                      }
                      
                      // Parse question analysis and key insights
                      const questionAnalysis = [];
                      const keyInsights = [];
                      let inQuestionAnalysis = false;
                      let inKeyInsights = false;
                      
                      for (const line of lines) {
                        if (line.startsWith("QUESTION ANALYSIS:")) {
                          inQuestionAnalysis = true;
                          inKeyInsights = false;
                          continue;
                        }
                        if (line.startsWith("KEY INSIGHTS:")) {
                          inQuestionAnalysis = false;
                          inKeyInsights = true;
                          continue;
                        }
                        if (inQuestionAnalysis || inKeyInsights) {
                          if (line.trim() === "" || line.match(/^([A-Z ]+):/)) break;
                          const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
                          if (match) {
                            const item = { key: match[1].trim(), value: match[2].trim() };
                            if (inQuestionAnalysis) questionAnalysis.push(item);
                            if (inKeyInsights) keyInsights.push(item);
                          }
                        }
                      }
                      
                      // Generate table data
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
                      
                      const tableData = TEACHING_AREA_CODES.map((code) => ({
                        name: code,
                        value: stats[code]?.value || 0,
                        percent: stats[code]?.percent || 0,
                        questions: stats[code]?.questions || 0,
                      }));
                      
                      const maxPercent = Math.max(...tableData.map((row) => row.percent));
                      
                                             return `
                         <div style="width: 100%; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 15px; margin-bottom: 20px;">
                          <div style="font-weight: 600; margin-bottom: 5px; color: #1d4ed8; font-size: 14px;">
                            ${file.stored_filename || `File #${idx + 1}`}
                          </div>
                                                     <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: white; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-bottom: 12px;">
                            <thead>
                              <tr>
                                <th style="border: 1px solid #d1d5db; padding: 4px 8px; background: #f9fafb; font-weight: 600;">Teaching Area</th>
                                <th style="border: 1px solid #d1d5db; padding: 4px 8px; background: #f9fafb; font-weight: 600;">Utterances</th>
                                <th style="border: 1px solid #d1d5db; padding: 4px 8px; background: #f9fafb; font-weight: 600;">% of Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${tableData.map((row) => `
                                <tr style="${row.percent === maxPercent ? 'background-color: #fef3c7;' : ''}">
                                  <td style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left; font-size: 10px;">${row.name}</td>
                                  <td style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: center;">${row.value}</td>
                                  <td style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: center;">${row.percent}%</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          ${questionAnalysis.length > 0 ? `
                            <div style="margin-bottom: 8px;">
                              <div style="font-weight: 600; color: #1d4ed8; margin-bottom: 4px; font-size: 12px;">Question Analysis</div>
                              <ul style="list-style-type: disc; padding-left: 20px; font-size: 10px;">
                                ${questionAnalysis.map((item, i) => `
                                  <li style="margin: 2px 0;">
                                    <span style="font-weight: 500;">${item.key}:</span> ${item.value}
                                  </li>
                                `).join('')}
                              </ul>
                            </div>
                          ` : ''}
                          ${keyInsights.length > 0 ? `
                            <div>
                              <div style="font-weight: 600; color: #1d4ed8; margin-bottom: 4px; font-size: 12px;">Key Insights</div>
                              <ul style="list-style-type: disc; padding-left: 20px; font-size: 10px;">
                                ${keyInsights.map((item, i) => `
                                  <li style="margin: 2px 0;">
                                    <span style="font-weight: 500;">${item.key}:</span> ${item.value}
                                  </li>
                                `).join('')}
                              </ul>
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              } else {
                summaryTableHTML = `
                  <div class="special-content">
                    <div class="icon">📊</div>
                    <div class="title">Summary Table</div>
                    <div class="description">No summary data available</div>
                  </div>
                `;
              }
              
              content = summaryTableHTML;
            } else if (msg.message_type === "graph") {
              // Display the captured chart image if available
              const chartImage = chartImages[chatSession.conversation.indexOf(msg)];
              if (chartImage && chartImage !== 'capture_failed') {
                content = `
                  <div class="chart-image">
                    <img src="${chartImage}" alt="Chart: ${msg.graphType}" />
                    <div class="chart-caption">
                      <strong>Chart Type:</strong> ${msg.graphType}<br>
                      <strong>Purpose:</strong> ${msg.graphReason}
                    </div>
                  </div>
                `;
              } else if (chartImage === 'capture_failed') {
                // Show a message when capture specifically failed
                content = `
                  <div class="special-content">
                    <div class="icon">⚠️</div>
                    <div class="title">Chart Capture Failed</div>
                    <div class="description">Unable to capture chart due to rendering issues</div>
                    <div style="margin-top: 12px; text-align: left; font-size: 12px; color: #374151;">
                      <strong>Chart Type:</strong> ${msg.graphType}<br>
                      <strong>Purpose:</strong> ${msg.graphReason}<br>
                      <strong>Note:</strong> This chart could not be captured for PDF generation. 
                      The interactive chart is available in the original chat session.
                    </div>
                  </div>
                `;
              } else {
                // Fallback if image capture hasn't completed yet
                content = `
                  <div class="special-content">
                    <div class="icon">📈</div>
                    <div class="title">${msg.graphType}</div>
                    <div class="description">${msg.graphReason}</div>
                    <div style="margin-top: 12px; text-align: left; font-size: 12px; color: #374151;">
                      <strong>Note:</strong> This is an interactive chart visualization. 
                      The full interactive chart with data is available in the original chat session.
                    </div>
                  </div>
                `;
              }
            } else {
              // Convert markdown to HTML for text messages
              const markdownContent = msg.content || '';
              const htmlContent = markdownContent
                // Handle bold text (**text**)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Handle italic text (*text*)
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Handle inline code (`text`)
                .replace(/`(.*?)`/g, '<code>$1</code>')
                // Handle newlines
                .replace(/\n/g, '<br>')
                // Handle numbered lists with bold headers (1. **Header**:)
                .replace(/^(\d+\.\s+\*\*.*?\*\*:)/gm, '<h3 style="color: #1e40af; margin-top: 20px; margin-bottom: 10px;">$1</h3>')
                // Handle numbered lists (1. Item:)
                .replace(/^(\d+\.\s+[^:]+:)/gm, '<h4 style="color: #374151; margin-top: 15px; margin-bottom: 8px;">$1</h4>')
                // Handle specific bold labels
                .replace(/^\*\*(Trend)\*\*:/gm, '<strong style="color: #059669;">$1:</strong>')
                .replace(/^\*\*(Overall Insight)\*\*:/gm, '<strong style="color: #dc2626;">$1:</strong>')
                // Handle bullet points
                .replace(/^-\s+(.*?):/gm, '<div style="margin: 8px 0; padding-left: 20px;"><strong>$1:</strong></div>')
                // Handle lesson entries (Lesson 1: X, Lesson 2: Y, Lesson 3: Z)
                .replace(/(Lesson \d+): (\d+) utterances/g, '<span style="color: #059669;"><strong>$1:</strong> $2 utterances</span>')
                // Handle trend descriptions
                .replace(/(\*\*Trend\*\*: .*?)(?=<br>|$)/g, '<div style="background: #f0f9ff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #0ea5e9; margin: 8px 0;">$1</div>');
              
              content = `<div class="content markdown-content">${htmlContent}</div>`;
            }
            
            return `
              <div class="message ${isUser ? 'user' : 'assistant'}">
                <div class="bubble ${isUser ? 'user' : 'assistant'}">
                  ${content}
                  <div class="timestamp">
                    ${isUser ? 'You' : 'Assistant'} • ${timestamp}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
          
          <div class="footer">
            <p><strong>Selected Messages:</strong> ${messagesToDownload.length}/${chatSession.conversation.length}</p>
            <p><strong>Exported on:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Teaching Analytics Chatbot</strong></p>
          </div>
        </body>
        </html>
      `;
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      };
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to create print view. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/40 px-2 py-4">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-8 max-w-6xl w-full relative mx-auto overflow-y-auto max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Chat History</h2>
            <p className="text-gray-600">
              Session from {formatDate(chatSession.started_at)} at {formatTime(chatSession.started_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-blue-600 text-2xl p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Download Controls */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4 mb-3">
            <button
              onClick={handleSelectAll}
              className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
            >
              {selectedMessages.size === chatSession.conversation?.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-gray-600">
              {selectedMessages.size > 0 ? `${selectedMessages.size} selected` : 'No messages selected'}
            </span>
            {capturingCharts && (
              <span className="text-sm text-blue-600">
                📸 Capturing charts...
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={downloading || !chatSession.conversation || capturingCharts}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Download size={16} />
              {downloading ? 'Preparing...' : `Print/Save as PDF (${selectedMessages.size > 0 ? selectedMessages.size : chatSession.conversation?.length || 0} messages)`}
            </button>
            {Object.keys(chartImages).length > 0 && (
              <span className="text-sm text-green-600">
                ✅ {Object.keys(chartImages).length} charts captured
              </span>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="space-y-4" ref={chatContentRef}>
          {chatSession.conversation?.map((msg, index) => (
            <div
              key={index}
              data-message-id={index}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              } ${msg.message_type === "graph" ? "justify-center" : ""}`}
            >
              {/* Radio Button for Selection */}
              <div className="flex-shrink-0 mt-2">
                <input
                  type="checkbox"
                  checked={selectedMessages.has(index)}
                  onChange={() => handleMessageToggle(index)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
              
              {/* Message Content */}
              <div
                className={`rounded-2xl shadow px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white max-w-[70%]"
                    : msg.message_type === "graph"
                    ? "bg-gray-100 text-gray-800 w-[1400px]"
                    : "bg-gray-100 text-gray-800 max-w-[70%]"
                }`}
              >
                <div>
                  {msg.message_type === "summary_table" ? (
                    <InlineSummaryTable fileSummaries={msg.fileSummaries || []} />
                  ) : msg.message_type === "graph" ? (
                    <div className="w-full">
                      <div className="text-sm text-blue-600 mb-2 italic">
                        💡 {msg.graphReason}
                      </div>
                      <div className="chart-container">
                        <GraphRenderer 
                          graphType={msg.graphType} 
                          fileIds={chatSession.file_ids || []}
                          messageId={msg.id}
                          lessonFilter={msg.lessonFilter || emptyLessonFilter}
                          areaFilter={msg.areaFilter || emptyAreaFilter}
                        />
                      </div>
                    </div>
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
                  {msg.timestamp ? formatTime(msg.timestamp) : formatTime(new Date(chatSession.started_at).getTime() + (index * 60000))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Session Info Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <p><strong>Session ID:</strong> {chatSession.session_id}</p>
            <p><strong>Duration:</strong> {Math.round((new Date(chatSession.ended_at) - new Date(chatSession.started_at)) / 1000 / 60)} minutes</p>
            <p><strong>Messages:</strong> {chatSession.conversation?.length || 0}</p>
            <p><strong>Files Analyzed:</strong> {chatSession.file_ids?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
