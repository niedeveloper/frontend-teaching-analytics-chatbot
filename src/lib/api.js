import { API_BASE_URL } from "./api-config";
import { supabase } from "./supabaseClient";

// Calls the new enhanced/stream API and returns a stream reader for the response
export async function askChatbot({
  fileIds,
  question,
  conversation_history = [],
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/v2/unified_chat_streaming`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        file_ids: fileIds.map(Number),
        conversation_history,
      }),
    }
  );
  console.log(response);
  if (!response.ok) {
    throw new Error("Failed to get response from backend");
  }
  // Return the ReadableStream reader for the caller to process
  return response.body?.getReader();
}

// Fetches the data_summary for multiple file IDs from Supabase
export async function fetchLessonSummaries(fileIds) {
  // fileIds: array of file_id (number or string)
  if (!fileIds || fileIds.length === 0) return [];
  const { data, error } = await supabase
    .from("files")
    .select("file_id, stored_filename, data_summary")
    .in("file_id", fileIds.map(Number));
  if (error) throw error;
  return data || [];
}
