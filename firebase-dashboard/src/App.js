import { useState } from "react";
import { useEscalations } from "./hooks/useEscalations";
import { isAfter, startOfWeek, startOfMonth, subWeeks, subMonths, startOfYear, isSameDay } from "date-fns";
import './App.css';


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

  const historyData = data
    .filter(e => e.escalationDate && !isSameDay(new Date(e.escalationDate), new Date()))
    .sort((a, b) => new Date(b.escalationDate) - new Date(a.escalationDate));

  const filteredData = historyData.filter(e => {
    const matchesTeam = teamFilter ? e.escalatedTo === teamFilter : true;
    const matchesEscalator = escalatorFilter ? e.escalator === escalatorFilter : true;
    const regex = new RegExp(`${searchText}`, "i");
    const matchesSearch = searchText
      ? regex.test(e.subject || "") ||
        regex.test(e.description || "") ||
        regex.test(e.escalator || "")
      : true;
    const matchesDate = applyDateFilter(e.escalationDate);
    return matchesTeam && matchesEscalator && matchesSearch && matchesDate;
  });

  const todayEscalations = data.filter(e =>
    e.escalationDate && isSameDay(new Date(e.escalationDate), new Date())
  );

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: 'center' }}>Escalations Dashboard</h1>

      {/* Today's Escalations Section */}
      <div style={{ marginBottom: "1rem" }}>
        <h2>Today's Escalations ({todayEscalations.length})</h2>
        {todayEscalations.length > 0 ? (
          <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%", tableLayout: "fixed" }}>
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
              {todayEscalations.map(e => (
                <tr key={e.id}>
                  <td>
                    {e.ticketURL ? (
                      <a href={e.ticketURL} target="_blank" rel="noreferrer">View Ticket</a>
                    ) : "No Link"}
                  </td>
                  <td>{highlightMatch(e.subject)}</td>
                  <td>{highlightMatch(e.escalatedTo)}</td>
                  <td>{highlightMatch(e.escalator)}</td>
                  <td style={{ maxWidth: "200px", cursor: "pointer" }} onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
  <div className="collapsed-description">
    {highlightMatch(e.description?.split(/[.
]/)[0] || "")}
    {e.description && e.description.split(/[.
]/).length > 1 && <span className="expand-toggle">...</span>}
  </div>
  <div className="full-description" style={{ display: 'none' }}>
    {highlightMatch(e.description)}
  </div>
</td>
                  <td>{e.escalationDate ? new Date(e.escalationDate).toLocaleTimeString('en-US') : ""}</td>
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
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="8" cellSpacing="0" style={{ width: "100%", tableLayout: "fixed" }}>
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
                <td style={{ maxWidth: "200px", cursor: "pointer" }} onClick={(e) => e.currentTarget.classList.toggle('expanded')}>
                    <div className="collapsed-description">{highlightMatch(e.description?.split(/[.
]/)[0] || "")}</div>
                    {e.description && e.description.split(/[.
]/).length > 1 && <div className="expand-toggle">...</div>}
                    <div className="full-description" style={{ display: 'none' }}>{highlightMatch(e.description)}</div>
                  </td>
                <td>{e.escalationDate ? new Date(e.escalationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
