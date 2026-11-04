import { useState } from "react";
import { login } from "./api";
import { Database, Lock, User, ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "./i18n";

export default function LoginPage({ onLoggedIn }) {
  const { lang, setLang, t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      onLoggedIn();
    } catch (err) {
      setError(err.message || t("login_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative">
      {/* Top right language switch */}
      <div className="absolute top-6 right-6">
        <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 text-xs font-medium">
          <button
            onClick={() => setLang("tr")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              lang === "tr"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            TR
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              lang === "en"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-white mb-2">
          {t("login_title")}
        </h1>
        <p className="text-sm text-slate-400 text-center mb-8">
          {t("login_subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t("login_username")}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {t("login_password")}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950/70 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
          >
            {loading ? (
              t("login_loading")
            ) : (
              <>
                <span>{t("login_btn")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>{t("login_footer")}</span>
        </div>
      </div>
    </div>
  );
}
