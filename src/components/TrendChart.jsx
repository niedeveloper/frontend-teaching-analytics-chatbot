"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// -----------------------------
// Constants
// -----------------------------
const TEACHING_AREA_CODES = [
  "1.1 Establishing Interaction and rapport",
  "1.2 Setting and Maintaining Rules and Routine",
  "3.1 Activating prior knowledge",
  "3.2 Motivating learners for learning engagement",
  "3.3 Using Questions to deepen learning",
  "3.4 Facilitating collaborative learning",
  "3.5 Concluding the lesson",
  "4.1 Checking for understanding and providing feedback",
];

const LINE_COLORS = [
  "#22c55e",
  "#2563eb",
  "#f59e42",
  "#e11d48",
  "#a21caf",
  "#0ea5e9",
  "#facc15",
  "#64748b",
];

// -----------------------------
// Helpers
// -----------------------------
function parseTeachingAreaStats(summary) {
  const lines = (summary || "").split("\n");
  const stats = {};
  let inStats = false;
  for (const line of lines) {
    if (line.startsWith("TEACHING AREA STATISTICS:")) {
      inStats = true;
      continue;
    }
    if (inStats) {
      if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) break;
      const match = line.match(
        /^([^.]+\.\d [^:]+): (\d+) utterances \(([\d.]+)%\)/
      );
      if (match) {
        stats[match[1].trim()] = {
          value: parseInt(match[2], 10),
          percent: parseFloat(match[3]),
        };
      }
    }
  }
  TEACHING_AREA_CODES.forEach((code) => {
    if (!stats[code]) stats[code] = { value: 0, percent: 0 };
  });
  return stats;
}

function getStatValue(stat, mode) {
  return mode === "percent" ? stat?.percent || 0 : stat?.value || 0;
}

function stripXlsx(filename) {
  return (filename || "").replace(/\.xlsx$/i, "");
}

function getAverageStats(allStats) {
  return TEACHING_AREA_CODES.map((code) => {
    const total = allStats.reduce(
      (sum, stats) => sum + (stats[code]?.percent || 0),
      0
    );
    return {
      name: code,
      percent: allStats.length ? +(total / allStats.length).toFixed(1) : 0,
    };
  });
}

