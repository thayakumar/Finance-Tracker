import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignOut } from "./firebase";
import { SignIn } from "./components/SignIn";
import { ExpenseForm } from "./components/ExpenseForm";
import { ExpenseHistory } from "./components/ExpenseHistory";
import { getSpreadsheetId, resolveSpreadsheetId } from "./googleApi";
import {
  FileSpreadsheet,
  LogOut,
  User as UserIcon,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>(getSpreadsheetId());

  useEffect(() => {
    // Listen for auth state revisions on load
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (token) {
      resolveSpreadsheetId(token)
        .then((id) => {
          setActiveSpreadsheetId(id);
        })
        .catch((err) => {
          console.error("Failed to pre-resolve spreadsheet ID:", err);
        });
    }
  }, [token]);

  const handleSignedIn = (signedInUser: User, signedInToken: string) => {
    setUser(signedInUser);
    setToken(signedInToken);
  };

  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setUser(null);
      setToken(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const triggerHistoryRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div id="full-page-loader" className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <FileSpreadsheet className="h-10 w-10 animate-pulse text-stone-700" />
          <p className="text-sm font-medium text-stone-500">Initializing workspace session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navigation Header */}
      <nav id="top-nav" className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 py-4 px-6 md:px-12 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0 shadow-sm shadow-indigo-100">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-sans font-bold text-slate-900 text-base tracking-tight leading-flex flex items-center gap-2">
                LedgerStream
              </h1>
              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                <span className="font-bold text-indigo-600">Tab: DATA</span>
                <ChevronRight className="h-2 w-2 text-slate-300" />
                <a
                  href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit#gid=0`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 underline inline-flex items-center gap-0.5"
                >
                  Open Google Sheet <ExternalLink className="h-2 w-2" />
                </a>
              </span>
            </div>
          </div>

          {user && (
            <div id="header-user-badge" className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-slate-800">
                  {user.displayName || "User"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {user.email}
                </span>
              </div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "Avatar"}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border-2 border-slate-200"
                />
              ) : (
                <span className="p-2 bg-slate-100 rounded-full border border-slate-200 text-slate-600">
                  <UserIcon className="h-4 w-4" />
                </span>
              )}
              <button
                id="btn-nav-sign-out"
                onClick={handleSignOut}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-10 md:px-12">
        {!user || !token ? (
          <SignIn onSignedIn={handleSignedIn} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left side: Input Form */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <ExpenseForm
                accessToken={token}
                onExpenseAdded={triggerHistoryRefresh}
              />
            </div>

            {/* Right side: History List & Metrics */}
            <div className="lg:col-span-7">
              <ExpenseHistory
                accessToken={token}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        )}
      </main>

      {/* Corporate Status Footer */}
      {user && token && (
        <footer className="h-9 bg-slate-900 px-6 flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-widest shrink-0 border-t border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              DATA GSheet Connected
            </div>
            <div className="hidden sm:block text-slate-500 text-[9px]">Last Updated: Realtime</div>
          </div>
          <div className="font-mono text-slate-500 text-[9px] truncate max-w-[200px] sm:max-w-none">
            Sheet ID: {activeSpreadsheetId.slice(0, 7)}...{activeSpreadsheetId.slice(-3)}
          </div>
        </footer>
      )}
    </div>
  );
}
