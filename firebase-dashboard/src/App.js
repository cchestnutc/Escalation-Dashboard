import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* -------------------------
   Helpers
------------------------- */
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function endOfToday()   { const d = new Date(); d.setHours(23,59,59,999); return d; }
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthBounds(yyyymm){ const [y,m]=yyyymm.split("-").map(Number); return { start:new Date(y,m-1,1,0,0,0,0), next:new Date(y,m,1,0,0,0,0) }; }
function toDate(v){ if(!v) return null; if(typeof v?.toDate==="function") return v.toDate(); const d=new Date(v); return isNaN(d)?null:d; }
function RowDate({ value }){ const d=toDate(value); return <>{d?dayjs(d).format("YYYY-MM-DD HH:mm"):"-"}</>; }
function SafeLink({ url }) {
  if (!url) return <>-</>;

  // Clean cases like "...392e44Subject:" or URL-encoded "Subject%3A"
  const raw = String(url).trim();
  const m =
    raw.match(/(https?:\/\/[^\s]*?)(?:Subject:|Subject%3A|$)/i) || [];
  const href = (m[1] || raw).replace(/[)\s]+$/g, "");

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      Open
    </a>
  );
}
                            
/* -------------------------
   Data fetchers (bounded, no scans)
------------------------- */
async function fetchToday({ pageSize = 200, cursor } = {}) {
  const col = collection(db, "escalations");
  const start = startOfToday(); const end = endOfToday();

  // Timestamp range first
  try {
    let qy = query(col,
      where("escalationDate", ">=", start),
      where("escalationDate", "<=", end),
      orderBy("escalationDate", "desc"),
      limit(pageSize)
    );
    if (cursor) qy = query(qy, startAfter(cursor));
    const snap = await getDocs(qy);
    if (!snap.empty) return { rows: snap.docs.map(d=>({id:d.id,...d.data()})), cursor: snap.docs.at(-1) ?? null };
  } catch {}

  // ISO string fallback
  const sISO = start.toISOString(); const eISO = end.toISOString();
  let qy = query(col,
    where("escalationDate", ">=", sISO),
    where("escalationDate", "<=", eISO),
    orderBy("escalationDate", "desc"),
    limit(pageSize)
  );
  if (cursor) qy = query(qy, startAfter(cursor));
  const snap = await getDocs(qy);
  return { rows: snap.docs.map(d=>({id:d.id,...d.data()})), cursor: snap.docs.at(-1) ?? null };
}

async function fetchHistoryPage({ yyyymm, pageSize = 200, cursor }) {
  const col = collection(db, "escalations");
  const { start, next } = monthBounds(yyyymm);

  // Timestamp range
  try {
    let qy = query(col,
      where("escalationDate", ">=", start),
      where("escalationDate", "<", next),
      orderBy("escalationDate", "desc"),
      limit(pageSize)
    );
    if (cursor) qy = query(qy, startAfter(cursor));
    const snap = await getDocs(qy);
    if (!snap.empty) return { rows: snap.docs.map(d=>({id:d.id,...d.data()})), cursor: snap.docs.at(-1) ?? null };
  } catch {}

  // ISO string month window
  const sISO = start.toISOString(); const nISO = next.toISOString();
  let qy = query(col,
    where("escalationDate", ">=", sISO),
    where("escalationDate", "<", nISO),
    orderBy("escalationDate", "desc"),
    limit(pageSize)
  );
  if (cursor) qy = query(qy, startAfter(cursor));
  const snap = await getDocs(qy);
  return { rows: snap.docs.map(d=>({id:d.id,...d.data()})), cursor: snap.docs.at(-1) ?? null };
}