// -----------------------------
// Component
// -----------------------------
export default function TrendChart({ lessonFilter = [] }) {
  const { user } = useUser();
  const [fileSummaries, setFileSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState("percent"); // percent | value
  const [selectedAreas, setSelectedAreas] = useState([...TEACHING_AREA_CODES]);
  const [chartView, setChartView] = useState("line"); // line | groupedBar | total
  const [lessonFilterState, setLessonFilter] = useState(lessonFilter);

  // ---------------------------------
  // Fetch
  // ---------------------------------
  useEffect(() => {
    async function fetchFileSummaries() {
      setLoading(true);
      if (!user?.email) {
        setFileSummaries([]);
        setLoading(false);
        return;
      }
      const { data: userRows, error: userError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", user.email)
        .single();
      if (userError || !userRows) {
        setFileSummaries([]);
        setLoading(false);
        return;
      }
      const userId = userRows.user_id;

      const { data: fileRows, error: fileError } = await supabase
        .from("files")
        .select("file_id, stored_filename, data_summary")
        .eq("user_id", userId)
        .order("lesson_date", { ascending: true });
      if (fileError || !fileRows) {
        setFileSummaries([]);
        setLoading(false);
        return;
      }

      // Filter out audio files (.mp3, .mp4, .wav, .m4a) - only include transcript files
      const filteredFiles = fileRows.filter(file => {
        const filename = file.stored_filename || '';
        const isAudioFile = /\.(mp3|mp4|wav|m4a)$/i.test(filename);
        return !isAudioFile; // Exclude audio files
      });

      setFileSummaries(filteredFiles);
      setLoading(false);
    }
    fetchFileSummaries();
  }, [user]);

  // ---------------------------------
  // Derived data
  // ---------------------------------
  const lessons = useMemo(
    () =>
      fileSummaries.map((f, idx) =>
        stripXlsx(f.stored_filename || `Lesson #${idx + 1}`)
      ),
    [fileSummaries]
  );

  // Apply lessonFilter to filter the fileSummaries
  const filteredFileSummaries = useMemo(() => {
    return fileSummaries.filter((file) =>
      lessonFilterState.length === 0 || lessonFilterState.includes(stripXlsx(file.stored_filename))
    );
  }, [fileSummaries, lessonFilterState]);

  const allStats = useMemo(
    () =>
      filteredFileSummaries.map((f) =>
        parseTeachingAreaStats((f.data_summary || "").replace(/\\n/g, "\n"))
      ),
    [filteredFileSummaries]
  );

  const chartDataLine = useMemo(() => {
    return filteredFileSummaries.map((file, idx) => {
      const stats = parseTeachingAreaStats(
        (file.data_summary || "").replace(/\\n/g, "\n")
      );
      const entry = {
        lesson: stripXlsx(file.stored_filename || `Lesson #${idx + 1}`),
      };
      TEACHING_AREA_CODES.forEach((code) => {
        entry[code] = getStatValue(stats[code], displayMode);
      });
      return entry;
    });
  }, [filteredFileSummaries, displayMode]);

  // Grouped bar: one row per area, multiple bars per lesson
  const chartDataGroupedBar = useMemo(() => {
    return TEACHING_AREA_CODES.map((code) => {
      const row = { code: code.split(" ")[0] };
      filteredFileSummaries.forEach((file, idx) => {
        const stats = parseTeachingAreaStats(
          (file.data_summary || "").replace(/\\n/g, "\n")
        );
        row[stripXlsx(file.stored_filename || `Lesson #${idx + 1}`)] =
          getStatValue(stats[code], displayMode);
      });
      return row;
    });
  }, [filteredFileSummaries, displayMode]);

  // Total distribution: if percent -> average % per area; if value -> sum of utterances
  const chartDataTotal = useMemo(() => {
    if (displayMode === "value") {
      return TEACHING_AREA_CODES.map((code) => {
        let total = 0;
        allStats.forEach((s) => (total += s[code]?.value || 0));
        return { code: code.split(" ")[0], value: total };
      });
    }
    const avg = getAverageStats(allStats);
    return avg.map((a) => ({ code: a.name.split(" ")[0], percent: a.percent }));
  }, [allStats, displayMode]);

  // ---------------------------------
  // UI handlers
  // ---------------------------------
  function handleAreaToggle(area) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }
  function handleSelectAll() {
    setSelectedAreas([...TEACHING_AREA_CODES]);
  }
  function handleClearAll() {
    setSelectedAreas([]);
  }

  function handleLessonFilterChange(e) {
    const { options } = e.target;
    const selectedLessons = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value);
    setLessonFilter(selectedLessons);
  }

  const yTick = (val) => (displayMode === "percent" ? `${val}%` : val);
  const tooltipFmt = (val) => (displayMode === "percent" ? `${val}%` : val);

  return (
    <section className="rounded-2xl shadow-lg bg-white/90 border border-blue-100 px-2 md:px-6 py-6 flex flex-col items-center">
      <h2 className="text-indigo-700 font-semibold mb-2 text-lg md:text-xl">
        Teaching Area Trends
      </h2>

      {/* Lesson Filter (for line and groupedBar chart view) */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <label className="text-xs">Filter Lessons: </label>
        <select
          multiple
          className="border px-2 py-1 rounded-md text-sm"
          onChange={handleLessonFilterChange}
          value={lessonFilterState}
        >
          {lessons.map((lesson, idx) => (
            <option key={idx} value={lesson}>
              {lesson}
            </option>
          ))}
        </select>
      </div>

      {/* Chart View Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <div className="inline-flex bg-gray-100 rounded-lg p-1 shadow">
          {[
            { key: "line", label: "Line (by Area across Lessons)" },
            { key: "groupedBar", label: "Grouped Bar (Areas × Lessons)" },
            { key: "total", label: "Total Distribution" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setChartView(opt.key)}
              className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                chartView === opt.key
                  ? "bg-white text-blue-700"
                  : "text-gray-700 hover:text-blue-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggle for percent/utterances */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-4 bg-gray-100 px-4 py-2 rounded shadow text-base">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              value="percent"
              checked={displayMode === "percent"}
              onChange={() => setDisplayMode("percent")}
              className="mr-1 accent-blue-600"
            />
            % of Utterances
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="displayMode"
              value="value"
              checked={displayMode === "value"}
              onChange={() => setDisplayMode("value")}
              className="mr-1 accent-blue-600"
            />
            Number of Utterances
          </label>
        </div>
      </div>

      {/* Area toggles (only for line view) */}
      {chartView === "line" && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <button
            onClick={handleSelectAll}
            className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-semibold text-xs hover:bg-blue-200"
            type="button"
          >
            Select All
          </button>
          <button
            onClick={handleClearAll}
            className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-semibold text-xs hover:bg-gray-200"
            type="button"
          >
            Clear All
          </button>
          {TEACHING_AREA_CODES.map((code, idx) => (
            <label
              key={code}
              className="flex items-center gap-1 text-xs font-bold cursor-pointer select-none"
              style={{ color: LINE_COLORS[idx % LINE_COLORS.length] }}
            >
              <input
                type="checkbox"
                checked={selectedAreas.includes(code)}
                onChange={() => handleAreaToggle(code)}
                className="accent-current"
              />
              {code.split(" ")[0]}
            </label>
          ))}
        </div>
      )}

      {/* Chart Container */}
      <div className="w-full h-[520px] bg-white border rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-full w-full text-gray-400">
            Loading chart...
          </div>
        ) : fileSummaries.length === 0 ? (
          <div className="flex items-center justify-center h-full w-full text-gray-400">
            No data found.
          </div>
        ) : chartView === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartDataLine}
              margin={{ top: 20, right: 120, left: 60, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="lesson"
                tick={{ fontSize: 12, fontWeight: 600, dy: 16 }}
                height={40}
                interval={0}
              />
              <YAxis tickFormatter={yTick} />
              <Tooltip formatter={tooltipFmt} />
              {TEACHING_AREA_CODES.filter((code) =>
                selectedAreas.includes(code)
              ).map((code, idx) => (
                <Line
                  key={code}
                  type="linear"
                  dataKey={code}
                  name={code.split(" ")[0]}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={3}
                  dot={{
                    r: 6,
                    stroke: LINE_COLORS[idx % LINE_COLORS.length],
                    strokeWidth: 2,
                    fill: "#fff",
                  }}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : chartView === "groupedBar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartDataGroupedBar}
              margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
              barCategoryGap={20}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 15, fontWeight: 600 }}
                height={40}
                interval={0}
                label={{
                  value: "Teaching Areas",
                  position: "insideBottom",
                  dy: 10,
                }}
              />
              <YAxis tickFormatter={yTick} />
              <Tooltip formatter={tooltipFmt} />
              <Legend verticalAlign="top" align="center" />
              {lessons.map((lesson, idx) => (
                <Bar
                  key={lesson}
                  dataKey={lesson}
                  name={lesson}
                  fill={LINE_COLORS[idx % LINE_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartDataTotal}
              margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
              barCategoryGap={20}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="code"
                tick={{ fontSize: 15, fontWeight: 600 }}
                height={40}
                interval={0}
                label={{
                  value: "Teaching Areas",
                  position: "insideBottom",
                  dy: 10,
                }}
              />
              <YAxis tickFormatter={yTick} />
              <Tooltip formatter={tooltipFmt} />
              <Bar
                dataKey={displayMode === "value" ? "value" : "percent"}
                fill={LINE_COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend block */}
      <div className="w-full mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {TEACHING_AREA_CODES.map((code, idx) => (
            <div key={code} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-4 h-4 rounded"
                style={{ background: LINE_COLORS[idx % LINE_COLORS.length] }}
              />
              <span>
                <strong>{code.split(" ")[0]}:</strong>{" "}
                {code.substring(code.indexOf(" ") + 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
