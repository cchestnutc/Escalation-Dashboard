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
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, "escalations"), orderBy("escalationDate", "desc"));
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(result);
      setLastUpdated(new Date());
    };

    fetchData();
    const interval = setInterval(() => {
      window.location.reload();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  const todayEscalations = data.filter(e => isSameDay(parseISO(e.escalationDate), today));
  const historyEscalations = data.filter(e => !isSameDay(parseISO(e.escalationDate), today));

  const handleToggle = (rowId) => {
    setExpandedRows(prev =>
      prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
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
        {isExpanded ? cleanText : firstLine}
        {!isExpanded && hasMore && <span className="expand-toggle">...</span>}
      </td>
    );
  };

  const filteredHistory = historyEscalations.filter(e => {
    const regex = new RegExp(`\b${searchText}\b`, "i");
    return regex.test(e.subject || "") || regex.test(e.description || "") || regex.test(e.escalator || "") || regex.test(e.building || "");
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
            <td>{e.escalatedTo}</td>
            <td>{e.escalator}</td>
            <td>{e.building}</td>
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
      <label style={{ display: "block", marginBottom: "1rem" }}>
        Search History:
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search by subject, description, escalator, or building"
          style={{ marginLeft: "0.5rem", padding: "4px 8px" }}
        />
      </label>
      <p>Total Tickets: {filteredHistory.length}</p>
      {renderTable(filteredHistory)}
    </div>
  );
}

export default App;





