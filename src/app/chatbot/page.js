"use client";
import Chatbot from "../../components/Chatbot";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function ChatbotPage() {
  const searchParams = useSearchParams();
  const filesParam = searchParams.get("files");
  
  // Memoize fileIds to prevent unnecessary re-renders
  const fileIds = useMemo(() => {
    return filesParam ? filesParam.split(",") : [];
  }, [filesParam]);

  return <Chatbot fileIds={fileIds} />;
}
