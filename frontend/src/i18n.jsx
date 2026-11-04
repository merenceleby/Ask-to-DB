import React, { createContext, useContext, useState, useEffect } from "react";

const translations = {
  tr: {
    // Nav
    app_title: "SQL AI Assistant",
    nav_ask: "Soru Sor",
    nav_workspace: "Tablolarım / Çalışma Alanı",
    logout: "Çıkış Yap",
    lang_toggle: "English",

    // Workspace
    workspace_title: "Çalışma Alanı & Veri Yönetimi",
    workspace_subtitle: "Kendi tablolarınızı oluşturun, verilerinizi yönetin ve yapay zeka ile otomatik örnek sorular üretin.",
    workspace_tab_tables: "Tablolar & Veri",
    workspace_tab_settings: "DB Bilgisi & Özet",
    workspace_owner_badge: "Sahibi Sizsiniz",
    workspace_add_row_btn: "Yeni Satır Ekle",
    workspace_insert_row_title: "Tabloya Yeni Satır Ekle",
    workspace_insert_row_submit: "Satırı Kaydet",

    // Login
    login_title: "SQL AI Assistant",
    login_subtitle: "Doğal dille veritabanı sorgulama asistanına hoş geldiniz.",
    login_username: "Kullanıcı Adı",
    login_password: "Şifre",
    login_btn: "Giriş Yap",
    login_loading: "Giriş yapılıyor...",
    login_error: "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.",
    login_footer: "Yalnızca yetkili hesaplar erişebilir",

    // Ask Page
    history_title: "Soru Geçmişi",
    history_clear: "Temizle",
    history_empty: "Henüz soru sorulmadı.",
    history_show_mobile: "Soru Geçmişini Göster",
    db_default_title: "Veritabanı",
    tables_ready: "Tablo Hazır",
    inspect_tables: "Tabloları İncele",
    columns_count: "kolon",
    columns_label: "Kolonlar:",
    sample_questions_title: "Örnek Sorular (Tek tıkla sor):",
    search_placeholder: "Veritabanına doğal dille soru sor... (Örn: En çok harcama yapan ilk 3 müşteri kim?)",
    ask_btn: "Sor",
    thinking: "Düşünüyor...",
    query_failed_title: "Sorgu Çalıştırılamadı",
    query_failed_desc: "Sorgu işlenirken bir hata oluştu.",
    ai_response_label: "AI Yanıtı",
    show_sql: "Üretilen SQL'i İncele",
    hide_sql: "Üretilen SQL'i Gizle",
    copy: "Kopyala",
    copied: "Kopyalandı",
    data_table_tab: "Veri Tablosu",
    chart_tab: "Grafik Görünümü",
    download_csv: "CSV Olarak İndir",

    // Admin Page
    admin_title: "Yönetim Paneli (Admin)",
    admin_subtitle: "Veritabanı tablolarını, kullanıcı yetkilerini ve metadata ayarlarını yönetin.",
    tab_tables: "Tablolar & Şema",
    tab_users: "Kullanıcılar",
    tab_metadata: "DB Bilgisi & Özet",
    tab_system: "Test & Demo Araçları",

    // Admin Tables
    existing_tables: "Mevcut Tablolar",
    new_table_btn: "Yeni Tablo Oluştur",
    no_tables: "Henüz hiç iş tablosu yok. Sağ üstteki butondan yeni tablo oluşturabilir veya 'Test & Demo Araçları' sekmesinden hazır demo tabloları yükleyebilirsiniz.",
    view_data: "Verileri Gör →",
    table_data_title: "Tablo Verileri:",
    records_listed: "kayıt listeleniyor",
    no_data_in_table: "Bu tabloda henüz hiç veri yok.",
    create_table_modal_title: "Yeni Veritabanı Tablosu Oluştur",
    table_name_label: "Tablo Adı",
    table_desc_label: "Tablo Açıklaması / Özeti",
    required_tag: "* (Zorunlu)",
    table_desc_placeholder: "Bu tablo neyi tutuyor? (AI'ın isabetli sorgu üretmesi ve kullanıcıların anlaması için gereklidir)",
    columns_add_btn: "Kolon Ekle",
    id_auto_notice: "('id' otomatik eklenir)",
    cancel: "İptal",
    create_table_submit: "Tabloyu Oluştur",
    ai_questions_regenerated: "tablosu için örnek sorular AI tarafından başarıyla üretildi!",
    ai_questions_error: "AI ile sorular üretilemedi:",

    // Admin Users
    registered_users: "Kayıtlı Kullanıcılar",
    col_id: "ID",
    col_username: "Kullanıcı Adı",
    col_admin: "Yönetici (Admin)?",
    col_action: "İşlem",
    admin_badge: "Admin",
    standard_badge: "Standart",
    delete: "Sil",
    new_username_ph: "Yeni Kullanıcı Adı",
    new_password_ph: "Şifre",
    grant_admin_cb: "Admin Yetkisi Ver",
    add_user_btn: "Kullanıcı Ekle",

    // Admin Metadata
    db_settings_title: "Genel Veritabanı Bilgileri & Başlığı",
    db_settings_desc: "Burada belirlediğiniz başlık ve özet, ana sayfada kullanıcılara gösterilir ve yapay zeka modelinin veritabanının amacını daha iyi anlamasını sağlar.",
    db_title_label: "Veritabanı Başlığı",
    db_desc_label: "Veritabanı Genel Açıklaması / Özeti",
    save_update_btn: "Kaydet & Güncelle",
    saved_success: "Ayarlar başarıyla güncellendi.",

    // Admin System / Danger Zone
    demo_setup_title: "Demo Veri Kurulumu",
    demo_setup_desc: "Sistemi sıfırdan test etmek için 5 hazır tabloyu (authors, books, customers, orders, order_items), örnek kayıtları ve hazır metadata açıklamalarını tek tıkla yükleyebilirsiniz.",
    demo_setup_btn: "Demo Verileri ve Tabloları Yükle",
    danger_zone_title: "Tehlikeli Bölge (Danger Zone): Demo Verileri Temizle",
    danger_zone_desc: "Bu işlem 5 demo tablosunu (authors, books, customers, orders, order_items) ve içlerindeki tüm verileri veritabanından kalıcı olarak kaldırır.",
    danger_zone_btn: "Demo Tabloları Kalıcı Olarak Sil",
    confirm_title: "Emin misiniz?",
    confirm_desc: "Demo veriler ve ilişkili 5 tablo veritabanından tamamen silinecektir. Bu işlem geri alınamaz.",
    confirm_yes: "Evet, Sil",
    confirm_no: "Vazgeç",
  },
  en: {
    // Nav
    app_title: "SQL AI Assistant",
    nav_ask: "Ask Questions",
    nav_workspace: "My Tables / Workspace",
    logout: "Log out",
    lang_toggle: "Türkçe",

    // Workspace
    workspace_title: "Workspace & Data Management",
    workspace_subtitle: "Create your own tables, manage data, and automatically generate AI sample questions.",
    workspace_tab_tables: "Tables & Data",
    workspace_tab_settings: "DB Info & Summary",
    workspace_owner_badge: "Owner",
    workspace_add_row_btn: "Add New Row",
    workspace_insert_row_title: "Add Row to Table",
    workspace_insert_row_submit: "Save Row",

    // Login
    login_title: "SQL AI Assistant",
    login_subtitle: "Welcome to natural language database querying assistant.",
    login_username: "Username",
    login_password: "Password",
    login_btn: "Sign in",
    login_loading: "Signing in...",
    login_error: "Login failed. Please check your credentials.",
    login_footer: "Only authorized accounts can access",

    // Ask Page
    history_title: "Question History",
    history_clear: "Clear",
    history_empty: "No questions asked yet.",
    history_show_mobile: "Show Question History",
    db_default_title: "Database",
    tables_ready: "Tables Ready",
    inspect_tables: "Inspect Tables",
    columns_count: "columns",
    columns_label: "Columns:",
    sample_questions_title: "Sample Questions (Click to ask):",
    search_placeholder: "Ask your database in plain English... (e.g. Which customer spent the most money?)",
    ask_btn: "Ask",
    thinking: "Thinking...",
    query_failed_title: "Query Failed",
    query_failed_desc: "An error occurred while processing the query.",
    ai_response_label: "AI Response",
    show_sql: "Inspect Generated SQL",
    hide_sql: "Hide Generated SQL",
    copy: "Copy",
    copied: "Copied",
    data_table_tab: "Data Table",
    chart_tab: "Chart View",
    download_csv: "Download CSV",

    // Admin Page
    admin_title: "Admin Dashboard",
    admin_subtitle: "Manage database tables, user permissions and metadata settings.",
    tab_tables: "Tables & Schema",
    tab_users: "Users",
    tab_metadata: "DB Info & Summary",
    tab_system: "Test & Demo Tools",

    // Admin Tables
    existing_tables: "Existing Tables",
    new_table_btn: "Create New Table",
    no_tables: "No business tables exist yet. You can create a new table from top right or seed demo tables from 'Test & Demo Tools'.",
    view_data: "View Data →",
    table_data_title: "Table Data:",
    records_listed: "records listed",
    no_data_in_table: "No data in this table yet.",
    create_table_modal_title: "Create New Database Table",
    table_name_label: "Table Name",
    table_desc_label: "Table Description / Summary",
    required_tag: "* (Required)",
    table_desc_placeholder: "What does this table store? (Essential for AI accuracy and user clarity)",
    columns_add_btn: "Add Column",
    id_auto_notice: "('id' PK added automatically)",
    cancel: "Cancel",
    create_table_submit: "Create Table",
    ai_questions_regenerated: "sample questions successfully generated by AI for",
    ai_questions_error: "Failed to generate AI questions:",

    // Admin Users
    registered_users: "Registered Users",
    col_id: "ID",
    col_username: "Username",
    col_admin: "Admin?",
    col_action: "Action",
    admin_badge: "Admin",
    standard_badge: "Standard",
    delete: "Delete",
    new_username_ph: "New Username",
    new_password_ph: "Password",
    grant_admin_cb: "Grant Admin Role",
    add_user_btn: "Add User",

    // Admin Metadata
    db_settings_title: "General Database Info & Title",
    db_settings_desc: "The title and description configured here guide the AI model and provide context to end users on the home page.",
    db_title_label: "Database Title",
    db_desc_label: "General Database Description / Summary",
    save_update_btn: "Save & Update",
    saved_success: "Settings updated successfully.",

    // Admin System / Danger Zone
    demo_setup_title: "Demo Data Setup",
    demo_setup_desc: "Instantly create the 5 starter tables (authors, books, customers, orders, order_items), seed sample records and default metadata.",
    demo_setup_btn: "Load Demo Data and Tables",
    danger_zone_title: "Danger Zone: Purge Demo Data",
    danger_zone_desc: "This will permanently drop the 5 demo tables (authors, books, customers, orders, order_items) and all their rows.",
    danger_zone_btn: "Permanently Delete Demo Tables",
    confirm_title: "Are you sure?",
    confirm_desc: "Demo data and the 5 tables will be permanently deleted. This action cannot be undone.",
    confirm_yes: "Yes, Delete",
    confirm_no: "Cancel",
  },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("app_lang") || "tr";
  });

  useEffect(() => {
    localStorage.setItem("app_lang", lang);
  }, [lang]);

  const toggleLang = () => {
    setLang((prev) => (prev === "tr" ? "en" : "tr"));
  };

  const t = (key) => {
    return translations[lang]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

