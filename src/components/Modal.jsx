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
  AreaChart,
  Area,
} from "recharts";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { useRef, useState, useEffect } from "react";
import { fetchChunksByFileIds } from "../lib/api";

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
  TEACHING_AREA_CODES.forEach((code) => {
    if (!stats[code]) stats[code] = { value: 0, percent: 0 };
  });
  return stats;
}

function statsToChartData(statsObj) {
  return TEACHING_AREA_CODES.map((code) => ({
    name: code,
    code: code.split(" ")[0],
    value: statsObj[code]?.value || 0,
    percent: statsObj[code]?.percent || 0,
  }));
}

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

// Helper: moving average over an array of numbers
function computeMovingAverage(values, windowSize) {
  const res = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((s, v) => s + (Number(v) || 0), 0) / slice.length;
    res.push(Number.isFinite(avg) ? avg : 0);
  }
  return res;
}

export default function Modal({ open, onClose, fileSummaries = [] }) {
  const groupedBarRef = useRef();
  const totalDistRef = useRef();
  const lineChartRef = useRef();
  const wpmChartRef = useRef();
  const areaDistributionRef = useRef();
  const [selectedAreas, setSelectedAreas] = useState(() => [...TEACHING_AREA_CODES]);
  const [displayMode, setDisplayMode] = useState('percent');
  // WPM chart state must be declared before any conditional return to preserve hook order
  const [wpmChartData, setWpmChartData] = useState([]);
  const [areaDistributionData, setAreaDistributionData] = useState([]);

  // Rebuild when summaries (and thus file_ids) change or when modal opens
  useEffect(() => {
    if (open) {
      buildWpmChartData();
      buildAreaDistributionData();
    }
  }, [open, fileSummaries]);
  if (!open) return null;

  const allStats = fileSummaries.map((f) =>
    parseTeachingAreaStats((f.data_summary || "").replace(/\n/g, "\n"))
  );
  const chartDatas = allStats.map(statsToChartData);
  const averageStats = getAverageStats(allStats);

  function stripXlsx(filename) {
    return filename.replace(/\.xlsx$/i, "");
  }

  function parseLessonLabel(filename) {
    if (!filename) return "Unknown";
    const cleanName = stripXlsx(filename);
    const match = cleanName.match(/^([^_]+)_Lesson(\d+)[_-](\d{2}-\d{2}-\d{4})/i);
    if (match) {
      const [, subject, lessonNum] = match;
      const subjectMap = {
        'Mathematics': 'Math',
        'English': 'Eng',
        'Science': 'Sci',
        'Social Studies': 'SS',
        'Geography': 'Geo',
        'History': 'Hist',
        'Chemistry': 'Chem'
      };
      const shortSubject = subjectMap[subject] || subject.substring(0, 4);
      return `${shortSubject}_L${lessonNum}`;
    }
    const lessonMatch = cleanName.match(/Lesson(\d+)/i);
    if (lessonMatch) {
      return `L${lessonMatch[1]}`;
    }
    return cleanName.substring(0, 8);
  }

  const lessonNames = fileSummaries.map((file, idx) => stripXlsx(file.stored_filename || `Lesson #${idx + 1}`));
  const groupedBarData = TEACHING_AREA_CODES.map((code) => {
    const entry = { code: code.split(" ")[0] };
    fileSummaries.forEach((file, idx) => {
      const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
      entry[lessonNames[idx]] = displayMode === 'percent' ? (stats[code]?.percent || 0) : (stats[code]?.value || 0);
    });
    return entry;
  });
  // Add single aggregated moving average trendline to groupedBarData
  const groupedBarAgg = groupedBarData.map((row) => {
    const values = lessonNames.map((ln) => Number(row[ln]) || 0);
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    return { ...row, __agg: avg };
  });
  const groupedBarTrend = computeMovingAverage(groupedBarAgg.map((r) => r.__agg), 3);
  const groupedBarDataWithTrend = groupedBarAgg.map((r, i) => ({ ...r, __trend: groupedBarTrend[i] }));

  const totalDistDataBase = TEACHING_AREA_CODES.map((code, idx) => {
    if (displayMode === 'value') {
      let total = 0;
      fileSummaries.forEach((file) => {
        const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
        total += stats[code]?.value || 0;
      });
      return { code: code.split(" ")[0], y: total };
    } else {
      const percents = fileSummaries.map((file) => {
        const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
        return stats[code]?.percent || 0;
      });
      const avg = percents.length ? percents.reduce((s, v) => s + v, 0) / percents.length : 0;
      return { code: code.split(" ")[0], y: avg };
    }
  });
  const totalDistTrend = computeMovingAverage(totalDistDataBase.map((d) => d.y), 3);
  const totalDistData = totalDistDataBase.map((d, i) => ({ ...d, __trend: totalDistTrend[i] }));

  const lineChartData = fileSummaries.map((file, idx) => {
    const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
    const entry = { lesson: parseLessonLabel(file.stored_filename || `Lesson #${idx + 1}`) };
    TEACHING_AREA_CODES.forEach((code) => {
      entry[code] = displayMode === 'percent' ? (stats[code]?.percent || 0) : (stats[code]?.value || 0);
    });
    const areaValues = TEACHING_AREA_CODES.map((code) => Number(entry[code]) || 0);
    entry.__agg = areaValues.length ? areaValues.reduce((s, v) => s + v, 0) / areaValues.length : 0;
    return entry;
  });
  const lineTrend = computeMovingAverage(lineChartData.map((d) => d.__agg), 1);
  const lineChartDataWithTrend = lineChartData.map((d, i) => ({ ...d, __trend: lineTrend[i] }));

  const wpmDataWithTrend = wpmChartData.map((row) => {
    const values = lessonNames.map((ln) => Number(row[ln]) || 0);
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    return { ...row, __agg: avg };
  });
  const wpmTrend = computeMovingAverage(wpmDataWithTrend.map((r) => r.__agg), 1);
  const wpmChartDataWithTrend = wpmDataWithTrend.map((r, i) => ({ ...r, __trend: wpmTrend[i] }));

  const AREA_CODES_ONLY = ["1.1","1.2","3.1","3.2","3.3","3.4","3.5","4.1"];
  const areaDistTrendVals = areaDistributionData.map((row) => {
    const vals = AREA_CODES_ONLY.map((code) => Number(row[code]) || 0);
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return avg;
  });
  const areaDistTrend = computeMovingAverage(areaDistTrendVals, 1);
  const areaDistributionDataWithTrend = areaDistributionData.map((row, i) => ({ ...row, __trend: areaDistTrend[i] }));

  async function buildWpmChartData() {
    const fileIds = (fileSummaries || []).map((f) => f.file_id).filter(Boolean);
    if (fileIds.length === 0) {
      setWpmChartData([]);
      return;
    }
    const chunks = await fetchChunksByFileIds(fileIds);
    if (chunks.length === 0) {
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
      const entry = { interval: seq * 5 };
      lessons.forEach(({ id, name }) => {
        const wpm = fileIdToSeqToWords.get(id)?.get(seq) ?? 0;
        entry[name] = wpm;
      });
      rows.push(entry);
    }
    setWpmChartData(rows);
  }

  async function buildAreaDistributionData() {
    const fileIds = (fileSummaries || []).map((f) => f.file_id).filter(Boolean);
    if (fileIds.length === 0) {
      setAreaDistributionData([]);
      return;
    }
    const chunks = await fetchChunksByFileIds(fileIds);
    if (chunks.length === 0) {
      console.warn("Area Distribution: no chunks found for file IDs", fileIds);
      setAreaDistributionData([]);
      return;
    }

    const teachingAreaLabels = {
      "1.1": "Establishing Interaction and rapport",
      "1.2": "Setting and Maintaining Rules and Routine",
      "3.1": "Activating prior knowledge",
      "3.2": "Motivating learners for learning engagement",
      "3.3": "Using Questions to deepen learning",
      "3.4": "Facilitating collaborative learning",
      "3.5": "Concluding the lesson",
      "4.1": "Checking for understanding and providing feedback"
    };

    // Group by file and find max sequence across all lessons
    const fileIdToSeqToAreas = new Map();
    let maxSeq = 0;
    chunks.forEach((chunk) => {
      const seq = Number(chunk.sequence_order) || 0;
      maxSeq = Math.max(maxSeq, seq);
      if (!fileIdToSeqToAreas.has(chunk.file_id)) {
        fileIdToSeqToAreas.set(chunk.file_id, new Map());
      }
      // Parse area_distribution JSON (may be object or string)
      let areaDistribution = {};
      if (chunk.area_distribution && typeof chunk.area_distribution === 'object') {
        areaDistribution = chunk.area_distribution;
      } else if (typeof chunk.area_distribution === 'string') {
        try {
          areaDistribution = JSON.parse(chunk.area_distribution);
        } catch (e) {
          console.warn("Failed to parse area_distribution for chunk:", chunk.chunk_id);
        }
      }
      fileIdToSeqToAreas.get(chunk.file_id).set(seq, areaDistribution);
    });

    // Build chart rows where x = 5-min interval endpoint (5, 10, ...)
    const rows = [];
    for (let seq = 1; seq <= maxSeq; seq += 1) {
      const entry = { interval: seq * 5 };

      // Aggregate all lessons for each teaching area
      Object.keys(teachingAreaLabels).forEach(areaCode => {
        let totalFrequency = 0;
        fileIdToSeqToAreas.forEach((seqMap, fileId) => {
          const areaDist = seqMap.get(seq) ?? {};
          totalFrequency += Number(areaDist[areaCode]) || 0;
        });
        entry[areaCode] = totalFrequency;
      });

      rows.push(entry);
    }
    setAreaDistributionData(rows);
  }

  function handleAreaToggle(area) {
    setSelectedAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area]
    );
  }

  async function handleDownloadPDF() {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const chartWidth = pageWidth - (2 * margin);
    const chartHeight = (pageHeight - (4 * margin)) / 3;

    doc.setFontSize(16);
    doc.text("Teaching Analytics Summary", margin, margin);
    let y = margin + 15;

    doc.setFontSize(14);
    doc.text("Teaching Area Distribution Across Lessons", margin, y);
    y += 8;
    if (groupedBarRef.current) {
      try {
        const dataUrl = await toPng(groupedBarRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", margin, y, chartWidth, chartHeight);
      } catch {
        doc.text("Chart unavailable", margin, y + 20);
      }
    }
    y += chartHeight + 10;

    doc.setFontSize(14);
    doc.text("Total Distribution", margin, y);
    y += 8;
    if (totalDistRef.current) {
      try {
        const dataUrl = await toPng(totalDistRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", margin, y, chartWidth, chartHeight);
      } catch {
        doc.text("Chart unavailable", margin, y + 20);
      }
    }
    y += chartHeight + 10;

    doc.setFontSize(14);
    doc.text("Utterances per Teaching Area Across Lessons", margin, y);
    y += 8;
    if (lineChartRef.current) {
      try {
        const dataUrl = await toPng(lineChartRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", margin, y, chartWidth, chartHeight);
      } catch {
        doc.text("Chart unavailable", margin, y + 20);
      }
    }

    doc.addPage();
    y = margin + 15;

    doc.setFontSize(14);
    doc.text("Lesson Timeline of Utterances", margin, y);
    y += 8;
    if (areaDistributionRef.current) {
      try {
        const dataUrl = await toPng(areaDistributionRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", margin, y, chartWidth, chartHeight);
      } catch {
        doc.text("Chart unavailable", margin, y + 20);
      }
    }
    y += chartHeight + 10;

    doc.setFontSize(14);
    doc.text("Average WPM Over Time", margin, y);
    y += 8;
    if (wpmChartRef.current) {
      try {
        const dataUrl = await toPng(wpmChartRef.current, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", margin, y, chartWidth, chartHeight);
      } catch {
        doc.text("Chart unavailable", margin, y + 20);
      }
    }

    doc.save("teaching_analytics_summary.pdf");
  }

  function getStatValue(stat, mode) {
    return mode === 'percent' ? (stat?.percent || 0) : (stat?.value || 0);
  }

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
        <div className="mb-12">
          <div ref={groupedBarRef} className="w-full bg-white rounded-lg mb-2 p-6">
            <h3 className="text-xl font-bold mb-4 text-center">
              Teaching Area Distribution Across Lessons
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupedBarDataWithTrend}
                  margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                  barCategoryGap={20}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 15, fontWeight: 600 }}
                    height={40}
                    interval={0}
                    label={{ value: "Teaching Areas", position: "insideBottom", dy: 10 }}
                  />
                  <YAxis
                    tickFormatter={yAxisTickFormatter}
                    label={{ value: displayMode === 'percent' ? "Percentage of Utterances (%)" : "Number of Utterances", angle: -90, position: "insideLeft", dy: 80 }}
                  />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend verticalAlign="top" align="center" />
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
        <div className="mb-12">
          <div ref={totalDistRef} className="w-full bg-white rounded-lg mb-2 p-6">
            <h3 className="text-xl font-bold mb-4 text-center">
              Total Distribution
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={totalDistData}
                  margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                  barCategoryGap={20}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="code" tick={{ fontSize: 15, fontWeight: 600 }} height={40} interval={0} label={{ value: "Teaching Areas", position: "insideBottom", dy: 10 }} />
                  <YAxis tickFormatter={yAxisTickFormatter} label={{ value: displayMode === 'percent' ? 'Percentage of Utterances (%)' : 'Number of Utterances', angle: -90, position: 'insideLeft', dy: 80 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="y" name={displayMode === 'value' ? 'Value' : 'Percent'} fill={LINE_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div ref={lineChartRef} className="w-full bg-white rounded-lg mb-2 p-6">
            <h3 className="text-xl font-bold mb-4 text-center">
              Utterances per Teaching Area Across Lessons
            </h3>
            <div className="h-[500px]">
              <div className="flex flex-row w-full h-full">
                <div className="flex flex-col justify-center items-start pl-4 min-w-[80px] border-r bg-gray-50">
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
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineChartDataWithTrend}
                      margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="lesson" tick={{ fontSize: 12, fontWeight: 600, dy: 16 }} angle={0} textAnchor="middle" height={60} interval={0} label={{ value: "Lessons", position: "insideBottom", dy: 25 }} />
                      <YAxis tickFormatter={yAxisTickFormatter} label={{ value: displayMode === 'percent' ? 'Percentage of Utterances (%)' : 'Number of Utterances', angle: -90, position: 'insideLeft', dy: 80 }} />
                      <Tooltip formatter={tooltipFormatter} />
                      {TEACHING_AREA_CODES.filter((code) => selectedAreas.includes(code)).map((code, idx) => (
                        <Line key={code} type="linear" dataKey={code} name={code.split(" ")[0]} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={3} dot={{ r: 6, stroke: LINE_COLORS[idx % LINE_COLORS.length], strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8 }} />
                      ))}
                      <Line type="linear" dataKey="__trend" name="Trend (SMA)" stroke="#111827" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div ref={areaDistributionRef} className="w-full bg-white rounded-lg mb-2 p-6">
            <h3 className="text-xl font-bold mb-4 text-center">
              Lesson Timeline of Utterances
            </h3>
            {areaDistributionData.length === 0 ? (
              <div className="flex items-center justify-center h-[500px] w-full text-gray-400">
                No area distribution data found.
              </div>
            ) : (
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={areaDistributionDataWithTrend}
                    margin={{ top: 20, right: 50, left: 20, bottom: 40 }}
                    barCategoryGap={11}
                    barGap={10}
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
                      label={{ value: "Frequency of Utterances", angle: -90, position: "insideLeft", dy: 80 }}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" align="center" />
                    {(() => {
                      const teachingAreaLabels = {
                        "1.1": "Establishing Interaction and rapport",
                        "1.2": "Setting and Maintaining Rules and Routine",
                        "3.1": "Activating prior knowledge",
                        "3.2": "Motivating learners for learning engagement",
                        "3.3": "Using Questions to deepen learning",
                        "3.4": "Facilitating collaborative learning",
                        "3.5": "Concluding the lesson",
                        "4.1": "Checking for understanding and providing feedback"
                      };
                      return Object.keys(teachingAreaLabels).map((areaCode, areaIdx) => (
                        <Bar key={areaCode} dataKey={areaCode} name={areaCode} fill={LINE_COLORS[areaIdx % LINE_COLORS.length]} radius={[4, 4, 0, 0]} />
                      ));
                    })()}
                    <Line type="linear" dataKey="__trend" name="Trend (SMA)" stroke="#111827" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="mb-12">
          <div ref={wpmChartRef} className="w-full bg-white rounded-lg mb-2 p-6">
            <h3 className="text-xl font-bold mb-4 text-center">
              Average WPM Over Time
            </h3>
            {wpmChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[500px] w-full text-gray-400">
                No chunk data found.
              </div>
            ) : (
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={wpmChartDataWithTrend}
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
                    {lessonNames.map((lesson, idx) => (
                      <Area key={lesson} type="monotone" dataKey={lesson} name={lesson} stroke={LINE_COLORS[idx % LINE_COLORS.length]} fill={LINE_COLORS[idx % LINE_COLORS.length]} fillOpacity={0.15} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} stackId="1" />
                    ))}
                    <Line type="linear" dataKey="__trend" name="Trend (SMA)" stroke="#111827" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
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
