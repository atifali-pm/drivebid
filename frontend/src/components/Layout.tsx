import { ReactNode } from "react";
import { useAuth } from "../auth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand text-white font-bold grid place-items-center">
              DB
            </div>
            <div>
              <h1 className="font-bold text-slate-800">DriveBid</h1>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role} dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <p className="font-medium text-slate-800">{user?.full_name}</p>
              <p className="text-slate-500 text-xs">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
