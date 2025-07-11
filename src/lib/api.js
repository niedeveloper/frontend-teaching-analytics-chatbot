import { API_BASE_URL } from "./api-config";

// Calls the new enhanced/stream API and returns a stream reader for the response
export async function askChatbot({ fileIds, question, conversation_history = [] }) {
  const response = await fetch(`${API_BASE_URL}/api/v2/unified_chat_streaming`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: question,
      file_ids: fileIds.map(Number),
      conversation_history,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to get response from backend");
  }
  // Return the ReadableStream reader for the caller to process
  return response.body?.getReader();
}
