import { API_BASE_URL } from "./api-config";
import { supabase } from "./supabaseClient";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  timeout: 60000,
};

function isRetryableError(error) {
  return (
    error.name === 'TypeError' ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('ERR_CONNECTION') ||
    error.message.includes('connection') ||
    error.message.includes('timeout')
  );
}

export async function askChatbot({
  fileIds,
  question,
  conversation_history = [],
}) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);

    try {
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

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      return response.body?.getReader();

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

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
        continue;
      }

      console.error(`[askChatbot] Failed after ${attempt + 1} attempts:`, error);
      break;
    }
  }

  throw new Error(
    `Failed to connect to backend after ${RETRY_CONFIG.maxRetries + 1} attempts. ` +
    `Please check your internet connection. Last error: ${lastError.message}`
  );
}

export async function fetchLessonSummaries(fileIds) {
  if (!fileIds || fileIds.length === 0) return [];
  const { data, error } = await supabase
    .from("files")
    .select("file_id, stored_filename, data_summary, lesson_date, lesson_number")
    .in("file_id", fileIds.map(Number));
  if (error) throw error;

  const sortedData = (data || []).sort((a, b) => {
    const dateA = new Date(a.lesson_date || 0);
    const dateB = new Date(b.lesson_date || 0);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    return (a.lesson_number || 0) - (b.lesson_number || 0);
  });

  return sortedData;
}

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
