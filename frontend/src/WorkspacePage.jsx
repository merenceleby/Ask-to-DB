import { useEffect, useState } from "react";
import {
  getDbSummary,
  createWorkspaceTable,
  deleteWorkspaceTable,
  getWorkspaceTableRows,
  insertWorkspaceTableRow,
  updateWorkspaceDbSettings,
  getColumnTypes,
  generateTableQuestions,
} from "./api";
import { useLanguage } from "./i18n";
import {
  Database,
  Layers,
  Plus,
  Trash2,
  Table as TableIcon,
  Sparkles,
  X,
  Settings,
} from "lucide-react";

export default function WorkspacePage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("tables"); // 'tables' | 'settings'

  // Data
  const [dbSummary, setDbSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Selected Table & Rows
  const [selectedTable, setSelectedTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [generatingQuestionsTable, setGeneratingQuestionsTable] = useState(null);

  // New Table Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableDesc, setNewTableDesc] = useState("");
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [columns, setColumns] = useState([{ name: "", type: "text", nullable: true }]);
  const [createError, setCreateError] = useState("");

  // Add Row Modal
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState({});
  const [addRowError, setAddRowError] = useState("");

  // DB Settings UI
  const [dbTitle, setDbTitle] = useState("");
  const [dbDesc, setDbDesc] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");

  useEffect(() => {
    loadAll();
    getColumnTypes().then(setAllowedTypes).catch(console.error);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const summaryData = await getDbSummary();
      setDbSummary(summaryData);
      setDbTitle(summaryData.db_title);
      setDbDesc(summaryData.db_description);

      if (summaryData.tables.length > 0 && !selectedTable) {
        handleSelectTable(summaryData.tables[0].name);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectTable(tableName) {
    setSelectedTable(tableName);
    setRowsLoading(true);
    try {
      const data = await getWorkspaceTableRows(tableName);
      setRows(data);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }

  async function handleDeleteTable(tableName, e) {
    e.stopPropagation();
    if (!confirm(`'${tableName}' tablosunu ve verilerini silmek istediğinize emin misiniz?`)) return;

    try {
      await deleteWorkspaceTable(tableName);
      if (selectedTable === tableName) {
        setSelectedTable(null);
        setRows([]);
      }
      await loadAll();
    } catch (err) {
      alert("Silinemedi: " + err.message);
    }
  }

  async function handleRegenerateQuestions(tableName, e) {
    e.stopPropagation();
    setGeneratingQuestionsTable(tableName);
    try {
      await generateTableQuestions(tableName);
      await loadAll();
      alert(`'${tableName}' ${t("ai_questions_regenerated")}`);
    } catch (err) {
      alert(`${t("ai_questions_error")} ${err.message}`);
    } finally {
      setGeneratingQuestionsTable(null);
    }
  }

  function handleAddColumn() {
    setColumns([...columns, { name: "", type: "text", nullable: true }]);
  }

  function handleColumnChange(idx, field, val) {
    const next = [...columns];
    next[idx][field] = val;
    setColumns(next);
  }

  function handleRemoveColumn(idx) {
    setColumns(columns.filter((_, i) => i !== idx));
  }

  async function handleCreateTableSubmit(e) {
    e.preventDefault();
    setCreateError("");

    if (!newTableName.trim()) {
      setCreateError(t("table_name_label") + "!");
      return;
    }
    if (!newTableDesc.trim()) {
      setCreateError(t("table_desc_label") + " " + t("required_tag"));
      return;
    }

    const validCols = columns.filter((c) => c.name.trim());
    if (validCols.length === 0) {
      setCreateError("En az bir kolon eklemelisiniz.");
      return;
    }

    try {
      await createWorkspaceTable(
        newTableName.trim(),
        validCols,
        newTableDesc.trim(),
        []
      );
      setShowCreateModal(false);
      setNewTableName("");
      setNewTableDesc("");
      setColumns([{ name: "", type: "text", nullable: true }]);
      await loadAll();
    } catch (err) {
      setCreateError(err.message);
    }
  }

  async function handleAddRowSubmit(e) {
    e.preventDefault();
    setAddRowError("");

    try {
      await insertWorkspaceTableRow(selectedTable, newRowData);
      setShowAddRowModal(false);
      setNewRowData({});
      await handleSelectTable(selectedTable);
    } catch (err) {
      setAddRowError(err.message);
    }
  }

  // DB Settings Handler
  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsStatus("...");
    try {
      await updateWorkspaceDbSettings(dbTitle, dbDesc);
      setSettingsStatus(t("saved_success"));
      await loadAll();
      setTimeout(() => setSettingsStatus(""), 3000);
    } catch (err) {
      setSettingsStatus("Hata: " + err.message);
    }
  }

  const currentSelectedTableMeta = dbSummary?.tables?.find((t) => t.name === selectedTable);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-indigo-400" />
            <span>{t("workspace_title")}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t("workspace_subtitle")}
          </p>
        </div>

        {/* Workspace Sekmeleri */}
        <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab("tables")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "tables"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{t("workspace_tab_tables")}</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t("workspace_tab_settings")}</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: TABLOLAR & VERİ ================= */}
      {activeTab === "tables" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>{t("existing_tables")} ({dbSummary?.tables?.length || 0})</span>
            </h2>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>{t("new_table_btn")}</span>
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-3">...</p>
          ) : !dbSummary?.tables || dbSummary.tables.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
              {t("no_tables")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dbSummary.tables.map((tItem) => {
                return (
                  <div
                    key={tItem.name}
                    onClick={() => handleSelectTable(tItem.name)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                      selectedTable === tItem.name
                        ? "bg-indigo-600/15 border-indigo-500/50"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-semibold text-indigo-300 text-sm">
                          {tItem.name}
                        </span>

                        {tItem.is_owner && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 text-[10px]">
                            {t("workspace_owner_badge")}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                        {tItem.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{tItem.columns.length} {t("columns_count")}</span>
                      </div>
                    </div>

                    {/* Butonlar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-indigo-400 font-medium">
                        {t("view_data")}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleRegenerateQuestions(tItem.name, e)}
                          disabled={generatingQuestionsTable === tItem.name}
                          className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="AI ile Soruları Yenile"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${generatingQuestionsTable === tItem.name ? 'animate-spin text-amber-400' : ''}`} />
                        </button>

                        {/* Sadece sahip silebilir */}
                        {tItem.is_owner && (
                          <button
                            onClick={(e) => handleDeleteTable(tItem.name, e)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Tabloyu Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Seçili Tablo Verileri */}
          {selectedTable && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-400" />
                    <span>
                      {t("table_data_title")} <span className="font-mono text-indigo-300">{selectedTable}</span>
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{rows.length} {t("records_listed")}</p>
                </div>

                {currentSelectedTableMeta?.is_owner && (
                  <button
                    onClick={() => {
                      setNewRowData({});
                      setShowAddRowModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-sm shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("workspace_add_row_btn")}</span>
                  </button>
                )}
              </div>

              {rowsLoading ? (
                <p className="text-xs text-slate-500 py-4">...</p>
              ) : rows.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">{t("no_data_in_table")}</p>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                      <tr>
                        {Object.keys(rows[0]).map((k) => (
                          <th key={k} className="px-4 py-2.5 font-medium">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                      {rows.slice(0, 100).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          {Object.keys(rows[0]).map((k) => (
                            <td key={k} className="px-4 py-2.5 text-slate-300">
                              {r[k] === null || r[k] === undefined ? "-" : String(r[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: DB BİLGİSİ & ÖZET ================= */}
      {activeTab === "settings" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4 max-w-2xl">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>{t("db_settings_title")}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {t("db_settings_desc")}
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t("db_title_label")}</label>
              <input
                type="text"
                value={dbTitle}
                onChange={(e) => setDbTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t("db_desc_label")}
              </label>
              <textarea
                value={dbDesc}
                onChange={(e) => setDbDesc(e.target.value)}
                required
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {settingsStatus && <p className="text-xs text-emerald-400">{settingsStatus}</p>}

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20"
            >
              {t("save_update_btn")}
            </button>
          </form>
        </div>
      )}

      {/* Yeni Tablo Modalı */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">{t("create_table_modal_title")}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t("table_name_label")}</label>
                <input
                  type="text"
                  placeholder="products, siparisler"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value.toLowerCase())}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t("table_desc_label")} <span className="text-rose-400">{t("required_tag")}</span>
                </label>
                <textarea
                  placeholder={t("table_desc_placeholder")}
                  value={newTableDesc}
                  onChange={(e) => setNewTableDesc(e.target.value)}
                  required
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Kolonlar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-300">
                    {t("columns_label")} <span className="text-[10px] text-slate-500">{t("id_auto_notice")}</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("columns_add_btn")}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {columns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="col_name"
                        value={col.name}
                        onChange={(e) => handleColumnChange(idx, "name", e.target.value.toLowerCase())}
                        required
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => handleColumnChange(idx, "type", e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                      >
                        {allowedTypes.map((typeOption) => (
                          <option key={typeOption} value={typeOption}>
                            {typeOption}
                          </option>
                        ))}
                      </select>
                      {columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {createError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20"
                >
                  {t("create_table_submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Satır Ekleme Modalı */}
      {showAddRowModal && currentSelectedTableMeta && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                {t("workspace_insert_row_title")} ({selectedTable})
              </h3>
              <button
                onClick={() => setShowAddRowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRowSubmit} className="space-y-3">
              {currentSelectedTableMeta.columns
                .filter((col) => col.name !== "id")
                .map((col) => (
                  <div key={col.name}>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {col.name} <span className="text-[10px] text-slate-500">({col.type})</span>
                    </label>
                    <input
                      type="text"
                      value={newRowData[col.name] || ""}
                      onChange={(e) =>
                        setNewRowData({ ...newRowData, [col.name]: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                ))}

              {addRowError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                  {addRowError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20"
                >
                  {t("workspace_insert_row_submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
