import { LayoutDashboard, LogOut, User2 } from "lucide-react";

export default function TopNav({ userData, handleLogout }) {
  return (
    <nav className="sticky top-0 z-10 w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 shadow-md px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/20 text-white w-10 h-10 flex items-center justify-center font-bold text-lg shadow">
            <LayoutDashboard className="w-6 h-6" />
          </span>
          <span className="ml-2 text-xl font-bold text-white drop-shadow-sm">
            Teaching Analytics Dashboard
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/80 font-medium hidden sm:block">
            Hello, {userData?.first_name || "User"}
          </span>
          <span className="bg-white/20 text-white rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg">
            <User2 className="w-6 h-6" />
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/20 text-white hover:bg-red-500/80 hover:text-white px-4 py-2 rounded-full shadow transition font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
