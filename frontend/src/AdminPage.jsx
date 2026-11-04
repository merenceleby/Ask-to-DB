import { useState } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  seedDemoData,
  resetDemoData,
} from "./api";
import { useLanguage } from "./i18n";
import {
  Database,
  Users,
  AlertTriangle,
  Trash2,
  Shield,
} from "lucide-react";

export default function AdminPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("users"); // 'users' | 'system'
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const reloadData = () => setRefreshTrigger((prev) => prev + 1);

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span>{t("admin_title")}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t("admin_subtitle")}
          </p>
        </div>

        {/* Dashboard Tabs: Sadece Kullanıcılar ve Sistem Araçları */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === "users"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t("tab_users")}</span>
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === "system"
                ? "bg-rose-600/80 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-rose-400"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t("tab_system")}</span>
          </button>
        </div>
      </div>

      {/* Tab İçerikleri */}
      {activeTab === "users" && <UsersSection />}
      {activeTab === "system" && <SystemToolsSection onRefresh={reloadData} />}
    </div>
  );
}

// ==========================================
// 1. KULLANICI YÖNETİMİ
// ==========================================
function UsersSection() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdminFlag, setIsAdminFlag] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useState(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await createUser(username, password, isAdminFlag);
      setUsername("");
      setPassword("");
      setIsAdminFlag(false);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(userId) {
    if (!confirm("Are you sure?")) return;
    try {
      await deleteUser(userId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <span>{t("registered_users")}</span>
        </h2>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
            {error}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">{t("col_id")}</th>
                <th className="px-4 py-3">{t("col_username")}</th>
                <th className="px-4 py-3">{t("col_admin")}</th>
                <th className="px-4 py-3 text-right">{t("col_action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                        {t("admin_badge")}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">{t("standard_badge")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Yeni Kullanıcı Ekleme Formu */}
        <form onSubmit={handleCreate} className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={t("new_username_ph")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <input
            type="password"
            placeholder={t("new_password_ph")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdminFlag}
              onChange={(e) => setIsAdminFlag(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>{t("grant_admin_cb")}</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-indigo-600/20 ml-auto"
          >
            {t("add_user_btn")}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. SİSTEM & TEST ARAÇLARI (DANGER ZONE)
// ==========================================
function SystemToolsSection({ onRefresh }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  async function handleSeed() {
    setStatus("Loading...");
    try {
      await seedDemoData();
      setStatus("Done!");
      onRefresh();
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }

  async function handleReset() {
    setShowConfirmModal(false);
    setStatus("Deleting...");
    try {
      await resetDemoData();
      setStatus("Done!");
      onRefresh();
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <span>{t("demo_setup_title")}</span>
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t("demo_setup_desc")}
        </p>

        <button
          onClick={handleSeed}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20 flex items-center gap-2"
        >
          <Database className="w-4 h-4" />
          <span>{t("demo_setup_btn")}</span>
        </button>
      </div>

      <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-base font-semibold text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          <span>{t("danger_zone_title")}</span>
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t("danger_zone_desc")}
        </p>

        <button
          onClick={() => setShowConfirmModal(true)}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium shadow-md shadow-rose-600/20 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t("danger_zone_btn")}</span>
        </button>
      </div>

      {status && (
        <div className="p-3 bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-xl">
          {status}
        </div>
      )}

      {/* Onay Modalı */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-semibold text-white">{t("confirm_title")}</h3>
            <p className="text-xs text-slate-400">
              {t("confirm_desc")}
            </p>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                {t("confirm_no")}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium shadow-md shadow-rose-600/20"
              >
                {t("confirm_yes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
