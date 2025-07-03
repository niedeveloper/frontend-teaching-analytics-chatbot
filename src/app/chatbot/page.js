"use client";
import Chatbot from "../../components/Chatbot";
import { useSearchParams } from "next/navigation";

export default function ChatbotPage() {
  const searchParams = useSearchParams();
  const filesParam = searchParams.get("files");
  const fileIds = filesParam ? filesParam.split(",") : [];

  return <Chatbot fileIds={fileIds} />;
}