async function fetchTrendsData({ days = 30 }) {
  const col = collection(db, "escalations");
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  // Fetch all escalations from the last N days
  try {
    let qy = query(col,
      where("escalationDate", ">=", start),
      orderBy("escalationDate", "desc"),
      limit(1000) // Get up to 1000 records for trends
    );
    const snap = await getDocs(qy);
    if (!snap.empty) return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch {}

  // ISO string fallback
  const sISO = start.toISOString();
  let qy = query(col,
    where("escalationDate", ">=", sISO),
    orderBy("escalationDate", "desc"),
    limit(1000)
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

/* -------------------------
   Small UI bits
------------------------- */
function Tabs({ active, onChange }) {
  return (
    <div className="tabs">
      <button className={`tab ${active==="today"?"active":""}`} onClick={()=>onChange("today")}>Today</button>
      <button className={`tab ${active==="history"?"active":""}`} onClick={()=>onChange("history")}>History</button>
      <button className={`tab ${active==="trends"?"active":""}`} onClick={()=>onChange("trends")}>Trends</button>
    </div>
  );
}
function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

/* 7-column table:
   Ticket URL | Subject | Description | Team | Escalator | Building | Escalation Date */
function Table({ rows }) {
  return (
    <div className="table">
      <div className="thead">
        <div>Ticket URL</div>
        <div>Subject</div>
        <div>Description</div>
        <div>Team</div>
        <div>Escalator</div>
        <div>Building</div>
        <div>Escalation Date</div>
      </div>

      {rows.map((r) => (
        <div key={r.id} className="trow">
          <div><SafeLink url={r.ticketURL} /></div>
          <div className="truncate">{r.subject ?? "-"}</div>
          <div className="truncate">{r.description ?? "-"}</div>
          <div>{r.escalatedTo ?? r.team ?? "-"}</div>
          <div>{r.escalator ?? "-"}</div>
          <div>{r.building ?? r.buildingName ?? r.buildingCode ?? "-"}</div>
          <div><RowDate value={r.escalationDate} /></div>
        </div>
      ))}
    </div>
  );
}


/* -------------------------
   Views
------------------------- */
function TodayView() {
  const [cursor, setCursor] = useState(null);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["today", { cursorId: cursor?.id ?? null }],
    queryFn: () => fetchToday({ pageSize: 200, cursor }),
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const hasMore = Boolean(data?.cursor);

  return (
    <div className="panel">
      <div className="kpi-grid">
        <Kpi label="Today" value={rows.length} />
        <Kpi label="Teams" value={new Set(rows.map(x => x.escalatedTo ?? x.team)).size} />
        <Kpi label="Buildings" value={new Set(rows.map(x => x.building ?? x.buildingName ?? x.buildingCode)).size} />
      </div>

      {error && <div className="empty">Error loading Today: {String(error.message || error)}</div>}
      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty">No escalations yet today.</div>
      ) : (
        <>
          <Table rows={rows} />
          {hasMore && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={isFetching} onClick={()=>setCursor({ id: data.cursor.id })}>
                {isFetching ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryView() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [cursor, setCursor] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); // page-local filter

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["history", month, { cursorId: cursor?.id ?? null }],
    queryFn: () => fetchHistoryPage({ yyyymm: month, pageSize: 200, cursor }),
    keepPreviousData: true,
    staleTime: 5 * 60_000,
  });

  const rows = data?.rows ?? [];
  const hasMore = Boolean(data?.cursor);

  // Filter by Escalator, Building, or Team
  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r => {
      const team = (r.escalatedTo ?? r.team ?? "").toLowerCase();
      const escalator = (r.escalator ?? "").toLowerCase();
      const building = (r.building ?? r.buildingName ?? r.buildingCode ?? "").toLowerCase();
      return team.includes(t) || escalator.includes(t) || building.includes(t);
    });
  }, [rows, searchTerm]);

  return (
    <div className="panel">
      <div className="history-toolbar">
        <label>
          Month
          <input
            type="month"
            className="search"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setCursor(null); }}
          />
        </label>
        <input
          className="search"
          placeholder="Search by Escalator, Building, or Team"
          value={searchTerm}
          onChange={(e)=>setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="empty">Error loading History: {String(error.message || error)}</div>}
      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No results for {month}{searchTerm ? ` matching "${searchTerm}"` : ""}.</div>
      ) : (
        <>
          <Table rows={filtered} />
          {hasMore && (
            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={isFetching} onClick={()=>setCursor({ id: data.cursor.id })}>
                {isFetching ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrendsView() {
  const [days, setDays] = useState(30);
  
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["trends", days],
    queryFn: () => fetchTrendsData({ days }),
    staleTime: 5 * 60_000,
  });

  const rows = rawData ?? [];

  // Calculate trends
  const trends = useMemo(() => {
    if (!rows.length) return null;

    // Daily escalation counts
    const dailyCounts = {};
    rows.forEach(r => {
      const date = toDate(r.escalationDate);
      if (!date) return;
      const dayKey = dayjs(date).format("YYYY-MM-DD");
      dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
    });

    // Fill in missing days with 0
    const today = new Date();
    const timelineData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayKey = dayjs(d).format("YYYY-MM-DD");
      timelineData.push({
        date: dayKey,
        count: dailyCounts[dayKey] || 0,
      });
    }

    // Top escalators
    const escalatorCounts = {};
    rows.forEach(r => {
      const esc = r.escalator || "Unknown";
      escalatorCounts[esc] = (escalatorCounts[esc] || 0) + 1;
    });
    const topEscalators = Object.entries(escalatorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top teams
    const teamCounts = {};
    rows.forEach(r => {
      const team = r.escalatedTo || r.team || "Unknown";
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });
    const topTeams = Object.entries(teamCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top buildings
    const buildingCounts = {};
    rows.forEach(r => {
      const building = r.building || r.buildingName || r.buildingCode || "Unknown";
      buildingCounts[building] = (buildingCounts[building] || 0) + 1;
    });
    const topBuildings = Object.entries(buildingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Summary stats
    const totalEscalations = rows.length;
    const avgPerDay = (totalEscalations / days).toFixed(1);
    const uniqueTeams = Object.keys(teamCounts).length;
    const uniqueBuildings = Object.keys(buildingCounts).length;

    return {
      timelineData,
      topEscalators,
      topTeams,
      topBuildings,
      totalEscalations,
      avgPerDay,
      uniqueTeams,
      uniqueBuildings,
    };
  }, [rows, days]);

  if (error) {
    return (
      <div className="panel">
        <div className="empty">Error loading trends: {String(error.message || error)}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="panel">
        <div className="loading">Loading trends…</div>
      </div>
    );
  }

  if (!trends || !rows.length) {
    return (
      <div className="panel">
        <div className="empty">No data available for the selected period.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      {/* Time range selector */}
      <div className="history-toolbar" style={{ marginBottom: 16 }}>
        <label>
          Time Range
          <select
            className="search"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </label>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid">
        <Kpi label={`Total (${days} days)`} value={trends.totalEscalations} />
        <Kpi label="Avg Per Day" value={trends.avgPerDay} />
        <Kpi label="Unique Teams" value={trends.uniqueTeams} />
        <Kpi label="Unique Buildings" value={trends.uniqueBuildings} />
      </div>

      {/* Escalations Over Time */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Escalations Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends.timelineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#2563eb" 
              strokeWidth={2}
              name="Escalations"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Escalators */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Top Escalators
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends.topEscalators} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" name="Escalations" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Teams */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Top Teams (Most Escalations Received)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends.topTeams} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="count" fill="#f59e0b" name="Escalations" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Buildings */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
          Top Buildings (Most Escalations)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends.topBuildings} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar dataKey="count" fill="#8b5cf6" name="Escalations" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------
   App
------------------------- */
export default function App() {
  const [tab, setTab] = useState("today");
  return (
    <div className="app-shell">
      <header className="app-header"><h1>Escalations</h1></header>
      <Tabs active={tab} onChange={setTab} />
      {tab === "today" && <TodayView />}
      {tab === "history" && <HistoryView />}
      {tab === "trends" && <TrendsView />}
    </div>
  );
}
