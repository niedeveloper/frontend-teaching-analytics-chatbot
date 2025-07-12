import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

// Function to parse teaching area stats from summary
function parseTeachingAreaStats(summary) {
  const lines = summary.split('\n');
  const stats = [];
  let inStatsSection = false;
  for (const line of lines) {
    if (line.startsWith('TEACHING AREA STATISTICS:')) {
      inStatsSection = true;
      continue;
    }
    if (inStatsSection) {
      if (line.trim() === '' || line.startsWith('QUESTION ANALYSIS:')) break;
      const match = line.match(/^([\d.]+ [^:]+): (\d+) utterances \((\d+\.?\d*)%\)/);
      if (match) {
        stats.push({
          name: match[1],
          value: parseInt(match[2], 10),
          percent: parseFloat(match[3])
        });
      }
    }
  }
  return stats;
}

export default function Modal({ open, onClose, fileSummaries = [] }) {
  const chartRef = useRef(null);
  const summaryRaw = fileSummaries[0]?.data_summary || '';
  const summary = summaryRaw.replace(/\\n/g, '\n');
  const teachingAreaStats = parseTeachingAreaStats(summary);

  async function handleDownloadPDF() {
    const doc = new jsPDF();
    doc.text('Teaching Analytics Summary', 10, 10);
    doc.save('summary.pdf');
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/30 px-2 py-4 sm:px-0">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-lg w-full relative mx-auto overflow-y-auto max-h-[90vh]">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-blue-600"
          onClick={onClose}
        >
          ×
        </button>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Teaching Analytics Summary</h2>
          <p className="mb-4 text-gray-700">
            This is a summary of your selected lectures. The chart below shows the distribution of teaching styles.
          </p>

          {/* Chart container: no Tailwind bg-classes here */}
          <div
            ref={chartRef}
            className="w-full h-48 sm:h-64 mb-4 border border-dashed border-gray-200 rounded bg-white flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,1)' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teachingAreaStats} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => `${value} utterances`} />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mb-4 text-gray-700 text-sm sm:text-base">
            <li>• <b>1.2 Setting and Maintaining Rules and Routine:</b> {teachingAreaStats.find(area => area.name.includes('1.2'))?.percent || 0}%</li>
            <li>• <b>4.1 Checking for understanding and providing feedback:</b> {teachingAreaStats.find(area => area.name.includes('4.1'))?.percent || 0}%</li>
            <li>• <b>3.2 Motivating learners for learning engagement:</b> {teachingAreaStats.find(area => area.name.includes('3.2'))?.percent || 0}%</li>
            <li>• <b>1.1 Establishing Interaction and rapport:</b> {teachingAreaStats.find(area => area.name.includes('1.1'))?.percent || 0}%</li>
            <li>• <b>3.3 Using Questions to deepen learning:</b> {teachingAreaStats.find(area => area.name.includes('3.3'))?.percent || 0}%</li>
            <li>• <b>3.1 Activating prior knowledge:</b> {teachingAreaStats.find(area => area.name.includes('3.1'))?.percent || 0}%</li>
            <li>• <b>3.4 Facilitating collaborative learning:</b> {teachingAreaStats.find(area => area.name.includes('3.4'))?.percent || 0}%</li>
            <li>• <b>3.5 Concluding the lesson:</b> {teachingAreaStats.find(area => area.name.includes('3.5'))?.percent || 0}%</li>
          </ul>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 w-full sm:w-auto"
            onClick={async () => {
              const doc = new jsPDF();
              doc.text('Teaching Analytics Summary', 10, 10);
              // Chart image
              if (chartRef.current) {
                try {
                  const dataUrl = await toPng(chartRef.current, {
                    cacheBust: true,
                    backgroundColor: 'white',
                  });
                  doc.addImage(dataUrl, 'PNG', 10, 20, 180, 60);
                } catch (err) {
                  console.error('Capture failed:', err);
                  doc.text('⚠️ Could not capture chart image', 10, 30);
                }
              }
              // Summary list
              let y = 90;
              const lines = [
                `1.2 Setting and Maintaining Rules and Routine: ${teachingAreaStats.find(area => area.name.includes('1.2'))?.percent || 0}%`,
                `4.1 Checking for understanding and providing feedback: ${teachingAreaStats.find(area => area.name.includes('4.1'))?.percent || 0}%`,
                `3.2 Motivating learners for learning engagement: ${teachingAreaStats.find(area => area.name.includes('3.2'))?.percent || 0}%`,
                `1.1 Establishing Interaction and rapport: ${teachingAreaStats.find(area => area.name.includes('1.1'))?.percent || 0}%`,
                `3.3 Using Questions to deepen learning: ${teachingAreaStats.find(area => area.name.includes('3.3'))?.percent || 0}%`,
                `3.1 Activating prior knowledge: ${teachingAreaStats.find(area => area.name.includes('3.1'))?.percent || 0}%`,
                `3.4 Facilitating collaborative learning: ${teachingAreaStats.find(area => area.name.includes('3.4'))?.percent || 0}%`,
                `3.5 Concluding the lesson: ${teachingAreaStats.find(area => area.name.includes('3.5'))?.percent || 0}%`,
              ];
              lines.forEach(line => {
                doc.text(line, 10, y);
                y += 10;
              });
              doc.save('summary.pdf');
            }}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
