const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const TOKEN_KEY = "text_to_sql_token";
const IS_ADMIN_KEY = "text_to_sql_is_admin";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAdmin() {
  return localStorage.getItem(IS_ADMIN_KEY) === "true";
}

export function logout() {
  request("/auth/logout", { method: "POST" }).catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IS_ADMIN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Request failed with ${response.status}`);
  }
  return body;
}

// ---------- Auth ----------

export async function login(username, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(IS_ADMIN_KEY, String(data.is_admin));
  return data;
}

// ---------- Ask ----------

export function askQuestion(question) {
  return request("/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// ---------- Admin: users ----------

export function listUsers() {
  return request("/admin/users");
}

export function createUser(username, password, isAdminFlag) {
  return request("/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, password, is_admin: isAdminFlag }),
  });
}

export function deleteUser(userId) {
  return request(`/admin/users/${userId}`, { method: "DELETE" });
}

// ---------- Admin: demo data ----------

export function seedDemoData() {
  return request("/admin/demo/seed", { method: "POST" });
}

export function resetDemoData() {
  return request("/admin/demo/reset", { method: "POST" });
}

// ---------- Admin: generic table CRUD ----------

export function listTables() {
  return request("/admin/tables");
}

export function listRows(table) {
  return request(`/admin/tables/${table}`);
}

export function createRow(table, values) {
  return request(`/admin/tables/${table}`, {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateRow(table, rowId, values) {
  return request(`/admin/tables/${table}/${rowId}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
}

export function deleteRow(table, rowId) {
  return request(`/admin/tables/${table}/${rowId}`, { method: "DELETE" });
}

// ---------- Workspace (User-owned & Shared Tables) ----------

export function listWorkspaceTables() {
  return request("/workspace/tables");
}

export function createWorkspaceTable(tableName, columns, description, sampleQuestions = []) {
  return request("/workspace/tables", {
    method: "POST",
    body: JSON.stringify({
      table_name: tableName,
      columns,
      description,
      sample_questions: sampleQuestions,
    }),
  });
}

export function updateWorkspaceDbSettings(dbTitle, dbDescription) {
  return request("/workspace/settings", {
    method: "PUT",
    body: JSON.stringify({ db_title: dbTitle, db_description: dbDescription }),
  });
}

export function deleteWorkspaceTable(tableName) {
  return request(`/workspace/tables/${tableName}`, {
    method: "DELETE",
  });
}

export function getWorkspaceTableRows(tableName) {
  return request(`/workspace/tables/${tableName}/rows`);
}

export function insertWorkspaceTableRow(tableName, values) {
  return request(`/workspace/tables/${tableName}/rows`, {
    method: "POST",
    body: JSON.stringify(values),
  });
}

// ---------- Metadata & DB Summary ----------

export function getDbSummary() {
  return request("/metadata/summary");
}

export function updateDbSettings(dbTitle, dbDescription) {
  return request("/admin/metadata/settings", {
    method: "PUT",
    body: JSON.stringify({ db_title: dbTitle, db_description: dbDescription }),
  });
}

export function updateTableMetadata(tableName, description, sampleQuestions = []) {
  return request(`/admin/metadata/tables/${tableName}`, {
    method: "PUT",
    body: JSON.stringify({ description, sample_questions: sampleQuestions }),
  });
}

export function generateTableQuestions(tableName) {
  return request(`/admin/metadata/tables/${tableName}/generate-questions`, {
    method: "POST",
  });
}

// ---------- Admin: dynamic schema (create/drop tables) ----------

export function getColumnTypes() {
  return request("/admin/schema/column-types");
}

export function createTable(tableName, columns, description, sampleQuestions = []) {
  return request("/admin/schema/tables", {
    method: "POST",
    body: JSON.stringify({
      table_name: tableName,
      columns,
      description,
      sample_questions: sampleQuestions,
    }),
  });
}

export function dropTable(tableName) {
  return request(`/admin/schema/tables/${tableName}`, { method: "DELETE" });
}
