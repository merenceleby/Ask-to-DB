import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  Link,
  useLocation,
} from "react-router-dom";
import AdminPage from "./AdminPage";
import AskPage from "./AskPage";
import WorkspacePage from "./WorkspacePage";
import LoginPage from "./LoginPage";
import { getToken, isAdmin, logout } from "./api";
import { Database, LogOut, Layers, MessageSquare } from "lucide-react";
import { LanguageProvider, useLanguage } from "./i18n";

function LanguageSwitch() {
  const { lang, setLang } = useLanguage();

  return (
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
  );
}

function NavigationLayout({ loggedIn, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  function handleLogoutClick() {
    logout();
    onLogout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-white font-semibold text-base hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <span>{t("app_title")}</span>
            </Link>

            {/* Nav Links for logged in users */}
            {loggedIn && (
              <nav className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                <Link
                  to="/"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    location.pathname === "/"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t("nav_ask")}</span>
                </Link>

                <Link
                  to="/workspace"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    location.pathname === "/workspace"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t("nav_workspace")}</span>
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Dil Değiştirici */}
            <LanguageSwitch />

            {loggedIn && (
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors border border-slate-700/60"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>{t("logout")}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">{children}</main>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              loggedIn ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLoggedIn={() => setLoggedIn(true)} />
              )
            }
          />

          <Route
            path="/"
            element={
              loggedIn ? (
                <NavigationLayout
                  loggedIn={loggedIn}
                  onLogout={() => setLoggedIn(false)}
                >
                  <AskPage />
                </NavigationLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/workspace"
            element={
              loggedIn ? (
                <NavigationLayout
                  loggedIn={loggedIn}
                  onLogout={() => setLoggedIn(false)}
                >
                  <WorkspacePage />
                </NavigationLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/admin"
            element={
              !loggedIn ? (
                <Navigate to="/login" replace />
              ) : !isAdmin() ? (
                <Navigate to="/" replace />
              ) : (
                <NavigationLayout
                  loggedIn={loggedIn}
                  onLogout={() => setLoggedIn(false)}
                >
                  <AdminPage />
                </NavigationLayout>
              )
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
