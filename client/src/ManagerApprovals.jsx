import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./services/api";

function listOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.timesheets)) return data.timesheets;
  return [];
}
function employeeName(row) {
  return row.employee_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || `Employee ${row.employee_id || ""}`;
}
function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(String(value).slice(0, 10) + "T12:00:00");
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ManagerApprovals({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiRequest("/timesheets/pending-approval");
      setItems(listOf(data));
    } catch (err) {
      setError(err?.message || "Could not load pending timesheets.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (item, status) => {
    setBusyId(item.timesheet_id); setError(""); setNotice("");
    const comment = String(comments[item.timesheet_id] || "").trim();
    if (status === "REJECTED" && !comment) {
      setError(`Add a short reason before declining ${employeeName(item)}'s entry.`);
      setBusyId(null); return;
    }
    try {
      const result = await apiRequest(`/timesheets/${item.timesheet_id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, review_comment: comment }),
      });
      setNotice(result?.message || `Timesheet ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not update this timesheet.");
    } finally { setBusyId(null); }
  };

  const name = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Manager";
  return <div className="app-shell approvals-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Company Management home"><span className="brand-icon">C</span><span className="brand-copy"><strong>Company</strong><strong>Management</strong></span></a>
      <div className="nav-section"><p className="nav-heading">WORKSPACE</p><nav className="sidebar-nav" aria-label="Workspace">
        <a className="nav-item" href="/"><span className="nav-icon">⌂</span><span>Overview</span></a>
        <a className="nav-item" href="/timesheets.html"><span className="nav-icon">◷</span><span>My Timesheets</span></a>
        <a className="nav-item active" href="/approvals.html"><span className="nav-icon">✓</span><span>Pending approvals</span>{items.length > 0 && <span className="nav-badge">{items.length}</span>}</a>
      </nav></div>
      <div className="sidebar-footer"><div className="connection-status"><span className="status-dot"/><span>Workspace connected</span></div><span className="sidebar-footer-note">Manager review queue</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="timesheet-breadcrumb"><span className="eyebrow">MANAGER WORKSPACE</span><span className="breadcrumb-divider">/</span><strong>Pending approvals</strong></div><div className="topbar-actions"><span className="api-status"><span className="status-dot"/>API ONLINE</span><div className="user-menu"><span className="avatar">{name.split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><div className="user-copy"><strong>{name}</strong><span>Manager</span></div><button className="signout-button" onClick={onLogout} type="button">Sign out</button></div></div></header>
      <section className="dashboard">
        <div className="page-heading"><div><span className="eyebrow">TIMESHEET WORKFLOW</span><h1>Pending approvals</h1><p>Review each direct report’s submitted project hours. Approved entries become read-only for the employee.</p></div><button className="secondary-button" type="button" onClick={load} disabled={loading}>↻ Refresh</button></div>
        {error && <div className="notice notice-error" role="alert"><div><strong>Action needed</strong><p>{error}</p></div><button className="notice-dismiss" type="button" onClick={() => setError("")}>×</button></div>}
        {notice && <div className="notice notice-success" role="status"><div><strong>Review saved</strong><p>{notice}</p></div><button className="notice-dismiss" type="button" onClick={() => setNotice("")}>×</button></div>}
        <section className="panel approvals-panel"><div className="panel-heading"><div><h2>Timesheets awaiting your decision</h2><p>Only submissions from employees who report directly to you are listed.</p></div><span className="records-count">{items.length} pending</span></div>
          {loading ? <p className="empty-state">Loading approval queue…</p> : items.length === 0 ? <div className="approval-empty"><span className="approval-empty-icon">✓</span><strong>You’re all caught up</strong><p>New submissions from your direct reports will appear here.</p></div> : <div className="table-scroll"><table className="timesheet-table approvals-table"><thead><tr><th>EMPLOYEE</th><th>DATE</th><th>PROJECT</th><th>WORK SUMMARY</th><th>HOURS</th><th>REVIEW COMMENT</th><th>ACTION</th></tr></thead><tbody>{items.map((item) => <tr key={item.timesheet_id}>
            <td><strong>{employeeName(item)}</strong><small className="table-subtext">{item.job_title || item.username || `ID ${item.employee_id}`}</small></td>
            <td>{dateLabel(item.work_date)}</td>
            <td><strong>{item.project_name || `Project ${item.project_id || ""}`}</strong><small className="table-subtext">{item.project_code || ""}</small></td>
            <td className="work-summary-cell">{item.work_description || "—"}</td>
            <td><strong>{Number(item.hours_worked || 0).toFixed(2)} h</strong></td>
            <td><input className="review-comment-input" value={comments[item.timesheet_id] || ""} onChange={(event) => setComments((current) => ({ ...current, [item.timesheet_id]: event.target.value }))} placeholder="Required if declining" aria-label={`Review comment for ${employeeName(item)}`} /></td>
            <td><div className="review-actions"><button type="button" className="approve-button" disabled={busyId === item.timesheet_id} onClick={() => review(item, "APPROVED")}>{busyId === item.timesheet_id ? "Saving…" : "Approve"}</button><button type="button" className="decline-button" disabled={busyId === item.timesheet_id} onClick={() => review(item, "REJECTED")}>Decline</button></div></td>
          </tr>)}</tbody></table></div>}
        </section>
        <footer className="dashboard-footer"><span>Company Management</span><span>Signed in as {name}</span></footer>
      </section>
    </main>
  </div>;
}
