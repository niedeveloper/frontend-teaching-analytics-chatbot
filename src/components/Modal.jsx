import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { useRef, useState } from "react";

// Teaching area codes in order (expandable)
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

// Define a color palette for lines
const LINE_COLORS = [
  "#22c55e", // green
  "#2563eb", // blue
  "#f59e42", // orange
  "#e11d48", // red
  "#a21caf", // purple
  "#0ea5e9", // sky
  "#facc15", // yellow
  "#64748b", // slate
];

// Parse one file's teaching area stats
function parseTeachingAreaStats(summary) {
  const lines = summary.split("\n");
  const stats = {};
  let inStats = false;
  for (const line of lines) {
    if (line.startsWith("TEACHING AREA STATISTICS:")) {
      inStats = true;
      continue;
    }
    if (inStats) {
      if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) break;
      // matches: code: 165 utterances (22.4%) - 43 questions
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
  // Fill missing areas as 0 for uniformity
  TEACHING_AREA_CODES.forEach((code) => {
    if (!stats[code]) stats[code] = { value: 0, percent: 0 };
  });
  return stats;
}

// Convert stats to recharts bar data format
function statsToChartData(statsObj) {
  return TEACHING_AREA_CODES.map((code) => ({
    name: code,
    code: code.split(" ")[0],
    value: statsObj[code]?.value || 0,
    percent: statsObj[code]?.percent || 0,
  }));
}

// Calculate average % per area across all files
function getAverageStats(allStats) {
  const avg = TEACHING_AREA_CODES.map((code) => {
    const total = allStats.reduce(
      (sum, stats) => sum + (stats[code]?.percent || 0),
      0
    );
    return {
      name: code,
      percent: allStats.length ? (total / allStats.length).toFixed(1) : 0,
    };
  });
  return avg;
}

export default function Modal({ open, onClose, fileSummaries = [] }) {
  // All hooks must be called before any return
  // Refs for visible charts
  const groupedBarRef = useRef();
  const totalDistRef = useRef();
  const lineChartRef = useRef();
  const [selectedAreas, setSelectedAreas] = useState(() => [...TEACHING_AREA_CODES]);
  const [displayMode, setDisplayMode] = useState('percent');
  if (!open) return null;

  // Parse all summaries to aligned stats objects
  const allStats = fileSummaries.map((f) =>
    parseTeachingAreaStats((f.data_summary || "").replace(/\\n/g, "\n"))
  );
  const chartDatas = allStats.map(statsToChartData);
  const averageStats = getAverageStats(allStats);

  // Prepare data for grouped bar chart
  // Helper to strip .xlsx from lesson names
  function stripXlsx(filename) {
    return filename.replace(/\.xlsx$/i, "");
  }
  const lessonNames = fileSummaries.map((file, idx) => stripXlsx(file.stored_filename || `Lesson #${idx + 1}`));
  const groupedBarData = TEACHING_AREA_CODES.map((code) => {
    const entry = { code: code.split(" ")[0] };
    fileSummaries.forEach((file, idx) => {
      const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
      entry[lessonNames[idx]] = getStatValue(stats[code], displayMode);
    });
    return entry;
  });

  function handleAreaToggle(area) {
    setSelectedAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area]
    );
  }

  async function handleDownloadPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Teaching Analytics Summary", 10, 12);
    let y = 22;

    // Grouped Bar Chart (Teaching Area Distribution Across Lessons)
    doc.setFontSize(14);
    doc.text("Utterances per Teaching Area Across Lessons", 10, y);
    y += 6;
    if (groupedBarRef.current) {
      try {
        const dataUrl = await toPng(groupedBarRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", 10, y, 180, 60);
      } catch {
        doc.text("Chart unavailable", 10, y + 20);
      }
    }
    y += 65;

    // Total Distribution Bar Chart
    doc.setFontSize(14);
    doc.text("Total Distribution", 10, y);
    y += 6;
    if (totalDistRef.current) {
      try {
        const dataUrl = await toPng(totalDistRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", 10, y, 180, 60);
      } catch {
        doc.text("Chart unavailable", 10, y + 20);
      }
    }
    y += 65;

    // Line Chart (% of Utterances per Teaching Area Across Lessons)
    doc.setFontSize(14);
    doc.text("Utterances per Teaching Area Across Lessons (Line)", 10, y);
    y += 6;
    if (lineChartRef.current) {
      try {
        const dataUrl = await toPng(lineChartRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", 10, y, 180, 60);
      } catch {
        doc.text("Chart unavailable", 10, y + 20);
      }
    }
    y += 65;

    // Add legend for line chart (selected areas)
    doc.setFontSize(12);
    doc.text("Legend (Line Chart):", 10, y);
    y += 6;
    TEACHING_AREA_CODES.filter((code) => selectedAreas.includes(code)).forEach((code, idx) => {
      doc.setTextColor(0, 0, 0);
      doc.text(`${code.split(" ")[0]}`, 15, y);
      y += 6;
    });

    doc.save("teaching_analytics_summary.pdf");
  }

  // Helper to get the correct value for charts
  function getStatValue(stat, mode) {
    return mode === 'percent' ? (stat?.percent || 0) : (stat?.value || 0);
  }

  // Helper for Y-axis label
  const yAxisTickFormatter = (val) => displayMode === 'percent' ? `${val}%` : val;
  const tooltipFormatter = (val) => displayMode === 'percent' ? `${val}%` : val;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/40 px-2 py-4">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-8 max-w-6xl w-full relative mx-auto overflow-y-auto max-h-[95vh]">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-blue-600 text-2xl"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center">
          Teaching Analytics Summary
        </h2>
        {/* Toggle for percent/utterances */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-4 bg-gray-100 px-4 py-2 rounded shadow text-base">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="displayMode"
                value="percent"
                checked={displayMode === 'percent'}
                onChange={() => setDisplayMode('percent')}
                className="mr-1 accent-blue-600"
              />
              % of Utterances
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="displayMode"
                value="value"
                checked={displayMode === 'value'}
                onChange={() => setDisplayMode('value')}
                className="mr-1 accent-blue-600"
              />
              Number of Utterances
            </label>
          </div>
        </div>
        <p className="mb-4 text-gray-700 text-center">
          Below are teaching area distributions for all selected lectures, plus
          an overall average.
        </p>
        {/* Grouped Bar Chart for Teaching Area Distribution */}
        <div className="mb-8">
          <div ref={groupedBarRef} className="w-full h-[400px] bg-white border rounded-lg mb-2">
            <h3 className="text-xl font-bold mb-2 text-center">
              Teaching Area Distribution Across Lessons
            </h3>
            <div className="w-full h-[400px] bg-white border rounded-lg">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedBarData}
                  margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                  barCategoryGap={20}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="code" tick={{ fontSize: 15, fontWeight: 600 }} height={40} interval={0} />
                  <YAxis tickFormatter={yAxisTickFormatter} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  {lessonNames.map((lesson, idx) => (
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
            </div>
          </div>
        </div>
        {/* Total Distribution Bar Chart */}
        <div className="mb-8">
          <div ref={totalDistRef} className="w-full h-[400px] bg-white border rounded-lg mb-2">
            <h3 className="text-xl font-bold mb-2 text-center">
              Total Distribution
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={TEACHING_AREA_CODES.map((code, idx) => {
                  if (displayMode === 'value') {
                    // Sum utterances for each area across all lessons
                    let total = 0;
                    fileSummaries.forEach((file) => {
                      const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
                      total += stats[code]?.value || 0;
                    });
                    return { code: code.split(" ")[0], value: total };
                  } else {
                    // Use average percent as before
                    return {
                      code: code.split(" ")[0],
                      percent: averageStats[idx]?.percent || 0,
                    };
                  }
                })}
                margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                barCategoryGap={20}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="code" tick={{ fontSize: 15, fontWeight: 600 }} height={40} interval={0} />
                <YAxis tickFormatter={yAxisTickFormatter} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey={displayMode === 'value' ? 'value' : 'percent'} fill={LINE_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lesson-wise Utterance Line Chart */}
        <div className="mb-8">
          <div ref={lineChartRef} className="w-full h-[500px] bg-white border rounded-lg mb-2">
            <h3 className="text-xl font-bold mb-2 text-center">
              Utterances per Teaching Area Across Lessons
            </h3>
            <div className="flex flex-row w-full h-[500px] bg-white border rounded-lg">
              {/* Checkbox legend */}
              <div className="flex flex-col justify-center items-start pl-4 min-w-[80px] border-r bg-gray-50">
                {/* Select All/Unselect All Checkbox */}
                <label className="flex items-center cursor-pointer select-none text-base font-bold mb-4">
                  <input
                    type="checkbox"
                    checked={selectedAreas.length === TEACHING_AREA_CODES.length}
                    ref={el => {
                      if (el) el.indeterminate = selectedAreas.length > 0 && selectedAreas.length < TEACHING_AREA_CODES.length;
                    }}
                    onChange={e => {
                      if (selectedAreas.length === TEACHING_AREA_CODES.length) {
                        setSelectedAreas([]);
                      } else {
                        setSelectedAreas([...TEACHING_AREA_CODES]);
                      }
                    }}
                    className="mr-2 accent-blue-600"
                  />
                  All
                </label>
                {TEACHING_AREA_CODES.map((code, idx) => (
                  <label key={code} className="flex items-center mb-2 cursor-pointer select-none text-base font-bold" style={{ color: LINE_COLORS[idx % LINE_COLORS.length] }}>
                    <input
                      type="checkbox"
                      checked={selectedAreas.includes(code)}
                      onChange={() => handleAreaToggle(code)}
                      className="mr-2 accent-current"
                    />
                    {code.split(" ")[0]}
                  </label>
                ))}
              </div>
              {/* Chart */}
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={fileSummaries.map((file, idx) => {
                      const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
                      const entry = { lesson: stripXlsx(file.stored_filename || `Lesson #${idx + 1}`) };
                      TEACHING_AREA_CODES.forEach((code) => {
                        entry[code] = getStatValue(stats[code], displayMode);
                      });
                      return entry;
                    })}
                    margin={{ top: 20, right: 120, left: 60, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="lesson" tick={{ fontSize: 12, fontWeight: 600, dy: 16 }} angle={0} textAnchor="middle" height={60} interval={0} />
                    <YAxis tickFormatter={yAxisTickFormatter} />
                    <Tooltip formatter={tooltipFormatter} />
                    {/* No Legend here, since we have our own */}
                    {TEACHING_AREA_CODES.filter((code) => selectedAreas.includes(code)).map((code, idx) => (
                      <Line
                        key={code}
                        type="linear"
                        dataKey={code}
                        name={code.split(" ")[0]}
                        stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                        strokeWidth={3}
                        dot={{ r: 6, stroke: LINE_COLORS[idx % LINE_COLORS.length], strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 8 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        {/* Download PDF */}
        <div className="flex justify-center">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 font-semibold"
            onClick={handleDownloadPDF}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
