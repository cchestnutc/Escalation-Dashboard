import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";
import "./App.css";

function App() {
  const [escalations, setEscalations] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      window.location.reload();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const q = query(collection(db, "escalations"), orderBy("escalationDate", "desc"));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => doc.data());
    setEscalations(data);
    setLastUpdated(new Date());
  };

  const today = new Date().toDateString();
  const todaysEscalations = escalations.filter(e => new Date(e.escalationDate).toDateString() === today);
  const historyEscalations = escalations.filter(e => new Date(e.escalationDate).toDateString() !== today);

  const collapseText = (text, type) => {
    const cleanText = text.split(/Building:/)[0].trim();
    const firstLine = cleanText.split(". ")[0];
    const isLong = cleanText.length > firstLine.length + 10;

    return (
      <div
        className={`${type}-cell`}
        onClick={e => e.currentTarget.classList.toggle("expanded")}
      >
        {firstLine}
        {isLong && <span className="expand-toggle">...</span>}
        <div className="expanded-content">{cleanText}</div>
      </div>
    );
  };

  const renderTable = (data) => (
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
        {data.map((e, index) => (
          <tr key={index}>
            <td><a href={e.ticketURL} target="_blank" rel="noreferrer">View Ticket</a></td>
            <td>{collapseText(e.subject || "", "subject")}</td>
            <td>{e.escalatedTo}</td>
            <td>{e.escalator}</td>
            <td>{e.building}</td>
            <td>{collapseText(e.description || "", "description")}</td>
            <td className="centered">{new Date(e.escalationDate).toLocaleTimeString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>Escalations Dashboard</h1>
      <p style={{ textAlign: "center", fontStyle: "italic" }}>
        Last updated: {lastUpdated.toLocaleTimeString()}
      </p>

      <h2>Today's Escalations ({todaysEscalations.length})</h2>
      {renderTable(todaysEscalations)}

      <h2 style={{ marginTop: "2rem" }}>Escalation History</h2>
      {renderTable(historyEscalations)}
    </div>
  );
}

export default App;







