import { API_BASE_URL } from "./api-config";
import { supabase } from "./supabaseClient";

// Utility function to wait/sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 5000, // 5 seconds
  timeout: 60000, // 60 seconds
};

// Check if error is retryable (network errors, not server errors)
function isRetryableError(error) {
  // Network errors that should be retried
  return (
    error.name === 'TypeError' || // fetch network errors
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('ERR_CONNECTION') ||
    error.message.includes('connection') ||
    error.message.includes('timeout')
  );
}

// Calls the new enhanced/stream API and returns a stream reader for the response
// Includes retry logic for network failures
export async function askChatbot({
  fileIds,
  question,
  conversation_history = [],
}) {
  let lastError;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);
    
    try {
      console.log(`[askChatbot] Attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries + 1}`);
      
      const response = await fetch(
        `${API_BASE_URL}/api/v2/unified_chat_streaming`,
        {
          method: "POST",
          mode: "cors",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
            file_ids: fileIds.map(Number),
            conversation_history,
          }),
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      console.log(`[askChatbot] Response received:`, response.status, response.statusText);
      
      if (!response.ok) {
        // Server returned an error status - don't retry
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      // Success! Return the ReadableStream reader for the caller to process
      return response.body?.getReader();
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      // Check if we should retry
      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        console.warn(
          `[askChatbot] Network error on attempt ${attempt + 1}:`,
          error.message,
          `- Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue; // Try again
      }
      
      // Don't retry server errors or if we've exhausted retries
      console.error(`[askChatbot] Failed after ${attempt + 1} attempts:`, error);
      break;
    }
  }
  
  // All retries failed
  throw new Error(
    `Failed to connect to backend after ${RETRY_CONFIG.maxRetries + 1} attempts. ` +
    `Please check your internet connection. Last error: ${lastError.message}`
  );
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
