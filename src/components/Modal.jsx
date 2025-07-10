import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

const summaryData = [
  { name: 'Lecture', value: 40 },
  { name: 'Discussion', value: 25 },
  { name: 'Q&A', value: 15 },
  { name: 'Group Work', value: 10 },
  { name: 'Other', value: 10 },
];

export default function Modal({ open, onClose }) {
  const chartRef = useRef(null);

  async function handleDownloadPDF() {
    const doc = new jsPDF();
    doc.text('Teaching Analytics Summary', 10, 10);

    if (chartRef.current) {
      try {
        // Render the chart wrapper (including the SVG) to PNG
        const dataUrl = await toPng(chartRef.current, {
          cacheBust: true,
          backgroundColor: 'white',    // ensure a white bg
          // width/height options if you need to scale
        });
        doc.addImage(dataUrl, 'PNG', 10, 20, 180, 60);
      } catch (err) {
        console.error('Capture failed:', err);
        doc.text('⚠️ Could not capture chart image', 10, 30);
      }
    }

    // Summary text
    doc.text('Lecture: 40%', 10, 90);
    doc.text('Discussion: 25%', 10, 100);
    doc.text('Q&A: 15%', 10, 110);
    doc.text('Group Work: 10%', 10, 120);
    doc.text('Other: 10%', 10, 130);

    doc.save('summary.pdf');
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-white/30">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative">
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
            className="w-full h-64 mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,1)' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mb-4 text-gray-700">
            <li>• <b>Lecture:</b> 40%</li>
            <li>• <b>Discussion:</b> 25%</li>
            <li>• <b>Q&A:</b> 15%</li>
            <li>• <b>Group Work:</b> 10%</li>
            <li>• <b>Other:</b> 10%</li>
          </ul>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
            onClick={handleDownloadPDF}
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
