// Canonical dictionaries + fuzzy resolvers

export const TEAMS: Record<string, { code: string; name: string }> = {
  "INFRA": { code: "INFRA", name: "Infrastructure" },
  "APPS":  { code: "APPS",  name: "Applications" },
  "DEV":   { code: "DEV",   name: "Developers" },
  "AV":    { code: "AV",    name: "AV" },
};

const TEAM_SYNONYMS: Record<string, string> = {
  "infra": "INFRA",
  "infrastructure": "INFRA",
  "apps": "APPS",
  "applications": "APPS",
  "dev": "DEV",
  "developers": "DEV",
  "audiovisual": "AV",
  "av": "AV",
};

export function resolveTeam(input: string) {
  const key = (input || "").toLowerCase().trim();
  const code = TEAM_SYNONYMS[key] || input.toUpperCase().replace(/\s+/g, "");
  const canonical = TEAMS[code] || { code, name: input || code };
  return canonical;
}

export const BUILDINGS: Record<string, { code: string; name: string }> = {
  "CN":   { code: "CN",   name: "Chinn Elementary" },
  "EL":   { code: "EL",   name: "English Landing Elementary" },
  "GR":   { code: "GR",   name: "Graden Elementary" },
  "HW":   { code: "HW",   name: "Hawthorn Elementary" },
  "HP":   { code: "HP",   name: "Hopewell Elementary" },
  "LC":   { code: "LC",   name: "Line Creek Elementary" },
  "PP":   { code: "PP",   name: "Prairie Point Elementary" },
  "RN":   { code: "RN",   name: "Renner Elementary" },
  "SE":   { code: "SE",   name: "Southeast Elementary" },
  "TR":   { code: "TR",   name: "Tiffany Ridge Elementary" },
  "UC":   { code: "UC",   name: "Union Chapel Elementary" },
  "CG":   { code: "CG",   name: "Congress Middle School" },
  "LV":   { code: "LV",   name: "Lakeview Middle School" },
  "PL":   { code: "PL",   name: "Plaza Middle School" },
  "WL":   { code: "WL",   name: "Walden Middle School" },
  "LD":   { code: "LD",   name: "LEAD Innovation Studio" },
  "PHHS": { code: "PHHS", name: "Park Hill High School" },
  "PHS":  { code: "PHS",  name: "Park Hill South High School" },
  "AQ":   { code: "AQ",   name: "Aquatic Center" },
};

const BUILDING_SYNONYMS: Record<string, string> = {
  "chinn": "CN",
  "english landing": "EL",
  "graden": "GR",
  "hawthorn": "HW",
  "hopewell": "HP",
  "line creek": "LC",
  "prairie point": "PP",
  "renner": "RN",
  "southeast": "SE",
  "tiffany ridge": "TR",
  "union chapel": "UC",
  "congress": "CG",
  "lakeview": "LV",
  "plaza": "PL",
  "walden": "WL",
  "lead": "LD",
  "park hill high": "PHHS",
  "park hill south": "PHS",
  "aquatic center": "AQ",
};

export function resolveBuilding(input: string) {
  const key = (input || "").toLowerCase().trim();
  // Try direct code
  if (BUILDINGS[input]) return BUILDINGS[input];
  // Try synonym by name
  const code = BUILDING_SYNONYMS[key];
  if (code && BUILDINGS[code]) return BUILDINGS[code];
  // Fallback: generate a safe code
  const safe = (input || "UNKNOWN").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return { code: safe.slice(0, 8), name: input || "Unknown" };
}
