"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";
import ReactMarkdown from "react-markdown";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Calendar,
  FileText,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

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

function parseTeachingAreaStats(summary) {
  const lines = (summary || "").split("\n");
  const stats = {};
  let inStats = false;
  for (const line of lines) {
    if (line.startsWith("TEACHING AREA STATISTICS:")) { inStats = true; continue; }
    if (inStats) {
      if (line.trim() === "" || line.startsWith("QUESTION ANALYSIS:")) break;
      const match = line.match(/^([^.]+\.\d [^:]+): (\d+) utterances \(([\d.]+)%\)/);
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

function getStrengthsAndWeaknesses(stats, n = 3) {
  const areas = TEACHING_AREA_CODES.map((code) => ({
    code,
    shortCode: code.split(" ")[0],
    name: code.substring(code.indexOf(" ") + 1),
    percent: stats[code]?.percent ?? 0,
    value: stats[code]?.value ?? 0,
  }));
  const sorted = [...areas].sort((a, b) => b.percent - a.percent);
  return {
    strengths: sorted.slice(0, n),
    weaknesses: sorted.slice(-n).reverse(),
  };
}

// "Chemistry_Lesson13_15-02-2024.xlsx" → "Chemistry Lesson 13"
function parseLessonDisplayName(filename) {
  const clean = (filename || "").replace(/\.(xlsx|xls|csv|mp3|mp4|wav|m4a)$/i, "");
  const match = clean.match(/^(.+?)_[Ll]esson(\d+)/i);
  if (match) {
    return `${match[1].replace(/_/g, " ")} Lesson ${match[2]}`;
  }
  return clean;
}

function formatLessonDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString([], {
    year: "numeric", month: "long", day: "numeric",
  });
}

const proseClass =
  "prose prose-sm max-w-none text-gray-600 dark:text-gray-300 " +
  "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 " +
  "[&_strong]:font-semibold [&_strong]:text-gray-800 dark:[&_strong]:text-gray-200";

function AreaRow({ shortCode, name, percent, value, rank, rankClass, pctClass, barClass }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      {/* Rank bubble — light tinted */}
      <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${rankClass}`}>
        {rank}
      </span>

      {/* Code + name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className="shrink-0 text-xs font-semibold font-mono text-gray-400 dark:text-gray-500">
            {shortCode}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={name}>
            {name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barClass}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 w-16 text-right">
            {value} utt.
          </span>
        </div>
      </div>

      {/* Percentage — prominent */}
      <span className={`shrink-0 text-base font-bold tabular-nums ${pctClass}`}>
        {percent.toFixed(1)}%
      </span>
    </div>
  );
}

function SectionPlaceholder({ message }) {
  return (
    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm italic py-1">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SectionCard({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

function ModuleHeader({ lessonDate, allLessons, selectedLessonId, onLessonChange }) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-5 border-b border-gray-100 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-md shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              Lesson Insights
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Overview, strengths, weaknesses &amp; recommendations
            </p>
          </div>
        </div>

        {/* Controls */}
        {allLessons && allLessons.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            {lessonDate && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {lessonDate}
              </span>
            )}
            <div className="relative">
              <select
                value={selectedLessonId ?? ""}
                onChange={(e) => onLessonChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-100 shadow-sm hover:border-blue-400 dark:hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 cursor-pointer transition-colors max-w-[220px]"
                aria-label="Select lesson"
              >
                {allLessons.map((l) => (
                  <option key={l.file_id} value={l.file_id}>
                    {parseLessonDisplayName(l.stored_filename)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonInsights() {
  const { user } = useUser();
  const [allLessons, setAllLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [loading, setLoading] = useState(true);

  const lesson = allLessons.find(
    (l) => String(l.file_id) === String(selectedLessonId)
  ) ?? null;

  useEffect(() => {
    async function fetchLessons() {
      if (!user?.email) { setLoading(false); return; }
      setLoading(true);

      const { data: userData } = await supabase
        .from("users").select("user_id").eq("email", user.email).single();
      if (!userData) { setLoading(false); return; }

      const { data: files } = await supabase
        .from("files")
        .select("file_id, stored_filename, overview, data_summary, insights, lesson_date")
        .eq("user_id", userData.user_id)
        .order("lesson_date", { ascending: false })
        .limit(50);

      const nonAudio = (files || []).filter(
        (f) => !/\.(mp3|mp4|wav|m4a)$/i.test(f.stored_filename || "")
      );

      setAllLessons(nonAudio);
      if (nonAudio.length > 0) setSelectedLessonId(String(nonAudio[0].file_id));
      setLoading(false);
    }
    fetchLessons();
  }, [user]);

  if (loading) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader allLessons={[]} selectedLessonId={null} onLessonChange={() => {}} />
        <div className="flex flex-col items-center justify-center py-14">
          <div className="animate-spin rounded-full h-9 w-9 border-4 border-blue-100 dark:border-blue-800 border-t-blue-500" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading lesson insights…</p>
        </div>
      </section>
    );
  }

  if (allLessons.length === 0) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ModuleHeader allLessons={[]} selectedLessonId={null} onLessonChange={() => {}} />
        <div className="text-center py-14">
          <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-2xl inline-block mb-3">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-500 mx-auto" />
          </div>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">No lesson data yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Upload and process a lesson to see insights here.</p>
        </div>
      </section>
    );
  }

  const stats = lesson
    ? parseTeachingAreaStats((lesson.data_summary || "").replace(/\\n/g, "\n"))
    : {};
  const hasStats = Object.values(stats).some((s) => s.value > 0);
  const { strengths, weaknesses } = getStrengthsAndWeaknesses(stats, 4);
  const lessonDate = formatLessonDate(lesson?.lesson_date);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">

      <ModuleHeader
        lessonDate={lessonDate}
        allLessons={allLessons}
        selectedLessonId={selectedLessonId}
        onLessonChange={setSelectedLessonId}
      />

      <div className="p-6 space-y-6">

        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Overview
            </h4>
          </div>
          <SectionCard>
            {lesson?.overview ? (
              <div className={proseClass}>
                <ReactMarkdown>{lesson.overview}</ReactMarkdown>
              </div>
            ) : (
              <SectionPlaceholder message="Overview not available yet — check back once processing is complete." />
            )}
          </SectionCard>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Teaching Area Performance
            </h4>
          </div>

          {!hasStats ? (
            <SectionCard>
              <SectionPlaceholder message="Teaching area statistics not available yet." />
            </SectionCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="rounded-xl border border-green-100 dark:border-green-800/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800/40">
                  <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
                    Key Strengths
                  </span>
                </div>
                <div className="px-4 bg-white dark:bg-gray-800">
                  {strengths.map((area, idx) => (
                    <AreaRow
                      key={area.code}
                      rank={idx + 1}
                      shortCode={area.shortCode}
                      name={area.name}
                      percent={area.percent}
                      value={area.value}
                      rankClass="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                      pctClass="text-green-600 dark:text-green-400"
                      barClass="bg-green-400 dark:bg-green-500"
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-red-100 dark:border-red-800/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/40">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                    Areas for Improvement
                  </span>
                </div>
                <div className="px-4 bg-white dark:bg-gray-800">
                  {weaknesses.map((area, idx) => (
                    <AreaRow
                      key={area.code}
                      rank={idx + 1}
                      shortCode={area.shortCode}
                      name={area.name}
                      percent={area.percent}
                      value={area.value}
                      rankClass="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                      pctClass="text-red-600 dark:text-red-400"
                      barClass="bg-red-400 dark:bg-red-500"
                    />
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Lightbulb className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              Insights &amp; Recommendations
            </h4>
          </div>
          <SectionCard>
            {lesson?.insights ? (
              <div className={proseClass}>
                <ReactMarkdown>{lesson.insights}</ReactMarkdown>
              </div>
            ) : (
              <SectionPlaceholder message="Insights not available yet — check back once processing is complete." />
            )}
          </SectionCard>
        </div>

      </div>
    </section>
  );
}
