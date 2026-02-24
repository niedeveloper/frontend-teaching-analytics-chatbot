import { Folder, FileText, Bot } from "lucide-react";

export default function SummaryCards({ summary, handleFileTextClick }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-gradient-to-tr from-indigo-100 to-white dark:from-indigo-900/40 dark:to-gray-800 rounded-2xl shadow-lg border border-indigo-100 dark:border-indigo-800/40 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
        <Folder className="text-indigo-600 dark:text-indigo-400 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-indigo-800 dark:text-indigo-300">
          {summary.classes}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Subjects</p>
      </div>
      <div
        onClick={handleFileTextClick}
        className="bg-gradient-to-tr from-green-100 to-white dark:from-green-900/40 dark:to-gray-800 rounded-2xl shadow-lg border border-green-100 dark:border-green-800/40 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition cursor-pointer"
      >
        <FileText className="text-green-600 dark:text-green-400 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-green-800 dark:text-green-300">
          {summary.lectures}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Lessons</p>
      </div>
      <div className="bg-gradient-to-tr from-purple-100 to-white dark:from-purple-900/40 dark:to-gray-800 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-800/40 py-6 px-4 flex flex-col items-center hover:shadow-2xl hover:scale-[1.03] transition">
        <Bot className="text-purple-600 dark:text-purple-400 w-8 h-8 mb-2" />
        <h2 className="text-3xl font-bold text-purple-800 dark:text-purple-300">
          {summary.chatSessions}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Chat Sessions</p>
      </div>
    </section>
  );
}
