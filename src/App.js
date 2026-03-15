import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./App.css";
import axios from "axios";
import { io } from "socket.io-client";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── STATIC DATA ──────────────────────────────────────────────────────────────
const TASK_TEMPLATES = [
  { id: "t1", label: "Client Follow-up",   icon: "📞", desc: "Call and follow up with existing clients in your zone",       priority: "high"   },
  { id: "t2", label: "Prospect Visit",     icon: "🏢", desc: "Visit 2 new prospect businesses in your territory",           priority: "high"   },
  { id: "t3", label: "Sales Report",       icon: "📊", desc: "Submit today's activity and sales summary report",            priority: "medium" },
  { id: "t4", label: "Product Demo",       icon: "🎯", desc: "Schedule and conduct a product demo for a warm lead",         priority: "medium" },
  { id: "t5", label: "Market Survey",      icon: "🗺️", desc: "Survey 3 potential new clients in your zone",                priority: "low"    },
  { id: "t6", label: "Competitor Check",   icon: "🔍", desc: "Gather intel on competitor activity in your territory",       priority: "low"    },
  { id: "t7", label: "Pending Collection", icon: "💵", desc: "Collect outstanding payments from previous orders",           priority: "high"   },
  { id: "t8", label: "Restock Demo Kit",   icon: "🧳", desc: "Replenish your product demo materials and samples",           priority: "low"    },
];

const NOTIFY_TEMPLATES = [
  "⚠️ You've been idle for too long. Please resume field activity.",
  "📍 Check in with your nearest client and update your status.",
  "🎯 Your daily target is not on track — action needed now.",
  "📞 Please call your assigned prospects and log the outcome.",
  "🔔 Manager alert: Your productivity score is below threshold.",
];

const MAP_POS = [
  { x: 18, y: 38 }, { x: 55, y: 22 }, { x: 28, y: 65 },
  { x: 72, y: 45 }, { x: 42, y: 78 }, { x: 65, y: 68 },
];

export const STATUS_META = {
  visiting:  { color: "#00e5a0", label: "On Visit",  bg: "rgba(0,229,160,0.12)"  },
  idle:      { color: "#ff4d6d", label: "Idle",      bg: "rgba(255,77,109,0.12)" },
  traveling: { color: "#ffba08", label: "Traveling", bg: "rgba(255,186,8,0.12)"  },
};

const IDLE_THRESHOLD = 60;

const EXPENSE_CATEGORIES = [
  { id: "travel", label: "Travel",         icon: "🚗", color: "#ffba08" },
  { id: "food",   label: "Food & Stay",    icon: "🍽️", color: "#fb923c" },
  { id: "client", label: "Client Meeting", icon: "☕", color: "#a78bfa" },
  { id: "other",  label: "Other",          icon: "📝", color: "#34d399" },
];

const MEETING_TYPES = [
  { id: "demo",     label: "Product Demo", icon: "🎯" },
  { id: "followup", label: "Follow-up",    icon: "📞" },
  { id: "closing",  label: "Deal Closing", icon: "💼" },
  { id: "survey",   label: "Market Survey",icon: "📋" },
];

const normalise = (r) => ({ ...r, id: r._id });

// ─── CUSTOM HOOK: useToasts ───────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [{ id, msg, type }, ...p]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, showToast };
}

// ─── CUSTOM HOOK: useModals ───────────────────────────────────────────────────
function useModals() {
  const [modals, setModals] = useState({
    notify: null, assign: null, expense: null,
    meeting: null, route: null,
    leaderboard: false, reports: false, broadcast: false,
  });
  const openModal  = useCallback((name, value = true) => setModals((p) => ({ ...p, [name]: value })), []);
  const closeModal = useCallback((name)               => setModals((p) => ({ ...p, [name]: null  })), []);
  return { modals, openModal, closeModal };
}

