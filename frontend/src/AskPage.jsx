import { useEffect, useState } from "react";
import { askQuestion, getDbSummary } from "./api";
import { useLanguage } from "./i18n";
import {
  Database,
  Search,
  Sparkles,
  Code2,
  Table as TableIcon,
  BarChart3,
  Download,
  ChevronDown,
  ChevronRight,
  History,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function AskPage() {
  const { t } = useLanguage();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewTab, setViewTab] = useState("table"); // 'table' | 'chart'

  // DB Summary
  const [dbSummary, setDbSummary] = useState(null);
  const [showDbDetails, setShowDbDetails] = useState(false);
  const [activeTableDetail, setActiveTableDetail] = useState(null);

  // History
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("sql_ai_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    try {
      const data = await getDbSummary();
      setDbSummary(data);
    } catch (err) {
      console.error("DB özeti alınamadı:", err);
    }
  }

  async function handleAsk(qToAsk) {
    const q = (typeof qToAsk === "string" ? qToAsk : question).trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await askQuestion(q);
      const newEntry = {
        id: Date.now(),
        question: q,
        answer: data.answer,
        sql: data.sql,
        rows: data.rows,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setResult(newEntry);
      setHistory((prev) => {
        const updated = [newEntry, ...prev.filter((item) => item.question !== q)].slice(0, 20);
        localStorage.setItem("sql_ai_history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError(err.message || t("query_failed_desc"));
    } finally {
      setLoading(false);
    }
  }

  function handleChipClick(chipQuestion) {
    setQuestion(chipQuestion);
    handleAsk(chipQuestion);
  }

  function handleSelectHistoryItem(item) {
    setQuestion(item.question);
    setResult(item);
    setError("");
    setShowHistory(false);
  }

  function handleCopySql() {
    if (!result?.sql) return;
    navigator.clipboard.writeText(result.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportCsv() {
    if (!result?.rows || result.rows.length === 0) return;
    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] === null || row[h] === undefined ? "" : String(row[h]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sorgu_sonucu_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Detect numeric and label columns for charting
  const chartConfig = (() => {
    if (!result?.rows || result.rows.length === 0) return null;
    const first = result.rows[0];
    const keys = Object.keys(first);

    const numericKeys = keys.filter((k) => typeof first[k] === "number" && k !== "id");
    const labelKeys = keys.filter((k) => typeof first[k] === "string" || k.includes("name") || k.includes("title"));

    if (numericKeys.length > 0) {
      return {
        labelKey: labelKeys[0] || keys[0],
        numericKey: numericKeys[0],
      };
    }
    return null;
  })();

  const allSampleQuestions = [];
  if (dbSummary?.tables) {
    dbSummary.tables.forEach((t) => {
      if (Array.isArray(t.sample_questions)) {
        t.sample_questions.forEach((sq) => {
          if (!allSampleQuestions.includes(sq)) allSampleQuestions.push(sq);
        });
      }
    });
  }

  return (
    <div className="flex gap-6 max-w-7xl mx-auto w-full relative">
      {/* Soru Geçmişi Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 p-4 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:bg-slate-900/40 md:rounded-2xl md:border md:border-slate-800/80 md:h-fit ${
          showHistory ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <History className="w-4 h-4 text-indigo-400" />
            <span>{t("history_title")}</span>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => {
                setHistory([]);
                localStorage.removeItem("sql_ai_history");
              }}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
              title={t("history_clear")}
            >
              {t("history_clear")}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            {t("history_empty")}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectHistoryItem(item)}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex flex-col gap-1 border ${
                  result?.id === item.id
                    ? "bg-indigo-600/15 border-indigo-500/30 text-indigo-300"
                    : "bg-slate-950/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <span className="font-medium truncate">{item.question}</span>
                <span className="text-[10px] text-slate-500">{item.timestamp}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Karartma Arka Planı (Mobil) */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Ana İçerik Alanı */}
      <main className="flex-1 space-y-6 min-w-0">
        {/* Mobilde Geçmiş Butonu */}
        <div className="md:hidden flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 text-xs text-indigo-400 font-medium"
          >
            <History className="w-4 h-4" />
            <span>{t("history_show_mobile")} ({history.length})</span>
          </button>
        </div>

        {/* 1. Veritabanı & Tablo Bilgilendirme Kartı */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mt-0.5">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>{dbSummary?.db_title || t("db_default_title")}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    {dbSummary?.tables?.length || 0} {t("tables_ready")}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {dbSummary?.db_description || "..."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDbDetails(!showDbDetails)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors shrink-0"
            >
              <span>{t("inspect_tables")}</span>
              {showDbDetails ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Açılır Tablo Detayları */}
          {showDbDetails && dbSummary?.tables && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {dbSummary.tables.map((table) => (
                  <div
                    key={table.name}
                    onClick={() =>
                      setActiveTableDetail(
                        activeTableDetail === table.name ? null : table.name
                      )
                    }
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      activeTableDetail === table.name
                        ? "bg-indigo-600/10 border-indigo-500/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span className="text-indigo-300 font-mono">{table.name}</span>
                      <span className="text-[10px] text-slate-500">
                        {table.columns.length} {t("columns_count")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {table.description}
                    </p>

                    {activeTableDetail === table.name && (
                      <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1">
                        <span className="text-[10px] text-slate-500 font-medium block mb-1">
                          {t("columns_label")}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {table.columns.map((col) => (
                            <span
                              key={col.name}
                              className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono"
                            >
                              {col.name} {col.primary_key ? "(PK)" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Akıllı Örnek Soru Çipleri */}
        {allSampleQuestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t("sample_questions_title")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allSampleQuestions.slice(0, 5).map((qText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(qText)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-indigo-200 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>{qText}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Arama & Soru Giriş Kutusu */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="relative"
        >
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-slate-500 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-28 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 shadow-xl transition-all"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium rounded-xl text-xs transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("thinking")}</span>
                </>
              ) : (
                <>
                  <span>{t("ask_btn")}</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Hata Mesajı */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">{t("query_failed_title")}</p>
              <p className="text-xs text-rose-400/90 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* 4. Sonuç & Analiz Alanı */}
        {result && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm space-y-6">
            {/* Doğal Dil Cevabı */}
            <div>
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1.5">
                {t("ai_response_label")}
              </span>
              <p className="text-base text-slate-100 font-normal leading-relaxed">
                {result.answer}
              </p>
            </div>

            {/* SQL Sorgusu Görünümü */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-950/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800/60">
                <button
                  onClick={() => setShowSql(!showSql)}
                  className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{showSql ? t("hide_sql") : t("show_sql")}</span>
                  {showSql ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>

                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t("copy")}</span>
                    </>
                  )}
                </button>
              </div>

              {showSql && (
                <pre className="p-4 text-xs font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  <code>{result.sql}</code>
                </pre>
              )}
            </div>

            {/* Veri Tablosu & Grafik Görünümü */}
            {result.rows && result.rows.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewTab("table")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        viewTab === "table"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200 bg-slate-800/50"
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>{t("data_table_tab")} ({result.rows.length})</span>
                    </button>

                    {chartConfig && (
                      <button
                        onClick={() => setViewTab("chart")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          viewTab === "chart"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200 bg-slate-800/50"
                        }`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>{t("chart_tab")}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t("download_csv")}</span>
                  </button>
                </div>

                {viewTab === "table" ? (
                  <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                        <tr>
                          {Object.keys(result.rows[0]).map((col) => (
                            <th key={col} className="px-4 py-3 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {result.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            {Object.keys(result.rows[0]).map((col) => (
                              <td key={col} className="px-4 py-3 text-slate-200">
                                {row[col] === null || row[col] === undefined
                                  ? "-"
                                  : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  chartConfig && (
                    <div className="h-64 w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.rows}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey={chartConfig.labelKey}
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "#334155",
                              borderRadius: "8px",
                              color: "#fff",
                              fontSize: "12px",
                            }}
                          />
                          <Bar
                            dataKey={chartConfig.numericKey}
                            fill="#6366f1"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
