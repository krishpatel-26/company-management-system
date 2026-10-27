import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./services/api";
import "./CommunicationCentre.css";

function personName(person) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ") || person?.username || `Employee ${person?.employee_id ?? ""}`;
}
function prettyDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function dateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export default function CommunicationCentre({ user }) {
  const [contacts, setContacts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [requestForm, setRequestForm] = useState({ employee_id: "", start_date: "", end_date: "", due_date: "", request_message: "Please complete and submit your timesheet for the selected dates." });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedPerson = useMemo(() => contacts.find(c => String(c.employee_id) === String(selectedContact)), [contacts, selectedContact]);

  const loadBase = useCallback(async () => {
    setError("");
    try {
      const [contactData, notificationData, requestData] = await Promise.all([
        apiRequest("/communication/contacts"),
        apiRequest("/communication/notifications"),
        apiRequest("/communication/timesheet-requests")
      ]);
      const nextContacts = Array.isArray(contactData?.contacts) ? contactData.contacts : [];
      setContacts(nextContacts);
      setNotifications(Array.isArray(notificationData?.notifications) ? notificationData.notifications : []);
      setRequests(Array.isArray(requestData?.requests) ? requestData.requests : []);
      setSelectedContact(current => current && nextContacts.some(c => String(c.employee_id) === current) ? current : (nextContacts[0] ? String(nextContacts[0].employee_id) : ""));
      setRequestForm(current => ({ ...current, employee_id: current.employee_id || String(nextContacts.find(c => c.manager_id === undefined) ?.employee_id || "") }));
    } catch (e) {
      setError(e.message || "Could not load the communication centre.");
    } finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!selectedContact) { setMessages([]); return; }
    try {
      const data = await apiRequest(`/communication/messages/${encodeURIComponent(selectedContact)}`);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e) {
      setMessages([]);
      if (e.message && !e.message.includes("403")) setError(e.message);
    }
  }, [selectedContact]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedContact || !draft.trim()) return;
    setSending(true); setError(""); setNotice("");
    try {
      await apiRequest("/communication/messages", { method: "POST", body: JSON.stringify({ recipient_employee_id: Number(selectedContact), message_text: draft.trim() }) });
      setDraft(""); await loadMessages(); await loadBase(); setNotice("Message sent.");
    } catch (e) { setError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  }

  async function markRead(notification) {
    if (notification.is_read) return;
    try {
      await apiRequest(`/communication/notifications/${notification.notification_id}/read`, { method: "PATCH" });
      setNotifications(current => current.map(n => n.notification_id === notification.notification_id ? { ...n, is_read: 1 } : n));
    } catch (e) { setError(e.message || "Could not update notification."); }
  }

  async function createRequest(event) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      await apiRequest("/communication/timesheet-requests", { method: "POST", body: JSON.stringify({ ...requestForm, employee_id: Number(requestForm.employee_id) }) });
      setNotice("Timesheet request sent. The employee will receive an in-app notification.");
      await loadBase();
    } catch (e) { setError(e.message || "Request could not be sent. Only a direct manager can request a report's timesheets."); }
  }

  async function completeRequest(requestId) {
    setError(""); setNotice("");
    try {
      await apiRequest(`/communication/timesheet-requests/${requestId}/complete`, { method: "PATCH" });
      setNotice("Request marked completed."); await loadBase();
    } catch (e) { setError(e.message || "Could not complete request."); }
  }

  if (loading) return <main className="cc-page"><div className="cc-loading">Loading communication centre…</div></main>;
  const unreadCount = notifications.filter(n => !Number(n.is_read)).length;

  return <main className="cc-page">
    <header className="cc-header">
      <div><div className="cc-eyebrow">WORKSPACE / COMMUNICATION</div><h1>Communication centre</h1><p>Message your manager or direct reports, and follow up on timesheet requests.</p></div>
      <button className="cc-secondary" onClick={() => { setLoading(true); loadBase(); }}>↻ Refresh</button>
    </header>
    {error && <div className="cc-alert cc-error" role="alert">{error}</div>}
    {notice && <div className="cc-alert cc-success" role="status">{notice}</div>}
    <div className="cc-stats">
      <div className="cc-stat"><span>Unread notifications</span><strong>{unreadCount}</strong></div>
      <div className="cc-stat"><span>Open timesheet requests</span><strong>{requests.filter(r => r.request_status === "OPEN").length}</strong></div>
      <div className="cc-stat"><span>Contacts</span><strong>{contacts.length}</strong></div>
    </div>
    <div className="cc-grid">
      <section className="cc-panel cc-chat-panel">
        <div className="cc-panel-head"><div><h2>Private messages</h2><p>Conversations with your manager or direct reports</p></div></div>
        <label className="cc-label" htmlFor="cc-contact">Conversation</label>
        <select id="cc-contact" className="cc-input" value={selectedContact} onChange={e => setSelectedContact(e.target.value)}>
          {contacts.length === 0 && <option value="">No manager or direct reports found</option>}
          {contacts.map(c => <option key={c.employee_id} value={c.employee_id}>{personName(c)}</option>)}
        </select>
        <div className="cc-messages" aria-live="polite">
          {!selectedContact && <div className="cc-empty">No eligible contacts found. Your employee record must identify your manager or direct reports.</div>}
          {selectedContact && messages.length === 0 && <div className="cc-empty">No messages yet. Start the conversation below.</div>}
          {messages.map(m => {
            const mine = Number(m.sender_employee_id) !== Number(selectedContact);
            return <div key={m.message_id} className={`cc-message-row ${mine ? "cc-mine" : "cc-theirs"}`}>
              <div className="cc-message"><div className="cc-message-author">{mine ? "You" : personName({ first_name: m.sender_first_name, last_name: m.sender_last_name })}</div><div>{m.message_text}</div><time>{prettyDate(m.sent_at)}</time></div>
            </div>;
          })}
        </div>
        <form className="cc-compose" onSubmit={sendMessage}>
          <textarea className="cc-input cc-textarea" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" maxLength={5000} rows={3} disabled={!selectedContact} />
          <div className="cc-compose-footer"><span>{draft.length}/5000</span><button className="cc-primary" disabled={sending || !selectedContact || !draft.trim()}>{sending ? "Sending…" : "Send message →"}</button></div>
        </form>
      </section>
      <section className="cc-panel">
        <div className="cc-panel-head"><div><h2>Notifications</h2><p>Requests and messages sent to you</p></div><span className="cc-count">{notifications.length}</span></div>
        <div className="cc-list">
          {notifications.length === 0 && <div className="cc-empty">You’re all caught up. New reminders will appear here.</div>}
          {notifications.map(n => <article key={n.notification_id} className={`cc-notification ${!Number(n.is_read) ? "cc-unread" : ""}`}>
            <div className="cc-notification-top"><strong>{n.title}</strong><span className="cc-dot" /></div>
            <p>{n.body}</p>
            {(n.related_start_date || n.related_end_date) && <div className="cc-date-range">Dates: {dateOnly(n.related_start_date)} – {dateOnly(n.related_end_date)}</div>}
            {n.due_date && <div className="cc-date-range">Due: {dateOnly(n.due_date)}</div>}
            <div className="cc-notification-bottom"><time>{prettyDate(n.created_at)}</time>{!Number(n.is_read) && <button className="cc-text-button" onClick={() => markRead(n)}>Mark read</button>}</div>
          </article>)}
        </div>
      </section>
    </div>
    <div className="cc-grid cc-bottom-grid">
      <section className="cc-panel">
        <div className="cc-panel-head"><div><h2>Request missing timesheets</h2><p>Managers can send date-specific reminders to their direct reports.</p></div></div>
        <form className="cc-request-form" onSubmit={createRequest}>
          <label className="cc-label">Employee
            <select className="cc-input" required value={requestForm.employee_id} onChange={e => setRequestForm(v => ({ ...v, employee_id: e.target.value }))}>
              <option value="">Choose a direct report</option>
              {contacts.map(c => <option key={c.employee_id} value={c.employee_id}>{personName(c)}</option>)}
            </select>
          </label>
          <div className="cc-form-row"><label className="cc-label">From date<input className="cc-input" type="date" required value={requestForm.start_date} onChange={e => setRequestForm(v => ({ ...v, start_date: e.target.value }))} /></label><label className="cc-label">To date<input className="cc-input" type="date" required min={requestForm.start_date || undefined} value={requestForm.end_date} onChange={e => setRequestForm(v => ({ ...v, end_date: e.target.value }))} /></label></div>
          <label className="cc-label">Deadline (optional)<input className="cc-input" type="date" value={requestForm.due_date} onChange={e => setRequestForm(v => ({ ...v, due_date: e.target.value }))} /></label>
          <label className="cc-label">Message<textarea className="cc-input cc-textarea" rows={3} maxLength={3000} required value={requestForm.request_message} onChange={e => setRequestForm(v => ({ ...v, request_message: e.target.value }))} /></label>
          <button className="cc-primary" type="submit">Send timesheet request →</button>
          <p className="cc-hint">The API verifies that the selected employee reports directly to the signed-in manager. Employees cannot create requests on behalf of managers.</p>
        </form>
      </section>
      <section className="cc-panel">
        <div className="cc-panel-head"><div><h2>Timesheet requests</h2><p>Track outstanding reminders and completion.</p></div></div>
        <div className="cc-list">
          {requests.length === 0 && <div className="cc-empty">No timesheet requests yet.</div>}
          {requests.map(r => <article className="cc-request" key={r.request_id}>
            <div className="cc-notification-top"><strong>{personName({ first_name: r.employee_first_name, last_name: r.employee_last_name })}</strong><span className={`cc-status cc-status-${String(r.request_status).toLowerCase()}`}>{r.request_status}</span></div>
            <div className="cc-date-range">{dateOnly(r.start_date)} – {dateOnly(r.end_date)}{r.due_date ? ` · Due ${dateOnly(r.due_date)}` : ""}</div>
            <p>{r.request_message}</p>
            <div className="cc-notification-bottom"><time>Requested {prettyDate(r.created_at)}</time>{r.request_status === "OPEN" && Number(user?.employee_id || user?.id) === Number(r.employee_id) && <button className="cc-text-button" onClick={() => completeRequest(r.request_id)}>Mark completed</button>}</div>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
