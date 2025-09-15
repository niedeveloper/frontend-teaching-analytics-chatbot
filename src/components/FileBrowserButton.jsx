import { FolderOpen } from "lucide-react";

export default function FileBrowserButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.01] focus:ring-2 focus:ring-blue-500 focus:outline-none group"
    >
      <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
        <FolderOpen className="w-5 h-5" />
      </div>
      <div className="text-left">
        <div className="font-semibold text-lg">File Browser</div>
        <div className="text-blue-100 text-sm">Browse your uploaded files and folders</div>
      </div>
    </button>
  );
}
