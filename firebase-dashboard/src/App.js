import { useState, useEffect } from "react";
import { useEscalations } from "./hooks/useEscalations";
import { isAfter, startOfWeek, startOfMonth, subWeeks, subMonths, startOfYear, isSameDay } from "date-fns";
import './App.css';

function App() {
  const escalationHook = useEscalations();
  const { data, loading } = escalationHook;
  const [teamFilter, setTeamFilter] = useState("");
  const [escalatorFilter, setEscalatorFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const excludedTeams = ["Help Desk", "Purchasing", "Support Services II"];

  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>Loading...</p>;

  const teams = [...new Set(data.map(e => e.escalatedTo).filter(Boolean))].sort();
  const buildings = [...new Set(data.map(e => e.building).filter(Boolean))].sort();
  const escalators = [...new Set(data.map(e => e.escalator).filter(Boolean))].sort();

  const highlightMatch = (text) => {
    if (!searchText || !text) return text;
    const regex = new RegExp(`\\b(${searchText})\\b`, "gi");
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  const applyDateFilter = (dateStr) => {
    if (!dateFilter || !dateStr) return true;
    const date = new Date(dateStr);
    const now = new Date();
    switch (dateFilter) {
      case "lastWeek": return isAfter(date, subWeeks(now, 1));
      case "thisWeek": return isAfter(date, startOfWeek(now));
      case "lastMonth": return isAfter(date, subMonths(now, 1));
      case "thisMonth": return isAfter(date, startOfMonth(now));
      case "ytd": return isAfter(date, startOfYear(now));
      default: return true;
    }
  };

  const cleanURL = (url) => url && url.includes("Subject") ? url.split("Subject")[0].trim() : url;

  const todayEscalations = data.filter(e =>
    e.escalationDate &&
    isSameDay(new Date(e.escalationDate), new Date()) &&
    !excludedTeams.includes(e.escalatedTo)
  ).sort((a, b) => new Date(b.escalationDate) - new Date(a.escalationDate));

  const historyData = data.filter(e =>
    e.escalationDate && !isSameDay(new Date(e.escalationDate), new Date())
  ).sort((a, b) => new Date(b.escalationDate) - new Date(a.escalationDate));

  const filteredData = historyData.filter(e => {
    const matchesTeam = teamFilter ? e.escalatedTo === teamFilter : true;
    const matchesBuilding = buildingFilter ? e.building === buildingFilter : true;
    const matchesEscalator = escalatorFilter ? e.escalator === escalatorFilter : true;
    const regex = new RegExp(`\\b${searchText}\\b`, "i");
    const matchesSearch = searchText ? (
      regex.test(e.subject || "") ||
      regex.test(e.description || "") ||
      regex.test(e.escalator || "") ||
      regex.test(e.building || "")
    ) : true;
    const matchesDate = applyDateFilter(e.escalationDate);
    const notExcluded = !excludedTeams.includes(e.escalatedTo);
    return matchesTeam && matchesBuilding && matchesEscalator && matchesSearch && matchesDate && notExcluded;
  });

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: 'center' }}>Escalations Dashboard</h1>
      <p style={{ textAlign: 'center' }}><em>Last updated: {lastUpdated.toLocaleTimeString()}</em></p>

      <h2>Today's Escalations ({todayEscalations.length})</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticket URL</th>
            <th>Subject</th>
            <th>Team</th>
            <th>Escalator</th>
            <th>Building</th>
            <th>Description</th>
            <th>Escalation Date</th>
          </tr>
        </thead>
        <tbody>
          {todayEscalations.map((e, idx) => (
            <tr key={`today-${idx}`}>
              <td className="centered"><a href={cleanURL(e.ticketURL)} target="_blank" rel="noreferrer">View Ticket</a></td>
              <td>{highlightMatch(e.subject)}</td>
              <td>{highlightMatch(e.escalatedTo)}</td>
              <td>{highlightMatch(e.escalator)}</td>
              <td>{highlightMatch(e.building)}</td>
              <td>{highlightMatch(e.description)}</td>
              <td className="centered">{new Date(e.escalationDate).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Escalation History</h2>
      <p><strong>Total Tickets: {filteredData.length}</strong></p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ marginRight: "1rem" }}>
          Filter by Team:
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map((team, idx) => (
              <option key={idx} value={team}>{team}</option>
            ))}
          </select>
        </label>

        <label style={{ marginRight: "1rem" }}>
          Filter by Escalator:
          <select value={escalatorFilter} onChange={(e) => setEscalatorFilter(e.target.value)}>
            <option value="">All Escalators</option>
            {escalators.map((esc, idx) => (
              <option key={idx} value={esc}>{esc}</option>
            ))}
          </select>
        </label>

        <label style={{ marginRight: "1rem" }}>
          Filter by Building:
          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="">All Buildings</option>
            {buildings.map((bld, idx) => (
              <option key={idx} value={bld}>{bld}</option>
            ))}
          </select>
        </label>

        <label style={{ marginRight: "1rem" }}>
          Date Filter:
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="">All Dates</option>
            <option value="lastWeek">Last Week</option>
            <option value="thisWeek">Current Week</option>
            <option value="lastMonth">Last Month</option>
            <option value="thisMonth">Current Month</option>
            <option value="ytd">Year to Date</option>
          </select>
        </label>

        <label>
          Search:
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search..."
            style={{ marginLeft: "0.5rem" }}
          />
        </label>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Ticket URL</th>
            <th>Subject</th>
            <th>Team</th>
            <th>Escalator</th>
            <th>Building</th>
            <th>Description</th>
            <th>Escalation Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((e, idx) => (
            <tr key={`history-${idx}`}>
              <td className="centered"><a href={cleanURL(e.ticketURL)} target="_blank" rel="noreferrer">View Ticket</a></td>
              <td>{highlightMatch(e.subject)}</td>
              <td>{highlightMatch(e.escalatedTo)}</td>
              <td>{highlightMatch(e.escalator)}</td>
              <td>{highlightMatch(e.building)}</td>
              <td>{highlightMatch(e.description)}</td>
              <td className="centered">{new Date(e.escalationDate).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;







