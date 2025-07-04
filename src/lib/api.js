import { API_BASE_URL } from "./api-config";

export async function askChatbot({ fileIds, question, top_k = 3 }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_id: fileIds.map(Number),
      question,
      top_k,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to get response from backend");
  }
  return response.json();
}
