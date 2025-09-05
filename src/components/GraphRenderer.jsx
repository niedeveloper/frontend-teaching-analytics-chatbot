import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchChunksByFileIds } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { toPng } from "html-to-image";
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

// Teaching area codes in order (matching Modal.jsx)
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

// Color palette for charts (matching Modal.jsx)
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

// Helper: moving average over an array of numbers (from Modal.jsx)
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

// Helper to strip .xlsx from lesson names (from Modal.jsx)
function stripXlsx(filename) {
  return filename.replace(/\.xlsx$/i, "");
}

function GraphRenderer({ graphType, fileIds, messageId, lessonFilter = [], areaFilter = [] }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileSummaries, setFileSummaries] = useState([]);
  
  // Debug logging for filter validation (helpful for troubleshooting chat history)
  useEffect(() => {
    console.log(`DEBUG: GraphRenderer initialized - Type: ${graphType}, MessageId: ${messageId}`);
    console.log(`DEBUG: Filter validation - Lesson: ${Array.isArray(lessonFilter)} (${lessonFilter?.length || 0} items), Area: ${Array.isArray(areaFilter)} (${areaFilter?.length || 0} items)`);
    if (!Array.isArray(lessonFilter) || !Array.isArray(areaFilter)) {
      console.warn(`WARNING: GraphRenderer received invalid filter props - lessonFilter: ${typeof lessonFilter}, areaFilter: ${typeof areaFilter}`);
    }
  }, [graphType, messageId, lessonFilter, areaFilter]);
  
  // Refs for each chart type
  const teachingAreaDistRef = useRef();
  const totalDistRef = useRef();
  const utteranceTimelineRef = useRef();
  const wpmChartRef = useRef();
  const areaDistributionRef = useRef();
  
  // Ref to prevent duplicate calls
  const isFetchingRef = useRef(false);
  
  // Memoize and validate filter arrays to prevent unnecessary re-renders
  const memoizedLessonFilter = useMemo(() => {
    const validFilter = Array.isArray(lessonFilter) ? lessonFilter : [];
    if (validFilter.length > 0) {
      console.log(`DEBUG: GraphRenderer ${graphType} - Lesson filter applied:`, validFilter);
    }
    return validFilter;
  }, [lessonFilter, graphType]);
  
  const memoizedAreaFilter = useMemo(() => {
    const validFilter = Array.isArray(areaFilter) ? areaFilter : [];
    if (validFilter.length > 0) {
      console.log(`DEBUG: GraphRenderer ${graphType} - Area filter applied:`, validFilter);
    }
    return validFilter;
  }, [areaFilter, graphType]);

  useEffect(() => {
    if (graphType && fileIds && !isFetchingRef.current) {
      fetchFileSummaries();
    }
    
    // Cleanup function
    return () => {
      isFetchingRef.current = false;
    };
  }, [graphType, fileIds, memoizedLessonFilter, memoizedAreaFilter]);

  const fetchFileSummaries = async () => {
    // Prevent duplicate calls
    if (isFetchingRef.current) {
      return;
    }
    
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);
      
      // Determine which file IDs to use based on lesson filter
      const effectiveFileIds = memoizedLessonFilter.length > 0 ? memoizedLessonFilter : fileIds;
      
      // Fetch file summaries to get file names and other metadata
      const { data, error } = await supabase
        .from("files")
        .select("file_id, stored_filename, data_summary, lesson_date, lesson_number")
        .in("file_id", effectiveFileIds);
      
      if (error) {
        throw error;
      }
      
      // Filter out audio files (.mp3, .mp4, .wav, .m4a) - only include transcript files
      const filteredFiles = (data || []).filter(file => {
        const filename = file.stored_filename || '';
        const isAudioFile = /\.(mp3|mp4|wav|m4a)$/i.test(filename);
        return !isAudioFile; // Exclude audio files
      });

      // Sort files by lesson_date and lesson_number for consistent ordering
      const sortedFiles = filteredFiles.sort((a, b) => {
        // First sort by lesson_date
        const dateA = new Date(a.lesson_date || 0);
        const dateB = new Date(b.lesson_date || 0);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        // Then by lesson_number
        return (a.lesson_number || 0) - (b.lesson_number || 0);
      });
      
      setFileSummaries(sortedFiles);
      
      if (graphType === 'wpm_trend' || graphType === 'area_distribution_time') {
        // These charts need chunk data
        const chunks = await fetchChunksByFileIds(effectiveFileIds);
        if (chunks.length === 0) {
          setError("No chunk data available for this chart");
          setLoading(false);
          return;
        }
        
        if (graphType === 'wpm_trend') {
          const wpmData = buildWpmChartData(chunks, filteredFiles);
          console.log(`DEBUG: Built wpm_trend data:`, wpmData);
          setChartData(wpmData);
        } else if (graphType === 'area_distribution_time') {
          const areaData = buildAreaDistributionData(chunks);
          console.log(`DEBUG: Built area_distribution_time data:`, areaData);
          setChartData(areaData);
        }
      } else {
        // These charts work with summary data only - build the data here
        if (graphType === 'teaching_area_distribution') {
          // Build teaching area distribution data from summaries
          const teachingAreaLessonNames = filteredFiles.map((file, idx) => stripXlsx(file.stored_filename || `Lesson #${idx + 1}`));
          const effectiveAreaCodes = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : TEACHING_AREA_CODES.map(code => code.split(" ")[0]);
          
          const groupedBarData = effectiveAreaCodes.map((code) => {
            const entry = { code: code };
            filteredFiles.forEach((file, idx) => {
              const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
              entry[teachingAreaLessonNames[idx]] = stats[code]?.percent || 0;
            });
            return entry;
          });
          
          console.log(`DEBUG: Built teaching_area_distribution data:`, groupedBarData);
          setChartData(groupedBarData);
          
        } else if (graphType === 'total_distribution') {
          // Build total distribution data from summaries
          const effectiveAreaCodes = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : TEACHING_AREA_CODES.map(code => code.split(" ")[0]);
          
          const totalDistData = effectiveAreaCodes.map((code) => {
            const percents = filteredFiles.map((file) => {
              const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
              return stats[code]?.percent || 0;
            });
            const avg = percents.length ? percents.reduce((s, v) => s + v, 0) / percents.length : 0;
            return { code: code, y: avg };
          });
          
          console.log(`DEBUG: Built total_distribution data:`, totalDistData);
          setChartData(totalDistData);
          
        } else if (graphType === 'utterance_timeline') {
          // Build utterance timeline data from summaries
          const effectiveAreaCodes = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : TEACHING_AREA_CODES.map(code => code.split(" ")[0]);
          const lineChartData = filteredFiles.map((file, idx) => {
            const stats = parseTeachingAreaStats((file.data_summary || "").replace(/\n/g, "\n"));
            const entry = { lesson: stripXlsx(file.stored_filename || `Lesson #${idx + 1}`) };
            effectiveAreaCodes.forEach((code) => {
              entry[code] = stats[code]?.percent || 0;
            });
            return entry;
          });
          
          console.log(`DEBUG: Built utterance_timeline data:`, lineChartData);
          setChartData(lineChartData);
          
        } else {
          // Unknown graph type
          setChartData([]);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error building chart data:', err);
      setError('Failed to load chart data');
      setLoading(false);
    } finally {
      // Always reset the fetching flag
      isFetchingRef.current = false;
    }
  };

  const buildWpmChartData = (chunks, fileSummaries) => {
    // Group by file and sequence order
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
    
    return rows;
  };

  const buildAreaDistributionData = (chunks) => {
    // Group chunks by sequence order and calculate area distribution
    const seqToAreas = new Map();
    
    chunks.forEach((chunk) => {
      const seq = Number(chunk.sequence_order) || 0;
      if (!seqToAreas.has(seq)) {
        seqToAreas.set(seq, { interval: seq * 5 });
      }
      
      // Parse area_distribution JSON
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
      
      // Filter areas based on areaFilter if specified
      const effectiveAreas = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : Object.keys(areaDistribution);
      
      // Add frequencies for each teaching area
      effectiveAreas.forEach(areaCode => {
        if (seqToAreas.get(seq)[areaCode]) {
          seqToAreas.get(seq)[areaCode] += Number(areaDistribution[areaCode]) || 0;
        } else {
          seqToAreas.get(seq)[areaCode] = Number(areaDistribution[areaCode]) || 0;
        }
      });
    });
    
    return Array.from(seqToAreas.values());
  };

  // Helper function to parse teaching area statistics from file summaries
  const parseTeachingAreaStats = (summary) => {
    const lines = summary.split("\n");
    const stats = {};
    let inStats = false;
    
    for (const line of lines) {
      if (line.startsWith("TEACHING AREA STATISTICS:")) {
        inStats = true;
        continue;
      }
      if (inStats) {
        if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) {
          break;
        }
        const match = line.match(
          /^([^.]+\.\d [^:]+): (\d+) utterances \(([\d.]+)%\)/
        );
        if (match) {
          const fullAreaName = match[1].trim();
          const areaCode = fullAreaName.split(" ")[0]; // Extract "1.1" from "1.1 Establishing Interaction and rapport"
          stats[areaCode] = {
            value: parseInt(match[2], 10),
            percent: parseFloat(match[3]),
          };
        } else {
        }
      }
    }
    
    // Fill missing areas as 0 for uniformity
    const effectiveAreaCodes = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : TEACHING_AREA_CODES.map(code => code.split(" ")[0]);
    
    effectiveAreaCodes.forEach((code) => {
      if (!stats[code]) {
        stats[code] = { value: 0, percent: 0 };
      }
    });
    
    return stats;
  };

  // Download function for charts
  const handleDownloadChart = async (chartRef, chartName) => {
    if (!chartRef.current) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: "white",
        cacheBust: true,
      });
      
      const link = document.createElement('a');
      link.download = `${chartName}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download chart:', err);
    }
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading chart...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-4 text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      );
    }

    // Debug: Log chartData for troubleshooting multiple graphs
    console.log(`DEBUG: Rendering ${graphType} with chartData:`, chartData, 'length:', chartData?.length);

    switch (graphType) {
      case 'teaching_area_distribution':
        // Use chartData from state instead of re-parsing
        if (!chartData || chartData.length === 0) {
          return (
            <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              Loading chart data...
            </div>
          );
        }
        
        // Get lesson names from fileSummaries for display
        const teachingAreaLessonNames = fileSummaries.map((file, idx) => stripXlsx(file.stored_filename || `Lesson #${idx + 1}`));
        
        // Add aggregated moving average trendline to existing chartData
        const groupedBarAgg = chartData.map((row) => {
          const values = teachingAreaLessonNames.map((ln) => Number(row[ln]) || 0);
          const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          return { ...row, __agg: avg };
        });
        const groupedBarTrend = computeMovingAverage(groupedBarAgg.map((r) => r.__agg), 3);
        const groupedBarDataWithTrend = groupedBarAgg.map((r, i) => ({ ...r, __trend: groupedBarTrend[i] }));

        return (
          <div className="w-full bg-white rounded-lg p-6 border relative">
            {/* Download button */}
            <button
              onClick={() => handleDownloadChart(teachingAreaDistRef, 'teaching_area_distribution')}
              className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              title="Download chart as PNG"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <div ref={teachingAreaDistRef}>
              <h3 className="text-xl font-bold mb-4 text-center">Teaching Area Distribution Across Lessons</h3>
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
                      tickFormatter={(val) => `${val}%`}
                      label={{ value: "Percentage of Utterances (%)", angle: -90, position: "insideLeft", dy: 80 }}
                    />
                    <Tooltip formatter={(val) => `${val}%`} />
                    <Legend verticalAlign="top" align="center" />
                    {teachingAreaLessonNames.map((lesson, idx) => (
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
        );

      case 'total_distribution':
        // Use chartData from state instead of re-parsing
        if (!chartData || chartData.length === 0) {
          return (
            <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              Loading chart data...
            </div>
          );
        }
        
        // Add trend data to existing chartData
        const totalDistTrend = computeMovingAverage(chartData.map((d) => d.y), 3);
        const totalDistDataWithTrend = chartData.map((d, i) => ({ ...d, __trend: totalDistTrend[i] }));

        return (
          <div className="w-full bg-white rounded-lg p-6 border relative">
            {/* Download button */}
            <button
              onClick={() => handleDownloadChart(totalDistRef, 'total_distribution')}
              className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              title="Download chart as PNG"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <div ref={totalDistRef}>
              <h3 className="text-xl font-bold mb-4 text-center">Total Distribution</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={totalDistDataWithTrend}
                    margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                    barCategoryGap={20}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" tick={{ fontSize: 15, fontWeight: 600 }} height={40} interval={0} label={{ value: "Teaching Areas", position: "insideBottom", dy: 10 }} />
                    <YAxis tickFormatter={(val) => `${val}%`} label={{ value: 'Percentage of Utterances (%)', angle: -90, position: 'insideLeft', dy: 80 }} />
                    <Tooltip formatter={(val) => `${val}%`} />
                    <Bar dataKey="y" name="Percent" fill={LINE_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'utterance_timeline':
        // Use chartData from state instead of re-parsing
        if (!chartData || chartData.length === 0) {
          return (
            <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              Loading chart data...
            </div>
          );
        }
        
        // Add trend data to existing chartData
        const lineTrend = computeMovingAverage(chartData.map((d) => d.__agg || 0), 1);
        const lineChartDataWithTrend = chartData.map((d, i) => ({ ...d, __trend: lineTrend[i] }));

        return (
          <div className="w-full bg-white rounded-lg p-6 border relative">
            {/* Download button */}
            <button
              onClick={() => handleDownloadChart(utteranceTimelineRef, 'utterance_timeline')}
              className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              title="Download chart as PNG"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <div ref={utteranceTimelineRef}>
              <h3 className="text-xl font-bold mb-4 text-center">Utterances per Teaching Area Across Lessons</h3>
              <div className="h-[500px]">
                <div className="flex flex-row w-full h-full">
                  {/* Checkbox legend */}
                  <div className="flex flex-col justify-center items-start pl-4 min-w-[80px] border-r bg-gray-50">
                    {/* Select All/Unselect All Checkbox */}
                    <label className="flex items-center cursor-pointer select-none text-base font-bold mb-4">
                      <input
                        type="checkbox"
                        checked={true}
                        className="mr-2 accent-blue-600"
                        readOnly
                      />
                      All
                    </label>
                    {chartData.length > 0 && Object.keys(chartData[0]).filter(key => key !== 'lesson' && key !== '__agg' && key !== '__trend').map((code, idx) => (
                      <label key={code} className="flex items-center mb-2 cursor-pointer select-none text-base font-bold" style={{ color: LINE_COLORS[idx % LINE_COLORS.length] }}>
                        <input
                          type="checkbox"
                          checked={true}
                          className="mr-2 accent-current"
                          readOnly
                        />
                        {code.split(" ")[0]}
                      </label>
                    ))}
                  </div>
                  {/* Chart */}
                  <div className="flex-1 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={lineChartDataWithTrend}
                        margin={{ top: 20, right: 120, left: 60, bottom: 40 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="lesson" tick={{ fontSize: 12, fontWeight: 600, dy: 16 }} angle={0} textAnchor="middle" height={60} interval={0} label={{ value: "Lessons", position: "insideBottom", dy: 25 }} />
                        <YAxis tickFormatter={(val) => `${val}%`} label={{ value: 'Percentage of Utterances (%)', angle: -90, position: 'insideLeft', dy: 80 }} />
                        <Tooltip formatter={(val) => `${val}%`} />
                        {chartData.length > 0 && Object.keys(chartData[0]).filter(key => key !== 'lesson' && key !== '__agg' && key !== '__trend').map((code, idx) => (
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
        );

      case 'wpm_trend':
        // Use chartData from state instead of re-parsing
        if (!chartData || chartData.length === 0) {
          return (
            <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              Loading chart data...
            </div>
          );
        }
        
        // Add trend data to existing chartData
        const wpmLessonNames = fileSummaries.map((file, idx) => stripXlsx(file.stored_filename || `Lesson #${idx + 1}`));
        const wpmDataWithTrend = chartData.map((row) => {
          const values = wpmLessonNames.map((ln) => Number(row[ln]) || 0);
          const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          return { ...row, __agg: avg };
        });
        const wpmTrend = computeMovingAverage(wpmDataWithTrend.map((r) => r.__agg), 1);
        const wpmChartDataWithTrend = wpmDataWithTrend.map((r, i) => ({ ...r, __trend: wpmTrend[i] }));

        return (
          <div className="w-full bg-white rounded-lg p-6 border relative">
            {/* Download button */}
            <button
              onClick={() => handleDownloadChart(wpmChartRef, 'wpm_trend')}
              className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              title="Download chart as PNG"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <div ref={wpmChartRef}>
              <h3 className="text-xl font-bold mb-4 text-center">Average WPM Over Time</h3>
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
                    {wpmLessonNames.map((lesson, idx) => (
                      <Area key={lesson} type="monotone" dataKey={lesson} name={lesson} stroke={LINE_COLORS[idx % LINE_COLORS.length]} fill={LINE_COLORS[idx % LINE_COLORS.length]} fillOpacity={0.15} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 5 }} stackId="1" />
                    ))}
                    <Line type="linear" dataKey="__trend" name="Trend (SMA)" stroke="#111827" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case 'area_distribution_time':
        // Use chartData from state instead of re-parsing
        if (!chartData || chartData.length === 0) {
          return (
            <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
              Loading chart data...
            </div>
          );
        }
        
        // Add trend data to existing chartData
        const areaDistTrendVals = chartData.map((row) => {
          const effectiveAreaCodesTime = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : ["1.1","1.2","3.1","3.2","3.3","3.4","3.5","4.1"];
          const vals = effectiveAreaCodesTime.map((code) => Number(row[code]) || 0);
          const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
          return avg;
        });
        const areaDistTrend = computeMovingAverage(areaDistTrendVals, 1);
        const areaDistributionDataWithTrend = chartData.map((row, i) => ({ ...row, __trend: areaDistTrend[i] }));

        return (
          <div className="w-full bg-white rounded-lg p-6 border relative">
            {/* Download button */}
            <button
              onClick={() => handleDownloadChart(areaDistributionRef, 'area_distribution_time')}
              className="absolute top-4 right-4 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              title="Download chart as PNG"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            
            <div ref={areaDistributionRef}>
              <h3 className="text-xl font-bold mb-4 text-center">Lesson Timeline of Utterances</h3>
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
                      
                      const effectiveAreaCodesTime = memoizedAreaFilter.length > 0 ? memoizedAreaFilter : Object.keys(teachingAreaLabels);
                      
                      return effectiveAreaCodesTime.map((areaCode, areaIdx) => (
                        <Bar key={areaCode} dataKey={areaCode} name={areaCode} fill={LINE_COLORS[areaIdx % LINE_COLORS.length]} radius={[4, 4, 0, 0]} />
                      ));
                    })()}
                    <Line type="linear" dataKey="__trend" name="Trend (SMA)" stroke="#111827" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
            Chart type "{graphType}" not yet implemented
          </div>
        );
    }
  };

  if (!graphType) {
    return null;
  }

  return (
    <div className="mt-4">
      {renderChart()}
    </div>
  );
}

export default React.memo(GraphRenderer);