// ─── CUSTOM HOOK: useSocket ───────────────────────────────────────────────────
function useSocket({ token, onRepStatus, onRepLocation, onRepOrder, onActivity, onTaskAssigned, onTaskDone, onExpense, onMeeting, onNotification }) {
  const socketRef = useRef(null);
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    socket.emit("manager:join");

    socket.on("rep:status",       onRepStatus);
    socket.on("rep:location",     onRepLocation);
    socket.on("rep:order",        onRepOrder);
    socket.on("activity:new",     onActivity);
    socket.on("task:assigned",    onTaskAssigned);
    socket.on("task:done",        onTaskDone);
    socket.on("expense:new",      onExpense);
    socket.on("meeting:new",      onMeeting);
    socket.on("notification:new", onNotification);

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return socketRef;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const getIdleLabel = (rep) => {
  const m = Math.floor(rep.idleMinutes || 0);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
export const isOverdue = (rep) => rep.status === "idle" && (rep.idleMinutes || 0) >= IDLE_THRESHOLD;

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

// Toast Stack
function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "success" ? "✓" : "!"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// Geofence Alerts
function GeofenceAlerts({ alerts, onDismiss }) {
  if (!alerts.length) return null;
  return (
    <div className="geofence-alerts">
      {alerts.slice(0, 3).map((alert) => (
        <div key={alert.id} className="geo-alert">
          <span className="ga-icon">⚠️</span>
          <span className="ga-text">{alert.repName}: {alert.message}</span>
          <button className="ga-dismiss" onClick={() => onDismiss(alert.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// Idle Banner
function IdleBanner({ overdueReps, onNotify }) {
  if (!overdueReps.length) return null;
  return (
    <div className="idle-banner">
      <span className="ib-pulse" />
      <span className="ib-text">⚠ {overdueReps.length} rep{overdueReps.length > 1 ? "s" : ""} idle over {IDLE_THRESHOLD} min:</span>
      <div className="ib-names">{overdueReps.map((r) => <span key={r.id} className="ib-name">{r.name}</span>)}</div>
      <div className="ib-actions">
        {overdueReps.map((r) => (
          <button key={r.id} className="ib-btn" onClick={() => onNotify(r)}>Notify {r.name.split(" ")[0]}</button>
        ))}
      </div>
    </div>
  );
}

// Header
function Header({ user, stats, now, notifications, onClearNotifs, onLeaderboard, onReports, onBroadcast, onLogout }) {
  return (
    <header className="header">
      <div className="header-scan" />
      <div className="hdr-left">
        <div className="hdr-logo">
          <span className="logo-hex">⬡</span>
          <div>
            <h1 className="logo-title">FIELD<span>COMMAND</span></h1>
            <p className="logo-sub">Sales Intelligence · Real-Time</p>
          </div>
        </div>
      </div>
      <div className="hdr-clock">
        <div className="clock-time">{now.toLocaleTimeString("en-US", { hour12: false })}</div>
        <div className="clock-date">{now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</div>
      </div>
      <div className="hdr-right">
        <div className="hdr-badge green"><span className="badge-dot" />LIVE</div>
        {stats.idle > 0 && <div className="hdr-badge red pulse-badge">{stats.idle} IDLE</div>}
        <div style={{ fontSize: 11, color: "var(--text2)", padding: "4px 10px", background: "rgba(0,217,255,.06)", borderRadius: 6, border: "1px solid var(--border)" }}>
          👤 {user.name}
        </div>
        <button className="icon-btn" onClick={onLeaderboard} title="Leaderboard">🏆</button>
        <button className="icon-btn" onClick={onReports}     title="Reports">📊</button>
        <button className="icon-btn" onClick={onBroadcast}   title="Broadcast">📢</button>
        <button className="icon-btn" onClick={onLogout}      title="Logout" style={{ borderColor: "rgba(255,77,109,.3)" }}>🚪</button>
        <button className="notif-btn" onClick={onClearNotifs}>
          🔔 {notifications > 0 && <span className="notif-count">{notifications}</span>}
        </button>
      </div>
    </header>
  );
}

// KPI Strip
function KpiStrip({ stats, conv }) {
  const kpis = useMemo(() => [
    { label: "Total Reps",  value: stats.total,                               color: "#00d9ff", icon: "👥" },
    { label: "On Visit",    value: stats.active,                              color: "#00e5a0", icon: "📍" },
    { label: "Idle Now",    value: stats.idle,                                color: "#ff4d6d", icon: "⏸", alert: stats.idle > 0 },
    { label: "Traveling",   value: stats.travel,                              color: "#ffba08", icon: "🚗" },
    { label: "Visits",      value: stats.visits,                              color: "#a78bfa", icon: "📊" },
    { label: "Orders",      value: stats.orders,                              color: "#34d399", icon: "💼" },
    { label: "Conversion",  value: `${conv}%`,                                color: "#fb923c", icon: "📈" },
    { label: "Revenue",     value: `₹${(stats.revenue  / 1000).toFixed(0)}K`,color: "#f472b6", icon: "💰" },
    { label: "Expenses",    value: `₹${(stats.expenses / 1000).toFixed(0)}K`,color: "#ff4d6d", icon: "💳" },
  ], [stats, conv]);

  return (
    <div className="kpi-strip">
      {kpis.map((k, i) => (
        <div key={i} className={`kpi-card ${k.alert ? "kpi-alert" : ""}`}
          style={{ "--kpi-color": k.color, animationDelay: `${i * 0.07}s` }}>
          <div className="kpi-icon">{k.icon}</div>
          <div className="kpi-val" style={{ color: k.color }}>{k.value}</div>
          <div className="kpi-label">{k.label}</div>
          {k.alert && <div className="kpi-warn-bar" />}
        </div>
      ))}
    </div>
  );
}

// Rep Card
function RepCard({ rep, isSelected, expenses, assignedTasks, onSelect, onNotify, onAssign, onExpense, onMeeting, onRoute }) {
  const sm  = STATUS_META[rep.status] || STATUS_META.idle;
  const over = isOverdue(rep);
  const repExpenses = useMemo(
    () => expenses.filter((e) => e.repId === rep._id).reduce((s, e) => s + e.amount, 0),
    [expenses, rep._id]
  );

  return (
    <div
      className={`rep-card ${isSelected ? "active" : ""} ${over ? "rep-overdue" : ""}`}
      style={{ "--rep-color": sm.color }}
    >
      <div className="rep-stripe" style={{ background: sm.color }} />
      <div className="rep-top" onClick={() => onSelect(rep)}>
        <div className="rep-avatar" style={{ boxShadow: `0 0 0 2px ${sm.color}` }}>
          {rep.initials}
          {over        && <span className="avatar-alert">!</span>}
          {rep.battery < 20 && <span className="battery-alert">🔋</span>}
        </div>
        <div className="rep-meta">
          <div className="rep-name">{rep.name}</div>
          <div className="rep-zone">{rep.territory}</div>
        </div>
        <span className="status-pill-sm" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
      </div>

      {rep.currentClient && <div className="rep-client"><span>🏢</span>{rep.currentClient}</div>}

      <div className="rep-stats">
        <div className="rs-item"><span className="rs-val">{rep.visits}</span><span className="rs-lbl">Visits</span></div>
        <div className="rs-div" />
        <div className="rs-item"><span className="rs-val">{rep.orders}</span><span className="rs-lbl">Orders</span></div>
        <div className="rs-div" />
        <div className="rs-item"><span className="rs-val" style={{ color: sm.color }}>{rep.efficiency}%</span><span className="rs-lbl">Score</span></div>
        <div className="rs-div" />
        <div className="rs-item">
          <span className={`rs-val ${over ? "idle-over" : ""}`}>{getIdleLabel(rep)}</span>
          <span className="rs-lbl">Idle</span>
        </div>
      </div>

      <div className="rep-info-row">
        <span className={`battery-indicator ${rep.battery < 20 ? "low" : rep.battery < 50 ? "medium" : "high"}`}>
          🔋 {rep.battery}%
        </span>
        <span className="last-checkin">📍 {rep.lastCheckIn}</span>
      </div>

      {repExpenses > 0 && (
        <div className="rep-expense-row"><span>💳 Expenses: ₹{repExpenses.toLocaleString()}</span></div>
      )}

      <div className="rep-progress-track">
        <div className="rep-progress-fill" style={{ width: `${Math.min((rep.visits / (rep.target || 6)) * 100, 100)}%`, background: sm.color }} />
        <span className="rep-progress-label">{rep.visits}/{rep.target || 6} target</span>
      </div>

      <div className="rep-actions">
        <button className="ra-btn notify-btn"  onClick={(e) => { e.stopPropagation(); onNotify(rep);  }}>🔔</button>
        <button className="ra-btn assign-btn"  onClick={(e) => { e.stopPropagation(); onAssign(rep);  }}>📋</button>
        <button className="ra-btn expense-btn" onClick={(e) => { e.stopPropagation(); onExpense(rep); }}>💳</button>
        <button className="ra-btn meeting-btn" onClick={(e) => { e.stopPropagation(); onMeeting(rep); }}>📅</button>
        <button className="ra-btn route-btn"   onClick={(e) => { e.stopPropagation(); onRoute(rep);   }}>🗺️</button>
      </div>
    </div>
  );
}

// Reps Panel
function RepsPanel({ reps, selectedRep, filter, setFilter, searchQuery, setSearchQuery, expenses, assignedTasks, onSelectRep, onRefresh, onNotify, onAssign, onExpense, onMeeting, onRoute }) {
  const filteredReps = useMemo(() => reps.filter((r) => {
    const ms = filter === "all" || r.status === filter;
    const mq = r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               r.territory?.toLowerCase().includes(searchQuery.toLowerCase());
    return ms && mq;
  }), [reps, filter, searchQuery]);

  return (
    <div className="panel panel-reps">
      <div className="panel-head">
        <h2 className="panel-title">FIELD FORCE</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div className="panel-count">{filteredReps.length} reps</div>
          <button onClick={onRefresh} style={{ background: "rgba(0,217,255,.1)", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--cyan)", fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input className="search-input" placeholder="Search name or zone..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>✕</button>}
      </div>
      <div className="filter-row">
        {["all", "visiting", "traveling", "idle"].map((f) => (
          <button key={f}
            className={`filter-pill ${filter === f ? "active" : ""}`}
            style={filter === f ? { "--pill-color": f === "all" ? "#00d9ff" : STATUS_META[f]?.color } : {}}
            onClick={() => setFilter(f)}>
            {f === "all" ? "All" : STATUS_META[f]?.label}
          </button>
        ))}
      </div>
      <div className="reps-list">
        {filteredReps.length === 0 && <div className="empty-state">No reps match</div>}
        {filteredReps.map((rep) => (
          <RepCard
            key={rep._id || rep.id}
            rep={rep}
            isSelected={selectedRep?._id === rep._id}
            expenses={expenses}
            assignedTasks={assignedTasks}
            onSelect={onSelectRep}
            onNotify={onNotify}
            onAssign={onAssign}
            onExpense={onExpense}
            onMeeting={onMeeting}
            onRoute={onRoute}
          />
        ))}
      </div>
    </div>
  );
}

// Map Overlay
function MapOverlay({ rep, onClose, onNotify, onAssign, onExpense, onMeeting, onRoute }) {
  const sm = STATUS_META[rep.status] || STATUS_META.idle;
  return (
    <div className="map-overlay fade-in">
      <div className="overlay-header">
        <div className="overlay-avatar" style={{ borderColor: sm.color }}>{rep.initials}</div>
        <div>
          <div className="overlay-name">{rep.name}</div>
          <div className="overlay-zone">{rep.territory}</div>
        </div>
        <button className="overlay-close" onClick={onClose}>✕</button>
      </div>
      <div className="overlay-body">
        {[
          ["Status",     sm.label],
          ["Client",     rep.currentClient || "—"],
          ["Visits",     `${rep.visits}/${rep.target}`],
          ["Orders",     rep.orders],
          ["Revenue",    `₹${rep.revenue?.toLocaleString()}`],
          ["Efficiency", `${rep.efficiency}%`],
          ["Battery",    `${rep.battery}%`],
          ["Check-in",   rep.lastCheckIn],
        ].map(([l, v]) => (
          <div key={l} className="overlay-row">
            <span className="overlay-label">{l}</span>
            <span className="overlay-val">{v}</span>
          </div>
        ))}
      </div>
      <div className="overlay-actions">
        <button className="oa-btn" onClick={() => onNotify(rep)}>🔔</button>
        <button className="oa-btn" onClick={() => onAssign(rep)}>📋</button>
        <button className="oa-btn" onClick={() => onExpense(rep)}>💳</button>
        <button className="oa-btn" onClick={() => onMeeting(rep)}>📅</button>
        <button className="oa-btn" onClick={() => onRoute(rep)}>🗺️</button>
      </div>
      <div className="overlay-eff-bar">
        <div style={{ width: `${rep.efficiency}%`, background: sm.color }} />
      </div>
    </div>
  );
}

// Map Panel
function MapPanel({ reps, selectedRep, showDetail, onSelectRep, onCloseDetail, onNotify, onAssign, onExpense, onMeeting, onRoute }) {
  return (
    <div className="panel panel-map">
      <div className="panel-head map-head">
        <h2 className="panel-title">LIVE TRACKING MAP</h2>
        <div className="map-legend">
          {Object.entries(STATUS_META).map(([k, v]) => (
            <div key={k} className="leg-item">
              <span className="leg-dot" style={{ background: v.color, boxShadow: `0 0 6px ${v.color}` }} />
              {v.label}
            </div>
          ))}
        </div>
      </div>
      <div className="map-canvas">
        <div className="map-grid-lines" />
        <div className="map-center-glow" />
        {["N", "S", "E", "W"].map((z, i) => (
          <div key={z} className="zone-label" style={{
            left: i === 0 ? "48%" : i === 1 ? "48%" : i === 2 ? "82%" : "5%",
            top:  i === 0 ? "5%"  : i === 1 ? "88%" : i === 2 ? "48%" : "48%",
          }}>{z}</div>
        ))}
        {reps.map((rep, i) => {
          const sm   = STATUS_META[rep.status] || STATUS_META.idle;
          const pos  = MAP_POS[i % MAP_POS.length];
          const over = isOverdue(rep);
          return (
            <div key={rep._id || rep.id}
              className={`map-pin ${selectedRep?._id === rep._id ? "pin-selected" : ""} ${over ? "pin-overdue" : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, "--pin-color": sm.color }}
              onClick={() => onSelectRep(rep)}>
              <div className="pin-pulse" style={{ background: sm.color }} />
              <div className="pin-ring"  style={{ borderColor: sm.color }} />
              <div className="pin-dot"   style={{ background: sm.color }}>
                <span className="pin-init">{rep.initials}</span>
              </div>
              {over          && <div className="pin-alert-badge">!</div>}
              {rep.battery < 20 && <div className="pin-battery-badge">🔋</div>}
              <div className="pin-tooltip">
                <strong>{rep.name}</strong>
                <span>{sm.label} · {rep.territory}</span>
                {rep.status === "idle"   && <span className="tt-idle">Idle: {getIdleLabel(rep)}</span>}
                {rep.currentClient       && <span>📍 {rep.currentClient}</span>}
                <span>🔋 Battery: {rep.battery}%</span>
              </div>
            </div>
          );
        })}
        {selectedRep && showDetail && (
          <MapOverlay
            rep={selectedRep}
            onClose={onCloseDetail}
            onNotify={onNotify}
            onAssign={onAssign}
            onExpense={onExpense}
            onMeeting={onMeeting}
            onRoute={onRoute}
          />
        )}
      </div>
    </div>
  );
}

// ── Right Panel Tabs ──────────────────────────────────────────────────────────

function IdleTab({ idleReps, overdueReps, assignedTasks, sentNotifs, onNotify, onAssign, onExpense, onMeeting, onMarkDone }) {
  if (idleReps.length === 0) {
    return <div className="idle-empty"><div className="ie-icon">✓</div><div className="ie-text">All reps are active!</div></div>;
  }
  return (
    <div className="idle-tab">
      <div className="idle-summary">
        <span className="is-count">{idleReps.length}</span>
        <span className="is-text">reps currently idle</span>
        {overdueReps.length > 0 && <span className="is-warn">{overdueReps.length} overdue ⚠</span>}
      </div>
      <div className="idle-cards">
        {idleReps.map((rep, i) => {
          const over      = isOverdue(rep);
          const repTasks  = assignedTasks.filter((t) => t.repId === rep._id && t.status === "pending");
          const repNotifs = sentNotifs.filter((n) => n.repId === rep._id);
          return (
            <div key={rep._id} className={`idle-card ${over ? "idle-card-warn" : ""}`} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="ic-header">
                <div className="ic-avatar" style={{ borderColor: over ? "#ff4d6d" : "#ffba08" }}>{rep.initials}</div>
                <div className="ic-info">
                  <div className="ic-name">{rep.name}</div>
                  <div className="ic-zone">{rep.territory}</div>
                </div>
                <div className="ic-idle-time" style={{ color: over ? "#ff4d6d" : "#ffba08" }}>
                  <span className="icit-val">{getIdleLabel(rep)}</span>
                  <span className="icit-lbl">idle</span>
                </div>
              </div>
              {over && <div className="ic-warning">⚠ Idle threshold exceeded — action required</div>}
              <div className="ic-meta">
                <span>Score: <b>{rep.efficiency}%</b></span>
                <span>Visits: <b>{rep.visits}/{rep.target}</b></span>
                <span>Battery: <b className={rep.battery < 20 ? "low-battery" : ""}>{rep.battery}%</b></span>
              </div>
              {repTasks.length > 0 && (
                <div className="ic-assigned-tasks">
                  {repTasks.map((t) => (
                    <div key={t._id} className="ic-task-chip">
                      <span>{t.task?.icon} {t.task?.label}</span>
                      <span className="ict-due">due {t.deadline}</span>
                      <button className="ict-done" onClick={() => onMarkDone(t._id || t.id)}>✓</button>
                    </div>
                  ))}
                </div>
              )}
              {repNotifs.length > 0 && (
                <div className="ic-notif-log"><span className="inl-label">Last notified {repNotifs[0].time || "recently"}</span></div>
              )}
              <div className="ic-actions">
                <button className="ica-btn ica-notify"  onClick={() => onNotify(rep)}>🔔</button>
                <button className="ica-btn ica-assign"  onClick={() => onAssign(rep)}>📋</button>
                <button className="ica-btn ica-expense" onClick={() => onExpense(rep)}>💳</button>
                <button className="ica-btn ica-meeting" onClick={() => onMeeting(rep)}>📅</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedTab({ activities }) {
  return (
    <div className="feed-list">
      <div className="feed-live-bar"><span className="live-pulse" />LIVE ACTIVITY STREAM</div>
      {activities.map((a, i) => (
        <div key={a._id || a.id} className={`feed-item feed-${a.type}`} style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="feed-icon-wrap"><span className="feed-icon">{a.icon}</span></div>
          <div className="feed-body">
            <div className="feed-top">
              <span className="feed-rep">{a.rep}</span>
              <span className="feed-time">{a.time || new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="feed-action">{a.action}</div>
            <div className="feed-bottom">
              <span className="feed-client">{a.client}</span>
              {a.value !== "—" && <span className="feed-val">{a.value}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ assignedTasks, onMarkDone }) {
  if (assignedTasks.length === 0) {
    return <div className="idle-empty"><div className="ie-icon">📋</div><div className="ie-text">No tasks assigned yet.</div></div>;
  }
  return (
    <div className="tasks-tab">
      <div className="task-list">
        <div className="tl-header">
          <span>{assignedTasks.filter((t) => t.status === "pending").length} pending</span>
          <span>{assignedTasks.filter((t) => t.status === "done").length} done</span>
        </div>
        {assignedTasks.map((t, i) => (
          <div key={t._id || t.id} className={`task-card ${t.status === "done" ? "task-done" : ""}`} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="tc-top">
              <span className="tc-icon">{t.task?.icon}</span>
              <div className="tc-info">
                <div className="tc-name">{t.task?.label}</div>
                <div className="tc-rep">{t.repName} · due {t.deadline}</div>
              </div>
              <span className={`tc-priority ${t.task?.priority}`}>{t.task?.priority}</span>
            </div>
            <div className="tc-desc">{t.task?.desc}</div>
            {t.note && <div className="tc-note">💬 {t.note}</div>}
            <div className="tc-footer">
              <span className="tc-time">{t.createdAt ? new Date(t.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
              {t.status === "pending"
                ? <button className="tc-done-btn" onClick={() => onMarkDone(t._id || t.id)}>Mark Done ✓</button>
                : <span className="tc-done-label">✓ Completed</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesTab({ expenses }) {
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  if (expenses.length === 0) {
    return <div className="idle-empty"><div className="ie-icon">💳</div><div className="ie-text">No expenses logged yet</div></div>;
  }
  return (
    <div className="expenses-tab">
      <div className="expense-summary">
        <div className="es-total">
          <span className="es-amount">₹{total.toLocaleString()}</span>
          <span className="es-label">Total Expenses</span>
        </div>
      </div>
      <div className="expense-list">
        {expenses.map((exp, i) => (
          <div key={exp._id || exp.id} className="expense-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="exp-header">
              <span className="exp-icon" style={{ color: exp.category?.color }}>{exp.category?.icon}</span>
              <div className="exp-info">
                <div className="exp-rep">{exp.repName}</div>
                <div className="exp-category">{exp.category?.label}</div>
              </div>
              <div className="exp-amount">₹{exp.amount?.toLocaleString()}</div>
            </div>
            {exp.note && <div className="exp-note">{exp.note}</div>}
            <div className="exp-footer">
              <span className="exp-date">{exp.createdAt ? new Date(exp.createdAt).toLocaleDateString() : ""}</span>
              <span className="exp-time">{exp.createdAt ? new Date(exp.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingsTab({ meetings }) {
  if (meetings.length === 0) {
    return <div className="idle-empty"><div className="ie-icon">📅</div><div className="ie-text">No meetings scheduled</div></div>;
  }
  return (
    <div className="meetings-tab">
      <div className="meeting-list">
        {meetings.map((mtg, i) => (
          <div key={mtg._id || mtg.id} className="meeting-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="mtg-header">
              <span className="mtg-icon">{mtg.type?.icon}</span>
              <div className="mtg-info">
                <div className="mtg-type">{mtg.type?.label}</div>
                <div className="mtg-rep">{mtg.repName} → {mtg.client}</div>
              </div>
              <span className={`mtg-status ${mtg.status}`}>{mtg.status}</span>
            </div>
            {mtg.notes && <div className="mtg-notes">📝 {mtg.notes}</div>}
            <div className="mtg-footer">
              <span className="mtg-date">{mtg.createdAt ? new Date(mtg.createdAt).toLocaleDateString() : ""}</span>
              <span className="mtg-time">🕐 {mtg.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTab({ hourly, stats, conv }) {
  return (
    <div className="chart-panel">
      <div className="chart-legend">
        <span className="cl-visits">Visits</span>
        <span className="cl-orders">Orders</span>
      </div>
      <div className="chart-area">
        {hourly.map((h, i) => (
          <div key={h.hour} className="chart-col" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="bar-group">
              <div className="bar-wrap">
                <div className="bar bar-v" style={{ height: `${(h.visits / 9) * 100}%` }}><span className="bar-tip">{h.visits}</span></div>
                <div className="bar bar-o" style={{ height: `${(h.orders / 9) * 100}%` }}><span className="bar-tip">{h.orders}</span></div>
              </div>
            </div>
            <div className="bar-label">{h.hour}</div>
          </div>
        ))}
      </div>
      <div className="chart-summary">
        <div className="cs-item"><span>{stats.visits}</span><small>Total Visits</small></div>
        <div className="cs-div" />
        <div className="cs-item"><span>{stats.orders}</span><small>Orders</small></div>
        <div className="cs-div" />
        <div className="cs-item"><span>{conv}%</span><small>Conv. Rate</small></div>
      </div>
    </div>
  );
}

// Right Panel wrapper
function RightPanel({ activeTab, setActiveTab, idleReps, overdueReps, activities, assignedTasks, expenses, meetings, hourly, stats, conv, sentNotifs, onMarkDone, onNotify, onAssign, onExpense, onMeeting }) {
  const tabs = useMemo(() => [
    { id: "idle",     label: `⏸ Idle (${idleReps.length})`      },
    { id: "feed",     label: "📡 Feed"                           },
    { id: "tasks",    label: `📋 Tasks (${assignedTasks.length})` },
    { id: "expenses", label: `💳 Expenses (${expenses.length})`  },
    { id: "meetings", label: `📅 Meetings (${meetings.length})`  },
    { id: "chart",    label: "📊 Chart"                          },
  ], [idleReps.length, assignedTasks.length, expenses.length, meetings.length]);

  return (
    <div className="panel panel-right">
      <div className="right-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`right-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {activeTab === "idle"     && <IdleTab     idleReps={idleReps} overdueReps={overdueReps} assignedTasks={assignedTasks} sentNotifs={sentNotifs} onNotify={onNotify} onAssign={onAssign} onExpense={onExpense} onMeeting={onMeeting} onMarkDone={onMarkDone} />}
      {activeTab === "feed"     && <FeedTab     activities={activities} />}
      {activeTab === "tasks"    && <TasksTab    assignedTasks={assignedTasks} onMarkDone={onMarkDone} />}
      {activeTab === "expenses" && <ExpensesTab expenses={expenses} />}
      {activeTab === "meetings" && <MeetingsTab meetings={meetings} />}
      {activeTab === "chart"    && <ChartTab    hourly={hourly} stats={stats} conv={conv} />}
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function NotifyModal({ rep, sentNotifs, onClose, onSend }) {
  const [notifyMsg, setNotifyMsg] = useState(NOTIFY_TEMPLATES[0]);
  const [customMsg, setCustomMsg] = useState("");
  const [loading,   setLoading]   = useState(false);

  const handleSend = async () => {
    setLoading(true);
    await onSend(rep, customMsg.trim() || notifyMsg);
    setLoading(false);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal notify-modal">
        <div className="modal-header">
          <div className="modal-icon notify-icon">🔔</div>
          <div>
            <h3 className="modal-title">Send Notification</h3>
            <p className="modal-sub">To: <strong>{rep.name}</strong> · {rep.territory}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-rep-status">
            <span className="mrs-label">Current Status</span>
            <span className="mrs-idle">● Idle for {getIdleLabel(rep)}</span>
            {isOverdue(rep) && <span className="mrs-warn">⚠ Overdue</span>}
          </div>
          <div className="modal-section">
            <label className="modal-label">Quick Templates</label>
            <div className="template-list">
              {NOTIFY_TEMPLATES.map((t, i) => (
                <button key={i} className={`template-chip ${notifyMsg === t && !customMsg ? "active" : ""}`}
                  onClick={() => { setNotifyMsg(t); setCustomMsg(""); }}>{t}</button>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <label className="modal-label">Or write a custom message</label>
            <textarea className="modal-textarea" placeholder="Type your notification..." value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)} rows={3} />
          </div>
          <div className="modal-preview">
            <span className="mp-label">Preview:</span>
            <span className="mp-text">{customMsg || notifyMsg}</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn send" onClick={handleSend} disabled={loading}>{loading ? "Sending..." : "🔔 Send Now"}</button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function AssignModal({ rep, onClose, onAssign }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDeadline, setTaskDeadline] = useState("17:00");
  const [taskNote,     setTaskNote]     = useState("");
  const [loading,      setLoading]      = useState(false);

  const handleAssign = async () => {
    if (!selectedTask) return;
    setLoading(true);
    await onAssign(rep, selectedTask, taskDeadline, taskNote);
    setLoading(false);
  };

  const task = TASK_TEMPLATES.find((t) => t.id === selectedTask);

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal assign-modal">
        <div className="modal-header">
          <div className="modal-icon assign-icon">📋</div>
          <div>
            <h3 className="modal-title">Assign Work</h3>
            <p className="modal-sub">To: <strong>{rep.name}</strong> · {rep.territory}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-rep-status">
            <span className="mrs-label">Idle for {getIdleLabel(rep)}</span>
            <span className="mrs-score">Score: {rep.efficiency}%</span>
            <span className="mrs-visits">{rep.visits}/{rep.target} visits done</span>
          </div>
          <div className="modal-section">
            <label className="modal-label">Select Task</label>
            <div className="task-grid">
              {TASK_TEMPLATES.map((t) => (
                <button key={t.id} className={`task-tile ${selectedTask === t.id ? "active" : ""} priority-${t.priority}`}
                  onClick={() => setSelectedTask(t.id)}>
                  <span className="tt-icon">{t.icon}</span>
                  <span className="tt-name">{t.label}</span>
                  <span className={`tt-badge ${t.priority}`}>{t.priority}</span>
                </button>
              ))}
            </div>
          </div>
          {task && (
            <div className="task-desc-box">
              <span className="tdb-icon">{task.icon}</span>
              <span>{task.desc}</span>
            </div>
          )}
          <div className="modal-row">
            <div className="modal-section half">
              <label className="modal-label">Deadline</label>
              <input type="time" className="modal-input" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
            </div>
            <div className="modal-section half">
              <label className="modal-label">Priority</label>
              <div className="priority-display">
                {task
                  ? <span className={`prio-badge ${task.priority}`}>{task.priority}</span>
                  : <span style={{ color: "var(--text2)" }}>Select a task</span>
                }
              </div>
            </div>
          </div>
          <div className="modal-section">
            <label className="modal-label">Additional Notes</label>
            <textarea className="modal-textarea" rows={2} placeholder="Any specific instructions..."
              value={taskNote} onChange={(e) => setTaskNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className={`modal-btn assign ${selectedTask ? "" : "disabled"}`}
            onClick={handleAssign} disabled={!selectedTask || loading}>
            {loading ? "Assigning..." : "📋 Assign Task"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function ExpenseModal({ rep, onClose, onSubmit }) {
  const [amount,   setAmount]   = useState("");
  const [category, setCategory] = useState("travel");
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!parsed || isNaN(parsed)) return;
    setLoading(true);
    await onSubmit(rep, parsed, category, note);
    setLoading(false);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal expense-modal">
        <div className="modal-header">
          <div className="modal-icon expense-icon">💳</div>
          <div>
            <h3 className="modal-title">Log Expense</h3>
            <p className="modal-sub">For: <strong>{rep.name}</strong></p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <label className="modal-label">Amount (₹)</label>
            <input type="number" className="modal-input" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="modal-section">
            <label className="modal-label">Category</label>
            <div className="category-grid">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button key={cat.id} className={`category-tile ${category === cat.id ? "active" : ""}`}
                  style={{ "--cat-color": cat.color }} onClick={() => setCategory(cat.id)}>
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <label className="modal-label">Note (optional)</label>
            <textarea className="modal-textarea" rows={2} placeholder="Additional details..." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className={`modal-btn submit ${amount ? "" : "disabled"}`}
            onClick={handleSubmit} disabled={!amount || loading}>
            {loading ? "Logging..." : "💳 Log Expense"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function MeetingModal({ rep, onClose, onSubmit }) {
  const [meetingType,   setMeetingType]   = useState("demo");
  const [meetingClient, setMeetingClient] = useState("");
  const [meetingTime,   setMeetingTime]   = useState("");
  const [meetingNotes,  setMeetingNotes]  = useState("");
  const [loading,       setLoading]       = useState(false);

  const handleSubmit = async () => {
    if (!meetingClient || !meetingTime) return;
    setLoading(true);
    await onSubmit(rep, meetingType, meetingClient, meetingTime, meetingNotes);
    setLoading(false);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal meeting-modal">
        <div className="modal-header">
          <div className="modal-icon meeting-icon">📅</div>
          <div>
            <h3 className="modal-title">Schedule Meeting</h3>
            <p className="modal-sub">For: <strong>{rep.name}</strong></p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <label className="modal-label">Meeting Type</label>
            <div className="meeting-type-grid">
              {MEETING_TYPES.map((type) => (
                <button key={type.id} className={`meeting-type-tile ${meetingType === type.id ? "active" : ""}`}
                  onClick={() => setMeetingType(type.id)}>
                  <span>{type.icon}</span><span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <label className="modal-label">Client Name</label>
            <input className="modal-input" placeholder="Client or prospect name" value={meetingClient} onChange={(e) => setMeetingClient(e.target.value)} />
          </div>
          <div className="modal-section">
            <label className="modal-label">Time</label>
            <input type="time" className="modal-input" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
          </div>
          <div className="modal-section">
            <label className="modal-label">Notes (optional)</label>
            <textarea className="modal-textarea" rows={2} placeholder="Meeting agenda..." value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className={`modal-btn submit ${meetingClient && meetingTime ? "" : "disabled"}`}
            onClick={handleSubmit} disabled={!meetingClient || !meetingTime || loading}>
            {loading ? "Scheduling..." : "📅 Schedule"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function LeaderboardModal({ reps, onClose }) {
  const sorted = useMemo(() => [...reps].sort((a, b) => b.revenue - a.revenue), [reps]);
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal leaderboard-modal">
        <div className="modal-header">
          <div className="modal-icon lb-icon">🏆</div>
          <div><h3 className="modal-title">Performance Leaderboard</h3><p className="modal-sub">Top performers today</p></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="leaderboard-list">
            {sorted.map((rep, i) => (
              <div key={rep._id} className={`lb-item rank-${i + 1}`}>
                <div className="lb-rank">#{i + 1}</div>
                <div className="lb-avatar" style={{ borderColor: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] : "#5a7a99" }}>{rep.initials}</div>
                <div className="lb-info">
                  <div className="lb-name">{rep.name}</div>
                  <div className="lb-stats">{rep.orders} orders · {rep.efficiency}% efficiency</div>
                </div>
                <div className="lb-revenue">₹{(rep.revenue / 1000).toFixed(0)}K</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function ReportsModal({ reportData, onClose, onDownload }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal reports-modal">
        <div className="modal-header">
          <div className="modal-icon reports-icon">📊</div>
          <div><h3 className="modal-title">Daily Reports</h3><p className="modal-sub">{new Date().toLocaleDateString()}</p></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {reportData ? (
            <>
              <div className="report-grid">
                <div className="report-card"><div className="rc-icon">💰</div><div className="rc-value">₹{(reportData.summary?.totalRevenue / 1000).toFixed(0)}K</div><div className="rc-label">Total Revenue</div></div>
                <div className="report-card"><div className="rc-icon">💳</div><div className="rc-value">₹{(reportData.summary?.totalExpenses / 1000).toFixed(0)}K</div><div className="rc-label">Total Expenses</div></div>
                <div className="report-card"><div className="rc-icon">📈</div><div className="rc-value">₹{(reportData.summary?.netRevenue / 1000).toFixed(0)}K</div><div className="rc-label">Net Revenue</div></div>
                <div className="report-card"><div className="rc-icon">📊</div><div className="rc-value">{reportData.summary?.conversionRate}%</div><div className="rc-label">Conversion</div></div>
              </div>
              <button className="download-report-btn" onClick={onDownload}>📥 Download Full Report</button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text2)" }}>Loading report data...</div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );
}

function BroadcastModal({ reps, onClose, onBroadcast }) {
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [targetReps,   setTargetReps]   = useState([]);
  const [loading,      setLoading]      = useState(false);

  const toggleRep = (id) => setTargetReps((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleBroadcast = async () => {
    if (!broadcastMsg || !targetReps.length) return;
    setLoading(true);
    await onBroadcast(targetReps, broadcastMsg);
    setLoading(false);
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal broadcast-modal">
        <div className="modal-header">
          <div className="modal-icon broadcast-icon">📢</div>
          <div><h3 className="modal-title">Broadcast Message</h3><p className="modal-sub">Send to multiple reps</p></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <label className="modal-label">Select Recipients</label>
            <div className="rep-checklist">
              {reps.map((rep) => (
                <label key={rep._id} className="rep-checkbox">
                  <input type="checkbox" checked={targetReps.includes(rep._id)} onChange={() => toggleRep(rep._id)} />
                  <span>{rep.name}</span>
                  <span className="rep-zone-tag">{rep.territory}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="modal-section">
            <label className="modal-label">Message</label>
            <textarea className="modal-textarea" rows={4} placeholder="Type your broadcast message..."
              value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className={`modal-btn broadcast ${broadcastMsg && targetReps.length > 0 ? "" : "disabled"}`}
            onClick={handleBroadcast} disabled={!broadcastMsg || !targetReps.length || loading}>
            {loading ? "Sending..." : `📢 Broadcast (${targetReps.length})`}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function RouteModal({ rep, onClose, onSend }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="modal route-modal">
        <div className="modal-header">
          <div className="modal-icon route-icon">🗺️</div>
          <div><h3 className="modal-title">Route Optimization</h3><p className="modal-sub">For: <strong>{rep.name}</strong></p></div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="route-info">
            <div className="ri-item"><span className="ri-icon">📍</span><div><div className="ri-label">Current Location</div><div className="ri-value">{rep.territory}</div></div></div>
            <div className="ri-item"><span className="ri-icon">🎯</span><div><div className="ri-label">Suggested Next Visits</div><div className="ri-value">3 clients within 5km radius</div></div></div>
            <div className="ri-item"><span className="ri-icon">⏱️</span><div><div className="ri-label">Estimated Time</div><div className="ri-value">2.5 hours</div></div></div>
          </div>
          <div className="route-suggestions">
            {["TechCorp Industries", "Global Retail Ltd", "Metro Enterprises"].map((client, i) => (
              <div key={i} className="route-suggest">
                <span className="rs-num">{i + 1}</span>
                <div className="rs-info">
                  <div className="rs-name">{client}</div>
                  <div className="rs-dist">{(1.2 + i * 0.8).toFixed(1)}km away · {15 + i * 10} min</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Close</button>
          <button className="modal-btn submit" onClick={() => onSend(rep)}>🗺️ Send Route</button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("manager@fieldcommand.com");
  const [password, setPassword] = useState("manager123");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email: email.trim(), password });
      if (!data.token || !data.user) {
        setError("Unexpected response from server. Please try again.");
        setLoading(false);
        return;
      }
      // Normalise: backend returns user.id (not user._id) from auth route
      const user = { ...data.user, _id: data.user._id || data.user.id };
      localStorage.setItem("fc_token", data.token);
      localStorage.setItem("fc_user",  JSON.stringify(user));
      onLogin(user, data.token);
    } catch (err) {
      console.error("Login error:", err);
      if (!err.response) {
        setError("Cannot reach server at localhost:5000. Is your backend running?");
      } else {
        setError(err.response?.data?.message || ("Error " + err.response.status + ": Login failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-hex">⬡</span>
          <h1 className="logo-title">FIELD<span>COMMAND</span></h1>
        </div>
        <p className="login-sub">Sales Intelligence · Real-Time</p>
        {error && <div className="login-error">⚠ {error}</div>}
        <div className="login-field">
          <label>Email</label>
          <input className="modal-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="login-field">
          <label>Password</label>
          <input className="modal-input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
        </div>
        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>
        <div className="login-hint">
          <small>Manager: manager@fieldcommand.com / manager123</small>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [user,  setUser]  = useState(() => { try { return JSON.parse(localStorage.getItem("fc_user")); } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem("fc_token") || null);

  // Data
  const [reps,          setReps]          = useState([]);
  const [activities,    setActivities]    = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [meetings,      setMeetings]      = useState([]);
  const [hourly,        setHourly]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [reportData,    setReportData]    = useState(null);

  // UI
  const [selectedRep,    setSelectedRep]    = useState(null);
  const [filter,         setFilter]         = useState("all");
  const [activeTab,      setActiveTab]      = useState("idle");
  const [now,            setNow]            = useState(new Date());
  const [searchQuery,    setSearchQuery]    = useState("");
  const [showDetail,     setShowDetail]     = useState(false);
  const [notifications,  setNotifications]  = useState(0);
  const [sentNotifs,     setSentNotifs]     = useState([]);
  const [geofenceAlerts, setGeofenceAlerts] = useState([]);

  const { toasts, showToast } = useToasts();
  const { modals, openModal, closeModal } = useModals();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const handleLogin = useCallback((u, t) => {
    setUser(u);
    setToken(t);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_user");
    setUser(null);
    setToken(null);
  }, []);

  // ── 401 interceptor (attach once) ─────────────────────────────────────────
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        // Only auto-logout on 401 for authenticated routes, not the login route itself
        const isLoginRoute = err.config?.url?.includes("/auth/login");
        if (err.response?.status === 401 && !isLoginRoute) handleLogout();
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [handleLogout]);

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const [repsRes, actsRes, tasksRes, expRes, mtgRes, hourlyRes] = await Promise.all([
        api.get("/reps"),
        api.get("/activities?limit=20"),
        api.get("/tasks"),
        api.get("/expenses"),
        api.get("/meetings"),
        api.get("/reports/hourly"),
      ]);
      setReps(repsRes.data.data.map(normalise));
      setActivities(actsRes.data.data.map(normalise));
      setAssignedTasks(tasksRes.data.data.map(normalise));
      setExpenses(expRes.data.data.map(normalise));
      setMeetings(mtgRes.data.data.map(normalise));
      setHourly(hourlyRes.data.data);
    } catch (err) {
      console.error("Fetch error:", err.message);
      showToast("Failed to load data from server", "warn");
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  // ── Socket callbacks (stable refs via useCallback) ─────────────────────────
  const onRepStatus    = useCallback(({ repId, status, currentClient }) => {
    setReps((prev) => prev.map((r) =>
      r._id === repId ? { ...r, status, currentClient, idleMinutes: status !== "idle" ? 0 : r.idleMinutes } : r
    ));
  }, []);

  const onRepLocation  = useCallback(({ repId, lat, lng, battery }) => {
    setReps((prev) => prev.map((r) => r._id === repId ? { ...r, location: { lat, lng }, battery } : r));
  }, []);

  const onRepOrder     = useCallback(({ repId, orders, revenue }) => {
    setReps((prev) => prev.map((r) => r._id === repId ? { ...r, orders, revenue } : r));
  }, []);

  const onActivity     = useCallback((act) => {
    setActivities((prev) => [{ ...act, id: act._id }, ...prev.slice(0, 19)]);
    setNotifications((n) => n + 1);
  }, []);

  const onTaskAssigned = useCallback((task) => {
    setAssignedTasks((prev) => [{ ...task, id: task._id }, ...prev]);
  }, []);

  const onTaskDone     = useCallback(({ taskId }) => {
    setAssignedTasks((prev) => prev.map((t) => t._id === taskId || t.id === taskId ? { ...t, status: "done" } : t));
  }, []);

  const onExpense      = useCallback((exp) => {
    setExpenses((prev) => [{ ...exp, id: exp._id }, ...prev]);
  }, []);

  const onMeeting      = useCallback((mtg) => {
    setMeetings((prev) => [{ ...mtg, id: mtg._id }, ...prev]);
  }, []);

  const onNotification = useCallback((notif) => {
    setNotifications((n) => n + 1);
    setSentNotifs((prev) => [notif, ...prev]);
  }, []);

  useSocket({ token, onRepStatus, onRepLocation, onRepOrder, onActivity, onTaskAssigned, onTaskDone, onExpense, onMeeting, onNotification });

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => { if (token) fetchAll(); }, [token, fetchAll]);

  // ── Clock + idle ticker ────────────────────────────────────────────────────
  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    const idleTimer  = setInterval(() => {
      setReps((prev) => prev.map((r) =>
        r.status === "idle" ? { ...r, idleMinutes: (r.idleMinutes || 0) + (1 / 60) } : r
      ));
    }, 1000);
    return () => { clearInterval(clockTimer); clearInterval(idleTimer); };
  }, []);

  // ── Battery alert (separate interval, no side-effects inside state updater) ─
  useEffect(() => {
    const batteryTimer = setInterval(() => {
      setReps((prev) => {
        prev.forEach((rep) => {
          if (rep.battery < 20) {
            setGeofenceAlerts((p) => {
              if (p.find((a) => a.repId === rep._id && a.type === "battery")) return p;
              return [{ id: Date.now(), type: "battery", repId: rep._id, repName: rep.name,
                message: `Low battery: ${rep.battery}%`, time: new Date().toLocaleTimeString() }, ...p];
            });
          }
        });
        return prev;
      });
    }, 30_000);
    return () => clearInterval(batteryTimer);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    reps.length,
    active:   reps.filter((r) => r.status === "visiting").length,
    idle:     reps.filter((r) => r.status === "idle").length,
    travel:   reps.filter((r) => r.status === "traveling").length,
    visits:   reps.reduce((s, r) => s + (r.visits  || 0), 0),
    orders:   reps.reduce((s, r) => s + (r.orders  || 0), 0),
    revenue:  reps.reduce((s, r) => s + (r.revenue || 0), 0),
    avgEff:   reps.length ? Math.round(reps.reduce((s, r) => s + (r.efficiency || 0), 0) / reps.length) : 0,
    expenses: expenses.reduce((s, e) => s + (e.amount || 0), 0),
  }), [reps, expenses]);

  const conv        = stats.visits > 0 ? ((stats.orders / stats.visits) * 100).toFixed(0) : "0";
  const idleReps    = useMemo(() => reps.filter((r) => r.status === "idle"),   [reps]);
  const overdueReps = useMemo(() => reps.filter((r) => isOverdue(r)),          [reps]);

  // ── Modal action handlers ──────────────────────────────────────────────────
  const handleNotify = useCallback((rep)          => openModal("notify",  rep), [openModal]);
  const handleAssign = useCallback((rep)          => openModal("assign",  rep), [openModal]);
  const handleExpenseOpen = useCallback((rep)     => openModal("expense", rep), [openModal]);
  const handleMeetingOpen = useCallback((rep)     => openModal("meeting", rep), [openModal]);
  const handleRoute       = useCallback((rep)     => openModal("route",   rep), [openModal]);

  const handleSelectRep = useCallback((rep) => { setSelectedRep(rep); setShowDetail(true); }, []);

  // ── API action handlers ────────────────────────────────────────────────────
  const handleSendNotify = useCallback(async (rep, msg) => {
    try {
      await api.post("/notifications", { repId: rep._id, msg });
      showToast(`Notification sent to ${rep.name}`);
      closeModal("notify");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to send", "warn");
    }
  }, [showToast, closeModal]);

  const handleAssignTask = useCallback(async (rep, taskId, deadline, note) => {
    const task = TASK_TEMPLATES.find((t) => t.id === taskId);
    try {
      await api.post("/tasks", { repId: rep._id, task, deadline, note });
      showToast(`"${task.label}" assigned to ${rep.name}`);
      closeModal("assign");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to assign", "warn");
    }
  }, [showToast, closeModal]);

  const markTaskDone = useCallback(async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/done`);
      setAssignedTasks((p) => p.map((t) => (t._id === taskId || t.id === taskId) ? { ...t, status: "done" } : t));
      showToast("Task marked as completed ✓");
    } catch (err) {
      showToast("Failed to update task", "warn");
    }
  }, [showToast]);

  const handleAddExpense = useCallback(async (rep, amount, categoryId, note) => {
    const category = EXPENSE_CATEGORIES.find((c) => c.id === categoryId);
    try {
      await api.post("/expenses", { repId: rep._id, amount, category, note });
      showToast(`Expense ₹${amount} logged for ${rep.name}`);
      closeModal("expense");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to log expense", "warn");
    }
  }, [showToast, closeModal]);

  const handleScheduleMeeting = useCallback(async (rep, typeId, client, time, notes) => {
    const type = MEETING_TYPES.find((t) => t.id === typeId);
    try {
      await api.post("/meetings", { repId: rep._id, type, client, time, notes });
      showToast(`Meeting scheduled for ${rep.name}`);
      closeModal("meeting");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to schedule", "warn");
    }
  }, [showToast, closeModal]);

  const handleBroadcast = useCallback(async (repIds, msg) => {
    try {
      await api.post("/notifications/broadcast", { repIds, msg });
      showToast(`Broadcast sent to ${repIds.length} reps`);
      closeModal("broadcast");
    } catch (err) {
      showToast(err.response?.data?.message || "Broadcast failed", "warn");
    }
  }, [showToast, closeModal]);

  const handleSendRoute = useCallback((rep) => {
    showToast("Route sent to " + rep.name);
    closeModal("route");
  }, [showToast, closeModal]);

  const fetchReportData = useCallback(async () => {
    try {
      const { data } = await api.get("/reports/daily");
      setReportData(data.data);
    } catch { showToast("Failed to load report", "warn"); }
  }, [showToast]);

  const downloadReport = useCallback(() => {
    if (!reportData) return;
    const s = reportData.summary;
    const txt = `
FIELD COMMAND - DAILY REPORT
${reportData.date}
================================
TEAM PERFORMANCE
----------------
Total Reps: ${s.totalReps}
Active Reps: ${s.activeReps}
Idle Reps: ${s.idleReps}
Total Visits: ${s.totalVisits}
Total Orders: ${s.totalOrders}
Conversion Rate: ${s.conversionRate}%

REVENUE & EXPENSES
------------------
Total Revenue: ₹${s.totalRevenue?.toLocaleString()}
Total Expenses: ₹${s.totalExpenses?.toLocaleString()}
Net Revenue: ₹${s.netRevenue?.toLocaleString()}
Avg Efficiency: ${s.avgEfficiency}%

TOP PERFORMERS
--------------
${reportData.topPerformers?.map((r, i) => `${i + 1}. ${r.name} - ₹${r.revenue?.toLocaleString()} (${r.orders} orders)`).join("\n")}

================================
Generated by Field Command
    `.trim();
    const blob = new Blob([txt], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `field-report-${Date.now()}.txt` });
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("Report downloaded successfully");
  }, [reportData, showToast]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!user || !token) return <LoginScreen onLogin={handleLogin} />;
  if (loading) {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⬡</div>
          <div style={{ fontFamily: "Orbitron, monospace", color: "#00d9ff", letterSpacing: ".2em" }}>LOADING...</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="bg-layer">
        <div className="bg-grid" />
        <div className="bg-glow g1" /><div className="bg-glow g2" /><div className="bg-glow g3" />
      </div>

      <ToastStack toasts={toasts} />

      <GeofenceAlerts
        alerts={geofenceAlerts}
        onDismiss={(id) => setGeofenceAlerts((p) => p.filter((a) => a.id !== id))}
      />

      <IdleBanner
        overdueReps={overdueReps}
        onNotify={handleNotify}
      />

      <Header
        user={user}
        stats={stats}
        now={now}
        notifications={notifications}
        onClearNotifs={() => { setNotifications(0); setActiveTab("tasks"); }}
        onLeaderboard={() => openModal("leaderboard", true)}
        onReports={() => { openModal("reports", true); fetchReportData(); }}
        onBroadcast={() => openModal("broadcast", true)}
        onLogout={handleLogout}
      />

      <KpiStrip stats={stats} conv={conv} />

      <div className="main-grid">
        <RepsPanel
          reps={reps}
          selectedRep={selectedRep}
          filter={filter}
          setFilter={setFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          expenses={expenses}
          assignedTasks={assignedTasks}
          onSelectRep={handleSelectRep}
          onRefresh={fetchAll}
          onNotify={handleNotify}
          onAssign={handleAssign}
          onExpense={handleExpenseOpen}
          onMeeting={handleMeetingOpen}
          onRoute={handleRoute}
        />

        <MapPanel
          reps={reps}
          selectedRep={selectedRep}
          showDetail={showDetail}
          onSelectRep={handleSelectRep}
          onCloseDetail={() => setShowDetail(false)}
          onNotify={handleNotify}
          onAssign={handleAssign}
          onExpense={handleExpenseOpen}
          onMeeting={handleMeetingOpen}
          onRoute={handleRoute}
        />

        <RightPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          idleReps={idleReps}
          overdueReps={overdueReps}
          activities={activities}
          assignedTasks={assignedTasks}
          expenses={expenses}
          meetings={meetings}
          hourly={hourly}
          stats={stats}
          conv={conv}
          sentNotifs={sentNotifs}
          onMarkDone={markTaskDone}
          onNotify={handleNotify}
          onAssign={handleAssign}
          onExpense={handleExpenseOpen}
          onMeeting={handleMeetingOpen}
        />
      </div>

      {/* ── Modals ── */}
      {modals.notify     && <NotifyModal     rep={modals.notify}     sentNotifs={sentNotifs}       onClose={() => closeModal("notify")}     onSend={handleSendNotify}       />}
      {modals.assign     && <AssignModal     rep={modals.assign}                                   onClose={() => closeModal("assign")}     onAssign={handleAssignTask}     />}
      {modals.expense    && <ExpenseModal    rep={modals.expense}                                  onClose={() => closeModal("expense")}    onSubmit={handleAddExpense}     />}
      {modals.meeting    && <MeetingModal    rep={modals.meeting}                                  onClose={() => closeModal("meeting")}    onSubmit={handleScheduleMeeting}/>}
      {modals.route      && <RouteModal      rep={modals.route}                                    onClose={() => closeModal("route")}      onSend={handleSendRoute}        />}
      {modals.leaderboard && <LeaderboardModal reps={reps}                                         onClose={() => closeModal("leaderboard")}                               />}
      {modals.reports    && <ReportsModal    reportData={reportData}                               onClose={() => closeModal("reports")}    onDownload={downloadReport}     />}
      {modals.broadcast  && <BroadcastModal  reps={reps}                                           onClose={() => closeModal("broadcast")}  onBroadcast={handleBroadcast}   />}
    </div>
  );
}