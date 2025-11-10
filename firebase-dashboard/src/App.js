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

// NEW: Text extraction helper for keyword analysis
function extractWords(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3); // Only words longer than 3 chars
}

// NEW: Common words to exclude from keyword analysis
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'been', 'were', 'they',
  'what', 'when', 'where', 'which', 'who', 'will', 'would', 'could',
  'should', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'also', 'just', 'your', 'their', 'ticket',
  'escalation', 'escalated', 'issue', 'please', 'thanks', 'thank'
]);
                            
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
   Chart Components (CSS-based)
------------------------- */
function LineChart({ data, maxHeight = 200 }) {
  if (!data || data.length === 0) return <div className="empty">No data</div>;
  
  const maxValue = Math.max(...data.map(d => d.count), 1);
  const chartHeight = maxHeight;
  
  return (
    <div style={{ width: '100%', height: chartHeight + 40, position: 'relative' }}>
      {/* Y-axis labels */}
      <div style={{ 
        position: 'absolute', 
        left: 0, 
        top: 0, 
        bottom: 40, 
        width: 30,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontSize: 11,
        color: 'var(--muted)',
        textAlign: 'right',
        paddingRight: 8
      }}>
        <div>{maxValue}</div>
        <div>{Math.round(maxValue / 2)}</div>
        <div>0</div>
      </div>

      {/* Chart area */}
      <div style={{ 
        marginLeft: 35, 
        height: chartHeight, 
        display: 'flex', 
        alignItems: 'flex-end',
        gap: 2,
        borderBottom: '1px solid var(--line)',
        borderLeft: '1px solid var(--line)',
        paddingLeft: 8,
        paddingBottom: 8
      }}>
        {data.map((item, idx) => {
          const heightPercent = (item.count / maxValue) * 100;
          return (
            <div 
              key={idx}
              style={{
                flex: 1,
                height: `${heightPercent}%`,
                minHeight: item.count > 0 ? 2 : 0,
                background: 'linear-gradient(to top, #2563eb, #3b82f6)',
                borderRadius: '2px 2px 0 0',
                position: 'relative',
                cursor: 'pointer',
              }}
              title={`${item.date}: ${item.count}`}
            />
          );
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ 
        marginLeft: 35, 
        display: 'flex', 
        marginTop: 4,
        paddingLeft: 8
      }}>
        {data.map((item, idx) => {
          // Only show every Nth label to avoid crowding
          const showLabel = idx % Math.ceil(data.length / 8) === 0 || idx === data.length - 1;
          return (
            <div 
              key={idx}
              style={{
                flex: 1,
                fontSize: 9,
                color: 'var(--muted)',
                textAlign: 'center',
                transform: 'rotate(-45deg)',
                transformOrigin: 'top left',
                whiteSpace: 'nowrap',
                marginLeft: -10
              }}
            >
              {showLabel ? dayjs(item.date).format('MM/DD') : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorizontalBarChart({ data, color = '#10b981', maxBarWidth = '100%' }) {
  if (!data || data.length === 0) return <div className="empty">No data</div>;
  
  const maxValue = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div style={{ width: '100%' }}>
      {data.map((item, idx) => (
        <div 
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 12,
            gap: 12
          }}
        >
          <div style={{
            width: 120,
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right'
          }} title={item.name}>
            {item.name}
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{
              height: 32,
              width: `${(item.count / maxValue) * 100}%`,
              background: color,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 10,
              minWidth: item.count > 0 ? 30 : 0,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              transition: 'width 0.3s ease'
            }}>
              {item.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------
   Components
------------------------- */
function Kpi({ label, value }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? 0}</div>
    </div>
  );
}

function Tabs({ active, onChange }) {
  return (
    <div className="tabs">
      {["today", "history", "trends"].map((t) => (
        <button
          key={t}
          className={`tab ${active === t ? "active" : ""}`}
          onClick={() => onChange(t)}
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

function Table({ rows }) {
  if (!rows || rows.length === 0) return <div className="empty">No data</div>;
  return (
    <div className="table">
      <div className="thead">
        <div>Ticket</div>
        <div>Subject</div>
        <div>Description</div>
        <div>Team</div>
        <div>Escalator</div>
        <div>Building</div>
        <div>Date</div>
      </div>
      {rows.map((r) => (
        <div className="trow" key={r.id}>
          <div className="truncate"><SafeLink url={r.ticketUrl} /></div>
          <div className="truncate" title={r.subject}>{r.subject || "-"}</div>
          <div className="truncate" title={r.description}>{r.description || "-"}</div>
          <div className="truncate" title={r.escalatedTo || r.team}>{r.escalatedTo || r.team || "-"}</div>
          <div className="truncate" title={r.escalator}>{r.escalator || "-"}</div>
          <div className="truncate" title={r.building || r.buildingName || r.buildingCode}>
            {r.building || r.buildingName || r.buildingCode || "-"}
          </div>
          <div><RowDate value={r.escalationDate} /></div>
        </div>
      ))}
    </div>
  );
}

function TodayView() {
  const [cursor, setCursor] = useState(null);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["today", { cursorId: cursor?.id ?? null }],
    queryFn: () => fetchToday({ pageSize: 200, cursor }),
    keepPreviousData: true,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const hasMore = Boolean(data?.cursor);

  // Compute simple stats
  const uniqueTeams = new Set(rows.map((r) => r.escalatedTo || r.team).filter(Boolean)).size;
  const uniqueBuildings = new Set(rows.map((r) => r.building || r.buildingName || r.buildingCode).filter(Boolean)).size;

  return (
    <div className="panel">
      <div className="kpi-grid">
        <Kpi label="Today's Escalations" value={rows.length} />
        <Kpi label="Teams Involved" value={uniqueTeams} />
        <Kpi label="Buildings Affected" value={uniqueBuildings} />
      </div>

      {error && <div className="empty">Error loading Today: {String(error.message || error)}</div>}
      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty">No escalations today yet.</div>
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
  const [month, setMonth] = useState(monthKey());
  const [cursor, setCursor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
  const [keywordSearch, setKeywordSearch] = useState(""); // NEW: Keyword search state
  
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["trends", days],
    queryFn: () => fetchTrendsData({ days }),
    staleTime: 5 * 60_000,
  });

  const rows = rawData ?? [];

  // NEW: Filter rows by keyword in subject/description
  const filteredRows = useMemo(() => {
    const keywords = keywordSearch.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
    if (keywords.length === 0) return rows;
    
    return rows.filter(r => {
      const subject = (r.subject || "").toLowerCase();
      const description = (r.description || "").toLowerCase();
      const combined = `${subject} ${description}`;
      
      // Check if ALL keywords are present (AND logic)
      return keywords.every(kw => combined.includes(kw));
    });
  }, [rows, keywordSearch]);

  // Calculate trends
  const trends = useMemo(() => {
    const dataToAnalyze = filteredRows; // Use filtered data
    if (!dataToAnalyze.length) return null;

    // Daily escalation counts
    const dailyCounts = {};
    dataToAnalyze.forEach(r => {
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
    dataToAnalyze.forEach(r => {
      const esc = r.escalator || "Unknown";
      escalatorCounts[esc] = (escalatorCounts[esc] || 0) + 1;
    });
    const topEscalators = Object.entries(escalatorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top teams
    const teamCounts = {};
    dataToAnalyze.forEach(r => {
      const team = r.escalatedTo || r.team || "Unknown";
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    });
    const topTeams = Object.entries(teamCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top buildings
    const buildingCounts = {};
    dataToAnalyze.forEach(r => {
      const building = r.building || r.buildingName || r.buildingCode || "Unknown";
      buildingCounts[building] = (buildingCounts[building] || 0) + 1;
    });
    const topBuildings = Object.entries(buildingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // NEW: Top Keywords analysis
    const wordCounts = {};
    dataToAnalyze.forEach(r => {
      const words = [
        ...extractWords(r.subject),
        ...extractWords(r.description)
      ];
      words.forEach(word => {
        if (!STOP_WORDS.has(word)) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });
    const topKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));

    // Summary stats
    const totalEscalations = dataToAnalyze.length;
    const avgPerDay = (totalEscalations / days).toFixed(1);
    const uniqueTeams = Object.keys(teamCounts).length;
    const uniqueBuildings = Object.keys(buildingCounts).length;

    return {
      timelineData,
      topEscalators,
      topTeams,
      topBuildings,
      topKeywords, // NEW
      totalEscalations,
      avgPerDay,
      uniqueTeams,
      uniqueBuildings,
    };
  }, [filteredRows, days]);

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
      {/* Time range selector and keyword search */}
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
        
        {/* NEW: Keyword search input */}
        <input
          className="search"
          placeholder="Filter by keywords (e.g., 'password reset')"
          value={keywordSearch}
          onChange={(e) => setKeywordSearch(e.target.value)}
          style={{ minWidth: 250 }}
        />
        
        {keywordSearch && (
          <button 
            className="btn" 
            onClick={() => setKeywordSearch("")}
            style={{ padding: '8px 12px' }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Show filter status */}
      {keywordSearch && (
        <div style={{ 
          marginBottom: 16, 
          padding: '8px 12px', 
          background: '#eff6ff', 
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          fontSize: 14,
          color: '#1e40af'
        }}>
          📊 Showing {filteredRows.length} of {rows.length} escalations matching "{keywordSearch}"
        </div>
      )}

      {filteredRows.length === 0 ? (
        <div className="empty">
          No escalations found matching "{keywordSearch}". Try different keywords.
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
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
            <LineChart data={trends.timelineData} maxHeight={250} />
          </div>

          {/* NEW: Top Keywords */}
          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600 }}>
              Top Keywords in Escalations
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--muted)' }}>
              Most frequent words found in subject lines and descriptions (excluding common words)
            </p>
            <HorizontalBarChart data={trends.topKeywords} color="#dc2626" />
            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              💡 Tip: Click on any keyword above to copy it, then paste it in the filter box to drill deeper
            </div>
          </div>

          {/* Top Escalators */}
          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
              Top Escalators
            </h3>
            <HorizontalBarChart data={trends.topEscalators} color="#10b981" />
          </div>

          {/* Top Teams */}
          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
              Top Teams (Most Escalations Received)
            </h3>
            <HorizontalBarChart data={trends.topTeams} color="#f59e0b" />
          </div>

          {/* Top Buildings */}
          <div className="card" style={{ marginTop: 20, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
              Top Buildings (Most Escalations)
            </h3>
            <HorizontalBarChart data={trends.topBuildings} color="#8b5cf6" />
          </div>
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
      {tab === "today" && <TodayView />}
      {tab === "history" && <HistoryView />}
      {tab === "trends" && <TrendsView />}
    </div>
  );
}
