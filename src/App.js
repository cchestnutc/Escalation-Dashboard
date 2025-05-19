import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";
import { isSameDay, parseISO, format } from "date-fns";
import "./App.css";

function App() {
  const [data, setData] = useState([]);
  const [todayEscalations, setTodayEscalations] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [escalatorFilter, setEscalatorFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const today = new Date();

  useEffect(() => {
    const fetchInitialData = async () => {
      const q = query(collection(db, "escalations"), orderBy("escalationDate", "desc"));
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(result);
      setLastUpdated(new Date());

      const todays = result.filter(e =>
        isSameDay(parseISO(e.escalationDate), today)
      );
      setTodayEscalations(todays);
    };

    fetchInitialData();
  }, []);

  // Refresh just today's escalations every 60 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const q = query(collection(db, "escalations"), orderBy("escalationDate", "desc"));
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const todays = result.filter(e =>
        isSameDay(parseISO(e.escalationDate), new Date())
      );
      setTodayEscalations(todays);
      setLastUpdated(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = (rowId) => {
    setExpandedRows(prev =>
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
    );
  };

  const highlightMatch = (text) => {
    if (!searchText || !text) return text;
    const regex = new RegExp(`(${searchText})`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  const renderCell = (text, rowId, type) => {
    const cleanText = text?.split("Building:")[0]?.trim() || "";
    const isExpanded = expandedRows.includes(`${rowId}-${type}`);
    const firstLine = cleanText.split(/[.\n]/)[0];
    const hasMore = cleanText.length > firstLine.length + 5;

    return (
      <td
        className={`${type}-cell ${isExpanded ? "expanded" : ""}`}
        onClick={() => handleToggle(`${rowId}-${type}`)}
      >
        {isExpanded ? highlightMatch(cleanText) : highlightMatch(firstLine)}
        {!isExpanded && hasMore && <span className="expand-toggle">...</span>}
      </td>
    );
  };

  const uniqueValues = (key) =>
    [...new Set(data.map(e => e[key]).filter(Boolean))].sort();

  // Exclude Help Desk escalations from history
  const historyEscalations = data.filter(e =>
    !isSameDay(parseISO(e.escalationDate), today) &&
    (e.escalatedTo?.toLowerCase().trim() !== "help desk")
  );

  const filteredHistory = historyEscalations.filter(e => {
    const regex = new RegExp(searchText, "i");
    const matchesSearch = searchText ? (
      regex.test(e.subject || "") ||
      regex.test(e.description || "")
    ) : true;
    const matchesBuilding = buildingFilter ? e.building === buildingFilter : true;
    const matchesEscalator = escalatorFilter ? e.escalator === escalatorFilter : true;
    const matchesTeam = teamFilter ? e.escalatedTo === teamFilter : true;
    return matchesSearch && matchesBuilding && matchesEscalator && matchesTeam;
  });

  const renderTable = (entries) => (
    <table className="data-table">
      <thead>
        <tr>
          <th>Ticket URL</th>
          <th>Subject</th>
          <th>Team</th>
          <th>Escalator</th>
          <th>Building</th>
          <th>Description</th>
          <th className="centered">Escalation Date</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            <td><a href={e.ticketURL.split("Subject")[0].trim()} target="_blank" rel="noreferrer">View Ticket</a></td>
            {renderCell(e.subject, e.id, "subject")}
            <td>{highlightMatch(e.escalatedTo)}</td>
            <td>{highlightMatch(e.escalator)}</td>
            <td>{highlightMatch(e.building?.replace(/\b(Elementary|Middle School)\b/gi, '').trim())}</td>
            {renderCell(e.description, e.id, "description")}
            <td className="centered">{format(parseISO(e.escalationDate), 'p')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="App">
      <h1 style={{ textAlign: "center" }}>Escalations Dashboard</h1>
      <p style={{ textAlign: "center", fontStyle: "italic" }}>
        Last updated: {format(lastUpdated, 'p')}
      </p>

      <h2>Today's Escalations ({todayEscalations.length})</h2>
      {renderTable(todayEscalations)}

      <h2>Escalation History</h2>

      <div className="filters">
        <label>
          Team:
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All</option>
            {uniqueValues("escalatedTo").map((team, idx) => (
              <option key={idx} value={team}>{team}</option>
            ))}
          </select>
        </label>

        <label>
          Escalator:
          <select value={escalatorFilter} onChange={(e) => setEscalatorFilter(e.target.value)}>
            <option value="">All</option>
            {uniqueValues("escalator").map((person, idx) => (
              <option key={idx} value={person}>{person}</option>
            ))}
          </select>
        </label>

        <label>
          Building:
          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="">All</option>
            {uniqueValues("building").map((bldg, idx) => {
              const label = bldg.replace(/\b(Elementary|Middle School)\b/gi, '').trim();
              return <option key={idx} value={bldg}>{label}</option>;
            })}
          </select>
        </label>

        <label>
          Search:
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search subject or description"
          />
        </label>
      </div>

      <p>Total Tickets: {filteredHistory.length}</p>
      {renderTable(filteredHistory)}
    </div>
  );
}

export default App;

