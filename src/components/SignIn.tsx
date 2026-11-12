import React, { useState } from "react";
import { googleSignIn } from "../firebase";
import { FileSpreadsheet, Key, CheckCircle, Shield } from "lucide-react";

interface SignInProps {
  onSignedIn: (user: any, token: string) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onSignedIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onSignedIn(result.user, result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Sign in failed. Ensure you enabled popup permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="signin-container" className="flex flex-col items-center justify-center min-h-[75vh] px-4">
      <div id="signin-card" className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div id="signin-header" className="flex flex-col items-center text-center mb-8">
          <div id="icon-badge" className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mb-4 shadow-md shadow-indigo-100">
            <FileSpreadsheet className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-sans font-bold text-2xl tracking-tight text-slate-900">
            LedgerStream
          </h1>
          <p className="text-xs text-slate-500 mt-2 uppercase tracking-wider font-semibold font-mono">
            Direct-to-Sheets Expense Workspace
          </p>
        </div>

        <div id="scopes-info" className="space-y-4 mb-8 bg-slate-50 p-5 rounded-lg border border-slate-200 text-slate-600 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>Google Sheets Sync</strong>: Automatically create or append entries in your active sheet tab named <strong className="text-slate-900">DATA</strong>.
            </span>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>Receipt storage</strong>: Store PDF or image receipts in your private Google Drive and map secure viewer links.
            </span>
          </div>
        </div>

        {error && (
          <div id="signing-error" className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <button
          id="btn-google-sign-in"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 cursor-pointer py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md shadow-indigo-100 transition-all duration-200 focus:outline-none disabled:opacity-50"
        >
          <span className="font-sans">
            {loading ? "Authenticating session..." : "Authenticate with Google Workspace"}
          </span>
        </button>
      </div>
    </div>
  );
};
