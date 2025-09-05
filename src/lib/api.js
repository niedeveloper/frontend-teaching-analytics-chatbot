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
    .select("file_id, stored_filename, data_summary, lesson_date, lesson_number")
    .in("file_id", fileIds.map(Number));
  if (error) throw error;
  
  // Sort the results to maintain consistent order
  const sortedData = (data || []).sort((a, b) => {
    // First sort by lesson_date
    const dateA = new Date(a.lesson_date || 0);
    const dateB = new Date(b.lesson_date || 0);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    // Then by lesson_number
    return (a.lesson_number || 0) - (b.lesson_number || 0);
  });
  
  return sortedData;
}

// Fetch chunks for given file IDs with all necessary fields for charting
export async function fetchChunksByFileIds(fileIds) {
  if (!fileIds || fileIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from("chunks")
    .select(`
      file_id,
      sequence_order,
      word_count,
      duration_seconds,
      chunk_id,
      start_time,
      end_time,
      utterance_count,
      teaching_areas,
      area_distribution,
      chunk_text,
      class_section,
      class_section_label,
      relative_position,
      utterances,
      embedding
    `)
    .in("file_id", fileIds.map(Number))
    .order("sequence_order", { ascending: true });
    
  if (error) {
    console.error("Error fetching chunks:", error);
    return [];
  }
  
  return data || [];
}
