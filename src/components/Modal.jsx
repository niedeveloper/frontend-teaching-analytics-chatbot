import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { useRef } from "react";

// Teaching area codes in order (expandable)
const TEACHING_AREA_CODES = [
  "1.2 Setting and Maintaining Rules and Routine",
  "4.1 Checking for understanding and providing feedback",
  "3.2 Motivating learners for learning engagement",
  "1.1 Establishing Interaction and rapport",
  "3.3 Using Questions to deepen learning",
  "3.1 Activating prior knowledge",
  "3.4 Facilitating collaborative learning",
  "3.5 Concluding the lesson",
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
  const chartRefs = useRef([]);
  if (!open) return null;

  // Parse all summaries to aligned stats objects
  const allStats = fileSummaries.map((f) =>
    parseTeachingAreaStats((f.data_summary || "").replace(/\\n/g, "\n"))
  );
  const chartDatas = allStats.map(statsToChartData);
  const averageStats = getAverageStats(allStats);

  async function handleDownloadPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Teaching Analytics Summary", 10, 12);

    let y = 22;
    for (let i = 0; i < fileSummaries.length; i++) {
      const file = fileSummaries[i];
      doc.setFontSize(12);
      doc.text(
        `File: ${file.stored_filename || file.file_id || `#${i + 1}`}`,
        10,
        y
      );
      y += 6;

      // Chart image for each file
      const chartNode = chartRefs.current[i];
      if (chartNode) {
        try {
          const dataUrl = await toPng(chartNode, {
            backgroundColor: "white",
            cacheBust: true,
          });
          doc.addImage(dataUrl, "PNG", 10, y, 180, 45);
        } catch {
          doc.text("Chart unavailable", 10, y + 20);
        }
      }
      y += 50;

      // Stats for each file
      TEACHING_AREA_CODES.forEach((code) => {
        doc.text(`${code}: ${allStats[i][code]?.percent || 0}%`, 10, y);
        y += 6;
      });
      y += 8;
      if (y > 240 && i !== fileSummaries.length - 1) {
        doc.addPage();
        y = 20;
      }
    }

    // Average chart last
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Average Distribution", 10, 15);

    const avgChartNode = chartRefs.current[fileSummaries.length];
    if (avgChartNode) {
      try {
        const dataUrl = await toPng(avgChartNode, {
          backgroundColor: "white",
          cacheBust: true,
        });
        doc.addImage(dataUrl, "PNG", 10, 20, 180, 45);
      } catch {
        doc.text("Chart unavailable", 10, 30);
      }
    }

    // Average stats
    let y2 = 75;
    averageStats.forEach((area) =>
      doc.text(`${area.name}: ${area.percent}%`, 10, (y2 += 6))
    );

    doc.save("teaching_analytics_summary.pdf");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/40 px-2 py-4">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-8 max-w-4xl w-full relative mx-auto overflow-y-auto max-h-[95vh]">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-blue-600 text-2xl"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center">
          Teaching Analytics Summary
        </h2>
        <p className="mb-4 text-gray-700 text-center">
          Below are teaching area distributions for all selected lectures, plus
          an overall average.
        </p>
        {/* Multiple charts, horizontal scroll if too many */}
        <div className="flex gap-8 overflow-x-auto mb-8">
          {chartDatas.map((data, idx) => (
            <div
              key={idx}
              className="min-w-[350px] max-w-[400px] flex-shrink-0 border p-2 rounded-lg bg-gray-50"
            >
              <div
                ref={(el) => (chartRefs.current[idx] = el)}
                className="w-full h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip formatter={(val) => `${val}%`} />
                    <Bar dataKey="percent" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-sm text-gray-600 font-semibold mt-2 text-center">
                {fileSummaries[idx]?.stored_filename || `File #${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
        {/* Average Chart */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-2 text-center">
            Average Distribution
          </h3>
          <div
            ref={(el) => (chartRefs.current[fileSummaries.length] = el)}
            className="w-full h-56 bg-white border rounded-lg"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={averageStats}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip formatter={(val) => `${val}%`} />
                <Bar dataKey="percent" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
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
