import { useState, useEffect } from "react";
import { useEscalations } from "./hooks/useEscalations";
import { isAfter, startOfWeek, startOfMonth, subWeeks, subMonths, startOfYear, isSameDay } from "date-fns";
import './App.css';

function App() {
  const { data, loading, refetch } = useEscalations();
  const [teamFilter, setTeamFilter] = useState("");
  const [escalatorFilter, setEscalatorFilter] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const excludedTeams = ["Help Desk", "Purchasing", "Support Services II"];

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastUpdated(new Date());
    }, 60000); // 1 minute refresh
    return () => clearInterval(interval);
  }, [refetch]);

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

  const cleanURL = (url) =>
    url && url.includes("Subject") ? url.split("Subject")[0].trim() : url;

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
      <p style={{ textAlign: 'center' }}><em>Last updated: {lastUpdated.toLocaleTimeString()}</em></p>
      {/* Render the rest of your dashboard UI here using todayEscalations and filteredData */}
    </div>
  );
}

export default App;







