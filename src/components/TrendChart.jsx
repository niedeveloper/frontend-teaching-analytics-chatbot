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
  AreaChart,
  Area,
} from "recharts";

import {
  TEACHING_AREA_CODES,
  LINE_COLORS,
  parseTeachingAreaStats,
  parseLessonLabel,
  stripXlsx,
} from "../lib/teachingConfig";

function getStatValue(stat, mode) {
  return mode === "percent" ? stat?.percent || 0 : stat?.value || 0;
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

export default function TrendChart({ lessonFilter = [] }) {
  const { user } = useUser();
  const [fileSummaries, setFileSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState("percent"); // percent | value
  const [selectedAreas, setSelectedAreas] = useState([...TEACHING_AREA_CODES]);
  const [chartView, setChartView] = useState("line"); // line | groupedBar | total | wpm
  const [lessonFilterState, setLessonFilter] = useState(lessonFilter);
  const [wpmChartData, setWpmChartData] = useState([]);

  const fetchWpmChartData = async (fileSummaries) => {
    try {
      const fileIds = fileSummaries.map((f) => f.file_id).filter(Boolean);
      if (fileIds.length === 0) {
        setWpmChartData([]);
        return;
      }

      const { data: chunks, error: chunksError } = await supabase
        .from("chunks")
        .select("*")
        .in("file_id", fileIds)
        .order("sequence_order", { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        console.warn("WPM: no chunks found for file IDs", fileIds);
        setWpmChartData([]);
        return;
      }

      // Group by file and find max sequence across all lessons
      const fileIdToSeqToWords = new Map();
      let maxSeq = 0;
      chunks.forEach((chunk) => {
        const seq = Number(chunk.sequence_order) || 0;
        maxSeq = Math.max(maxSeq, seq);
        if (!fileIdToSeqToWords.has(chunk.file_id)) {
          fileIdToSeqToWords.set(chunk.file_id, new Map());
        }
        const words = Number(chunk.word_count) || 0;
        const durationSeconds = Number(chunk.duration_seconds) || 300;
        const minutes = durationSeconds > 0 ? durationSeconds / 60 : 5;
        const wpm = Math.round(words / minutes);
        fileIdToSeqToWords.get(chunk.file_id).set(seq, wpm);
      });

      // Build chart rows where x = 5-min interval endpoint (5, 10, ...)
      const lessons = fileSummaries.map((f, idx) => ({
        id: f.file_id,
        name: stripXlsx(f.stored_filename || `Lesson #${idx + 1}`),
      }));

      const rows = [];
      for (let seq = 1; seq <= maxSeq; seq += 1) {
        const entry = { interval: seq * 5 }; // minutes (nominal)
        lessons.forEach(({ id, name }) => {
          const wpm = fileIdToSeqToWords.get(id)?.get(seq) ?? 0;
          entry[name] = wpm;
        });
        rows.push(entry);
      }
      setWpmChartData(rows);
    } catch (error) {
      console.error("Error fetching WPM chart data:", error);
      setWpmChartData([]);
    }
  };
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
        return !isAudioFile;
      });

      setFileSummaries(filteredFiles);
      
      if (filteredFiles.length > 0) {
        await fetchWpmChartData(filteredFiles);
      }
      
      setLoading(false);
    }
    fetchFileSummaries();
  }, [user]);

  const lessons = useMemo(
    () =>
      fileSummaries.map((f, idx) => ({
        shortLabel: parseLessonLabel(f.stored_filename || `Lesson #${idx + 1}`),
        fullName: stripXlsx(f.stored_filename || `Lesson #${idx + 1}`)
      })),
    [fileSummaries]
  );

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
      const fullLessonName = stripXlsx(file.stored_filename || `Lesson #${idx + 1}`);
      const entry = {
        lesson: parseLessonLabel(file.stored_filename || `Lesson #${idx + 1}`), // Short label for x-axis
        fullLessonName: fullLessonName, // Keep full name for tooltips
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
        const shortLabel = parseLessonLabel(file.stored_filename || `Lesson #${idx + 1}`);
        row[shortLabel] = getStatValue(stats[code], displayMode);
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

  const chartDataWpm = useMemo(() => {
    if (wpmChartData.length === 0) return [];
    
    // Apply lesson filter to WPM data
    const filteredLessons = lessonFilterState.length === 0 
      ? filteredFileSummaries 
      : filteredFileSummaries.filter(file => 
          lessonFilterState.includes(stripXlsx(file.stored_filename))
        );
    
    const filteredLessonNames = filteredLessons.map(file => stripXlsx(file.stored_filename || ''));
    
    // Filter WPM data to only include selected lessons
    return wpmChartData.map(row => {
      const filteredRow = { interval: row.interval };
      filteredLessonNames.forEach(lessonName => {
        if (row.hasOwnProperty(lessonName)) {
          filteredRow[lessonName] = row[lessonName];
        }
      });
      return filteredRow;
    });
  }, [wpmChartData, lessonFilterState, filteredFileSummaries]);

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
    const { value, checked } = e.target;
    setLessonFilter((prev) =>
      checked ? [...prev, value] : prev.filter((lesson) => lesson !== value)
    );
  }

  const yTick = (val) => (displayMode === "percent" ? `${val}%` : val);
  const tooltipFmt = (val) => (displayMode === "percent" ? `${val}%` : val);
  
  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Find the full lesson name from the data
      const dataPoint = chartDataLine.find(item => item.lesson === label);
      const fullLessonName = dataPoint?.fullLessonName || label;
      
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{fullLessonName}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${tooltipFmt(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <section className="rounded-2xl shadow-lg bg-white/90 dark:bg-gray-800/90 border border-blue-100 dark:border-blue-900/40 px-2 md:px-6 py-6 flex flex-col items-center">
      <h2 className="text-indigo-700 dark:text-indigo-400 font-semibold mb-2 text-lg md:text-xl">
        Teaching Area Trends
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <label className="text-xs text-gray-600 dark:text-gray-400">Filter Lessons: </label>
        <div className="flex flex-wrap gap-2">
          {lessons.map((lesson, idx) => (
            <label key={idx} className="flex items-center gap-1 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                value={lesson.fullName}
                checked={lessonFilterState.includes(lesson.fullName)}
                onChange={handleLessonFilterChange}
                className="accent-blue-600"
              />
              <span title={lesson.fullName}>{lesson.shortLabel}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
        <div className="inline-flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shadow">
          {[
            { key: "line", label: "Line (by Area across Lessons)" },
            { key: "groupedBar", label: "Grouped Bar (Areas × Lessons)" },
            { key: "total", label: "Total Distribution" },
            { key: "wpm", label: "WPM Over Time" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setChartView(opt.key)}
              className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                chartView === opt.key
                  ? "bg-white dark:bg-gray-600 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chartView !== "wpm" && (
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded shadow text-base">
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
      )}

      {chartView === "line" && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <button
            onClick={handleSelectAll}
            className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-200 dark:hover:bg-blue-800/60"
            type="button"
          >
            Select All
          </button>
          <button
            onClick={handleClearAll}
            className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-xs hover:bg-gray-200 dark:hover:bg-gray-500"
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

      <div className="w-full h-[520px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center h-full w-full text-gray-400 dark:text-gray-500">
            Loading chart...
          </div>
        ) : fileSummaries.length === 0 ? (
          <div className="flex items-center justify-center h-full w-full text-gray-400 dark:text-gray-500">
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
              <Tooltip content={customTooltip} />
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
              {filteredFileSummaries.map((file, idx) => {
                const shortLabel = parseLessonLabel(file.stored_filename || `Lesson #${idx + 1}`);
                const fullName = stripXlsx(file.stored_filename || `Lesson #${idx + 1}`);
                return (
                  <Bar
                    key={shortLabel}
                    dataKey={shortLabel}
                    name={fullName} // Use full name for legend
                    fill={LINE_COLORS[idx % LINE_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        ) : chartView === "wpm" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartDataWpm}
              margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="interval"
                tick={{ fontSize: 12, fontWeight: 600, dy: 16 }}
                height={60}
                interval={0}
                label={{ value: "5-Min Interval (min)", position: "insideBottom", dy: 25 }}
              />
              <YAxis 
                tickFormatter={(val) => `${val}`}
                label={{ value: "Average Words Per Minute", angle: -90, position: "insideLeft", dy: 80 }}
              />
              <Tooltip />
              <Legend verticalAlign="top" align="center" />
              {chartDataWpm.length > 0 && Object.keys(chartDataWpm[0]).filter(key => key !== 'interval').map((lesson, idx) => (
                <Area 
                  key={lesson} 
                  type="monotone" 
                  dataKey={lesson} 
                  name={lesson} 
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]} 
                  fill={LINE_COLORS[idx % LINE_COLORS.length]} 
                  fillOpacity={0.15} 
                  strokeWidth={3} 
                  dot={{ r: 3 }} 
                  activeDot={{ r: 5 }} 
                  stackId="1" 
                />
              ))}
            </AreaChart>
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

      {chartView !== "wpm" && (
        <div className="w-full mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {TEACHING_AREA_CODES.map((code, idx) => (
              <div key={code} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
      )}
    </section>
  );
}
