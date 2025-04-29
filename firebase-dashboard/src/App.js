import { useState } from "react";
import { useEscalations } from "./hooks/useEscalations";
import { isAfter, startOfWeek, startOfMonth, subWeeks, subMonths, startOfYear, isSameDay } from "date-fns";
import './App.css';

function App() {
  const { data, loading } = useEscalations();
  const [teamFilter, setTeamFilter] = useState("");
  const [escalatorFilter, setEscalatorFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  if (loading) return <p>Loading...</p>;

  const excludedTeams = ["Help Desk", "Purchasing", "Support Services II"];

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
      case "lastWeek":
        return isAfter(date, subWeeks(now, 1));
      case "thisWeek":
        return isAfter(date, startOfWeek(now));
      case "lastMonth":
        return isAfter(date, subMonths(now, 1));
      case "thisMonth":
        return isAfter(date, startOfMonth(now));
      case "ytd":
        return isAfter(date, startOfYear(now));
      default:
        return true;
    }
  };

  const todayEscalations = data
    .filter(e =>
      e.escalationDate &&
      isSameDay(new Date(e.escalationDate), new Date()) &&
      !excludedTeams.includes(e.escalatedTo)
    )
    .sort((a, b) => new Date(b.escalationDate) - new Date(a.escalationDate));

  const historyData = data
    .filter(e => e.escalationDate && !isSameDay(new Date(e.escalationDate), new Date()))
    .sort((a, b) => new Date(b.escalationDate) - new Date(a.escalationDate));

  const filteredData = historyData.filter(e => {
    const matchesTeam = teamFilter ? e.escalatedTo === teamFilter : true;
    const matchesBuilding = buildingFilter ? e.building === buildingFilter : true;
    const matchesEscalator = escalatorFilter ? e.escalator === escalatorFilter : true;
    const regex = new RegExp(`\\b${searchText}\\b`, "i");
    const matchesSearch = searchText
      ? regex.test(e.subject || "") ||
        regex.test(e.description || "") ||
        regex.test(e.escalator || "") ||
        regex.test(e.building || "")
      : true;
    const matchesDate = applyDateFilter(e.escalationDate);
    const notExcluded = !excludedTeams.includes(e.escalatedTo);
    return matchesTeam && matchesBuilding && matchesEscalator && matchesSearch && matchesDate && notExcluded;
  });

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: 'center' }}>Escalations Dashboard</h1>

      {/* Today's Escalations Section */}
      <div style={{ marginBottom: "2rem" }}>
        <h2>Today's Escalations ({todayEscalations.length})</h2>
        {todayEscalations.length > 0 ? (
          <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "120px", textAlign: "center" }}>Ticket URL</th>
                <th>Subject</th>
                <th style={{ width: "100px", textAlign: "center" }}>Team</th>
                <th style={{ width: "100px", textAlign: "center" }}>Building</th>
                <th style={{ width: "100px", textAlign: "center" }}>Escalator</th>
                <th>Description</th>
                <th style={{ width: "140px", textAlign: "center" }}>Escalation Date</th>
              </tr>
            </thead>
            <tbody>
              {todayEscalations.map(e => (
                <tr key={e.id}>
                  <td style={{ textAlign: "center" }}>
                    {e.ticketURL ? (
                      <a href={e.ticketURL} target="_blank" rel="noreferrer">View Ticket</a>
                    ) : "No Link"}
                  </td>
                  <td style={{ maxWidth: "200px" }} className="subject-cell" onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
                    {highlightMatch(e.subject)}
                  </td>
                  <td>{highlightMatch(e.escalatedTo)}</td>
                  <td>{highlightMatch(e.building)}</td>
                  <td>{highlightMatch(e.escalator)}</td>
                  <td style={{ maxWidth: "200px" }} className="description-cell" onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
                    {highlightMatch(e.description)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {e.escalationDate ? new Date(e.escalationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Zero escalations so far for today.</p>
        )}
      </div>

      {/* Escalation History Section */}
      <h2>Escalation History</h2>
      <p><strong>Total Tickets: {filteredData.length}</strong></p>

      {/* Filters */}
      <div className="filters">
        <label>
          Team:
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map((team, idx) => (
              <option key={idx} value={team}>{team}</option>
            ))}
          </select>
        </label>

        <label>
          Escalator:
          <select value={escalatorFilter} onChange={(e) => setEscalatorFilter(e.target.value)}>
            <option value="">All Escalators</option>
            {escalators.map((esc, idx) => (
              <option key={idx} value={esc}>{esc}</option>
            ))}
          </select>
        </label>

        <label>
          Building:
          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="">All Buildings</option>
            {buildings.map((bldg, idx) => (
              <option key={idx} value={bldg}>{bldg}</option>
            ))}
          </select>
        </label>

        <label>
          Date:
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
          />
        </label>
      </div>

      {/* History Table */}
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "120px", textAlign: "center" }}>Ticket URL</th>
              <th>Subject</th>
              <th style={{ width: "100px", textAlign: "center" }}>Team</th>
              <th style={{ width: "100px", textAlign: "center" }}>Building</th>
              <th style={{ width: "100px", textAlign: "center" }}>Escalator</th>
              <th>Description</th>
              <th style={{ width: "140px", textAlign: "center" }}>Escalation Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(e => (
              <tr key={e.id}>
                <td style={{ textAlign: "center" }}>
                  {e.ticketURL ? (
                    <a href={e.ticketURL} target="_blank" rel="noreferrer">View Ticket</a>
                  ) : "No Link"}
                </td>
                <td style={{ maxWidth: "200px" }} className="subject-cell" onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
                  {highlightMatch(e.subject)}
                </td>
                <td>{highlightMatch(e.escalatedTo)}</td>
                <td>{highlightMatch(e.building)}</td>
                <td>{highlightMatch(e.escalator)}</td>
                <td style={{ maxWidth: "200px" }} className="description-cell" onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
                  {highlightMatch(e.description)}
                </td>
                <td style={{ textAlign: "center" }}>
                  {e.escalationDate ? new Date(e.escalationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;



