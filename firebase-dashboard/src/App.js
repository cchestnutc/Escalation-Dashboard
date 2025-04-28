import { useState } from "react";
import { useEscalations } from "./hooks/useEscalations";
import { isAfter, startOfWeek, startOfMonth, subWeeks, subMonths, startOfYear } from "date-fns";

function App() {
  const { data, loading } = useEscalations();
  const [teamFilter, setTeamFilter] = useState("");
  const [escalatorFilter, setEscalatorFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  if (loading) return <p>Loading...</p>;

  const teams = [...new Set(data.map(e => e.escalatedTo).filter(Boolean))];
  const escalators = [...new Set(data.map(e => e.escalator).filter(Boolean))];

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

  const filteredData = data.filter(e => {
    const matchesTeam = teamFilter ? e.escalatedTo === teamFilter : true;
    const matchesEscalator = escalatorFilter ? e.escalator === escalatorFilter : true;
    const regex = new RegExp(`\\b${searchText}\\b`, "i");
    const matchesSearch = searchText
      ? regex.test(e.subject || "") ||
        regex.test(e.description || "") ||
        regex.test(e.escalator || "")
      : true;
    const matchesDate = applyDateFilter(e.escalationDate);
    return matchesTeam && matchesEscalator && matchesSearch && matchesDate;
  });

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Escalations Dashboard</h1>
      <p><strong>Total Tickets: {filteredData.length}</strong></p>

      {/* Filters */}
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

      {/* Table */}
      <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Ticket URL</th>
            <th>Subject</th>
            <th>Team</th>
            <th>Escalator</th>
            <th>Description</th>
            <th>Escalation Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map(e => (
            <tr key={e.id}>
              <td>
                {e.ticketURL ? (
                  <a href={e.ticketURL} target="_blank" rel="noreferrer">View Ticket</a>
                ) : "No Link"}
              </td>
              <td>{highlightMatch(e.subject)}</td>
              <td>{highlightMatch(e.escalatedTo)}</td>
              <td>{highlightMatch(e.escalator)}</td>
              <td>{highlightMatch(e.description)}</td>
              <td>{e.escalationDate ? new Date(e.escalationDate).toLocaleDateString() : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;






