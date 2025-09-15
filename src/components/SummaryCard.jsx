import { Folder, FileText, Bot } from "lucide-react";

export default function SummaryCards({ summary, handleFileTextClick }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-gradient-to-tr from-indigo-100 to-white rounded-2xl shadow-lg border border-indigo-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
        <Folder className="text-indigo-600 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-indigo-800">
          {summary.classes}
        </h2>
        <p className="text-gray-500">Subjects</p>
      </div>
     <div className="bg-gradient-to-tr from-green-100 to-white rounded-2xl shadow-lg border border-green-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
        <FileText className="text-green-600 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-green-800">
          {summary.lectures}
        </h2>
        <p className="text-gray-500">Lessons</p>
      </div>
      <div className="bg-gradient-to-tr from-purple-100 to-white rounded-2xl shadow-lg border border-purple-100 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
        <Bot className="text-purple-600 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-purple-800">
          {summary.chatSessions}
        </h2>
        <p className="text-gray-500">Chat Sessions</p>
      </div>
    </section>
  );
}
