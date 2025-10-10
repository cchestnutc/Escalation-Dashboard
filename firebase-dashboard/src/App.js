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

/* -------------------------
   Helpers
------------------------- */
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function endOfToday()   { const d = new Date(); d.setHours(23,59,59,999); return d; }
function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthBounds(yyyymm){ const [y,m]=yyyymm.split("-").map(Number); return { start:new Date(y,m-1,1,0,0,0,0), next:new Date(y,m,1,0,0,0,0) }; }
function toDate(v){ if(!v) return null; if(typeof v?.toDate==="function") return v.toDate(); const d=new Date(v); return isNaN(d)?null:d; }
function RowDate({ value }){ const d=toDate(value); return <>{d?dayjs(d).format("YYYY-MM-DD HH:mm"):"-"}</>; }

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

/* -------------------------
   Small UI bits
------------------------- */
function Tabs({ active, onChange }) {
  return (
    <div className="tabs">
      <button className={`tab ${active==="today"?"active":""}`} onClick={()=>onChange("today")}>Today</button>
      <button className={`tab ${active==="history"?"active":""}`} onClick={()=>onChange("history")}>History</button>
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
          <div>{r.ticketURL ? <a href={r.ticketURL} target="_blank" rel="noreferrer">Open</a> : "-"}</div>
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
        <div className="empty">No results for {month}{searchTerm ? ` matching “${searchTerm}”` : ""}.</div>
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

/* -------------------------
   App
------------------------- */
export default function App() {
  const [tab, setTab] = useState("today");
  return (
    <div className="app-shell">
      <header className="app-header"><h1>Escalations</h1></header>
      <Tabs active={tab} onChange={setTab} />
      {tab === "today" ? <TodayView /> : <HistoryView />}
    </div>
  );
}







