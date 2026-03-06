// Central config for teaching area definitions, chart colors, and subject mappings.
// Import from here instead of redefining in each component.

// Imported by: TrendChart, GraphRenderer, LessonInsights, Modal, Chatbot, ChatHistoryModal
export const TEACHING_AREA_CODES = [
  "1.1 Establishing Interaction and rapport",
  "1.2 Setting and Maintaining Rules and Routine",
  "3.1 Activating prior knowledge",
  "3.2 Motivating learners for learning engagement",
  "3.3 Using Questions to deepen learning",
  "3.4 Facilitating collaborative learning",
  "3.5 Concluding the lesson",
  "4.1 Checking for understanding and providing feedback",
];

// Derived from TEACHING_AREA_CODES — ["1.1", "1.2", "3.1", ...]
// Available for import; not yet used directly by any component.
export const TEACHING_AREA_SHORT_CODES = TEACHING_AREA_CODES.map((c) => c.split(" ")[0]);

// Derived from TEACHING_AREA_CODES — { "1.1": "Establishing Interaction and rapport", ... }
// Available for import; not yet used directly by any component.
export const TEACHING_AREAS = Object.fromEntries(
  TEACHING_AREA_CODES.map((c) => [c.split(" ")[0], c.substring(c.indexOf(" ") + 1)])
);

// Imported by: TrendChart, GraphRenderer, Modal
export const LINE_COLORS = [
  "#22c55e",
  "#2563eb",
  "#f59e42",
  "#e11d48",
  "#a21caf",
  "#0ea5e9",
  "#facc15",
  "#64748b",
];

// Imported by: FileUploadModal
// Must stay in sync with chunking_module.py subject_mapping in niepro.
// schoolCode 'N' = primary, 'Y' = secondary.
// code maps to TX slot within that school group (must be unique per schoolCode).
export const SUBJECT_MAPPING = {
  "English":            { code: "T1", schoolCode: "N", classId: 1 },
  "Mathematics":        { code: "T2", schoolCode: "N", classId: 2 },
  "Science (Primary)":  { code: "T3", schoolCode: "N", classId: 3 },
  "Social Studies":     { code: "T1", schoolCode: "Y", classId: 4 },
  "Geography":          { code: "T2", schoolCode: "Y", classId: 5 },
  "History":            { code: "T3", schoolCode: "Y", classId: 6 },
  "Chemistry":          { code: "T4", schoolCode: "Y", classId: 7 },
  "Science (Secondary)":{ code: "T5", schoolCode: "Y", classId: 8 },
  "Art":                { code: "T6", schoolCode: "Y", classId: 9 },
  "Literature":         { code: "T7", schoolCode: "Y", classId: 10 },
};

// Used internally by parseLessonLabel to shorten subject names on chart axes.
// Imported indirectly by: TrendChart, GraphRenderer, Modal (via parseLessonLabel)
export const SHORT_SUBJECT_MAP = {
  Mathematics:      "Math",
  English:          "Eng",
  Science:          "Sci",
  "Social Studies": "SS",
  Geography:        "Geo",
  History:          "Hist",
  Chemistry:        "Chem",
  Art:              "Art",
  Literature:       "Lit",
};

// Imported by: TrendChart, GraphRenderer, Modal
// Strip .xlsx extension from a filename.
export function stripXlsx(filename) {
  return (filename || "").replace(/\.xlsx$/i, "");
}

// Imported by: TrendChart, GraphRenderer, Modal
// Produce a short chart label from a stored filename.
// e.g. "Chemistry_Lesson13_15-02-2024.xlsx" → "Chem_L13"
export function parseLessonLabel(filename) {
  if (!filename) return "Unknown";
  const cleanName = stripXlsx(filename);
  const match = cleanName.match(/^([^_]+)_Lesson(\d+)[_-](\d{2}-\d{2}-\d{4})/i);
  if (match) {
    const [, subject, lessonNum] = match;
    const shortSubject = SHORT_SUBJECT_MAP[subject] || subject.substring(0, 4);
    return `${shortSubject}_L${lessonNum}`;
  }
  const lessonMatch = cleanName.match(/Lesson(\d+)/i);
  if (lessonMatch) return `L${lessonMatch[1]}`;
  return cleanName.substring(0, 8);
}

// Imported by: TrendChart, Modal, LessonInsights, Chatbot, ChatHistoryModal
// GraphRenderer uses its own local variant (keyed by short code, filter-aware).
// Parse the TEACHING AREA STATISTICS block from a data_summary string.
// Returns an object keyed by full area name ("1.1 Establishing Interaction and rapport")
// with { value, percent, questions } per area. Missing areas default to zero.
export function parseTeachingAreaStats(summary) {
  const lines = (summary || "").split("\n");
  const stats = {};
  let inStats = false;
  for (const line of lines) {
    if (line.startsWith("TEACHING AREA STATISTICS:")) { inStats = true; continue; }
    if (inStats) {
      if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) break;
      const match = line.match(
        /^([^.]+\.\d [^:]+): (\d+) utterances \(([\d.]+)%\)(?: - (\d+) questions)?/
      );
      if (match) {
        stats[match[1].trim()] = {
          value:     parseInt(match[2], 10),
          percent:   parseFloat(match[3]),
          questions: match[4] ? parseInt(match[4], 10) : 0,
        };
      }
    }
  }
  TEACHING_AREA_CODES.forEach((code) => {
    if (!stats[code]) stats[code] = { value: 0, percent: 0, questions: 0 };
  });
  return stats;
}
