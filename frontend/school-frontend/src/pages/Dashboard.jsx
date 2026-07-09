import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getClasses,
  getTeachers,
  getClassReviews,
  getEnrollments,
  getStudents,
  getDashboardAttendance,
  getDashboardTeacherHours,
  bulkUpsertAttendance,
  getAttendanceRecord,
  deleteAttendanceRecord,
  updateClassSession,
} from "../api";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const HOUR_HEIGHT = 48;
const TOTAL_HOURS = 24;
const GUTTER_WIDTH = 68;

const LOW_SESSIONS_THRESHOLD = 2;

const SUBJECT_COLORS = {
  Guitar: {
    bg: "bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-800",
    badge: "bg-amber-50 text-amber-700",
  },
  "Guitar điện": {
    bg: "bg-orange-100",
    border: "border-orange-300",
    text: "text-orange-800",
    badge: "bg-orange-50 text-orange-700",
  },
  Piano: {
    bg: "bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-800",
    badge: "bg-blue-50 text-blue-700",
  },
  Organ: {
    bg: "bg-purple-100",
    border: "border-purple-300",
    text: "text-purple-800",
    badge: "bg-purple-50 text-purple-700",
  },
  Trống: {
    bg: "bg-rose-100",
    border: "border-rose-300",
    text: "text-rose-800",
    badge: "bg-rose-50 text-rose-700",
  },
  "Thanh nhạc": {
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    text: "text-emerald-800",
    badge: "bg-emerald-50 text-emerald-700",
  },
};
const DEFAULT_COLOR = {
  bg: "bg-slate-100",
  border: "border-slate-300",
  text: "text-slate-800",
  badge: "bg-slate-50 text-slate-700",
};
function colorFor(subject) {
  return SUBJECT_COLORS[subject] || DEFAULT_COLOR;
}

// ─── Attendance status config (4 states) ───────────────────────────────────
// present / absent_no_notice consume a session from the enrollment's pool.
// absent_notice / none (no record yet) do not.
const CYCLE_ORDER = ["none", "present", "absent_notice", "absent_no_notice"];
const STATUS_CONFIG = {
  present: {
    label: "Present",
    symbol: "✓",
    cellClass: "bg-green-100 text-green-700 hover:bg-green-200",
    legendClass: "bg-green-100 text-green-700",
    decrements: true,
  },
  absent_notice: {
    label: "Absent (Notice)",
    symbol: "N",
    cellClass: "bg-amber-100 text-amber-700 hover:bg-amber-200",
    legendClass: "bg-amber-100 text-amber-700",
    decrements: false,
  },
  absent_no_notice: {
    label: "Absent (No Notice)",
    symbol: "✗",
    cellClass: "bg-red-100 text-red-600 hover:bg-red-200",
    legendClass: "bg-red-100 text-red-600",
    decrements: true,
  },
  none: {
    label: "No Info",
    symbol: "·",
    cellClass: "hover:bg-slate-100 text-slate-300",
    legendClass: "bg-slate-100 text-slate-400",
    decrements: false,
  },
};

function AttendanceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
      {CYCLE_ORDER.map((key) => {
        const cfg = STATUS_CONFIG[key];
        return (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs font-bold ${cfg.legendClass}`}
            >
              {cfg.symbol}
            </span>
            <span className="text-xs text-slate-600">
              {cfg.label}
              <span className="text-slate-400">
                {cfg.decrements ? " · deducts a session" : " · no deduction"}
              </span>
            </span>
          </div>
        );
      })}
      <span className="text-xs text-slate-400 ml-auto">
        Click a cell to cycle through states
      </span>
    </div>
  );
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
function formatDateVN(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
function hourLabel(h) {
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}
function toISODateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Classes have optional start_date/end_date (YYYY-MM-DD). No date means
// no bound on that side — i.e. always available from/until that end.
function classActiveOnDate(c, dateStr) {
  if (c.start_date && dateStr < c.start_date) return false;
  if (c.end_date && dateStr > c.end_date) return false;
  return true;
}
function getWeekDates(weekOffset = 0) {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
  const dates = {};
  DAYS.forEach((d, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    dates[d] = dt;
  });
  return dates;
}
function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const clusters = [];
  let current = [],
    currentEnd = -Infinity;
  for (const e of sorted) {
    if (current.length === 0 || e.startMin < currentEnd) {
      current.push(e);
      currentEnd = Math.max(currentEnd, e.endMin);
    } else {
      clusters.push(current);
      current = [e];
      currentEnd = e.endMin;
    }
  }
  if (current.length) clusters.push(current);
  const result = [];
  for (const cluster of clusters) {
    const trackEnds = [],
      clusterPositioned = [];
    for (const e of cluster) {
      let track = trackEnds.findIndex((end) => end <= e.startMin);
      if (track === -1) {
        track = trackEnds.length;
        trackEnds.push(e.endMin);
      } else trackEnds[track] = e.endMin;
      clusterPositioned.push({ ...e, track });
    }
    const trackCount = trackEnds.length;
    clusterPositioned.forEach((e) => result.push({ ...e, trackCount }));
  }
  return result;
}
function pillClasses(active, colors) {
  if (active) {
    const badgeClass = colors ? colors.badge : "bg-slate-800 text-white";
    return `text-xs px-3 py-1 rounded-full font-medium ${badgeClass} ring-1 ring-inset ring-current`;
  }
  return "text-xs px-3 py-1 rounded-full font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50";
}

// ─── Month picker helper ──────────────────────────────────────────────────────
function useMonthYear() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  function prev() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }
  const label = new Date(year, month - 1, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  return { month, year, prev, next, label };
}

// ─── Session modal ────────────────────────────────────────────────────────────
function SessionModal({ session, teachersById, onClose, onUpdated }) {
  if (!session) return null;

  const [editing, setEditing] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    session.teacher_id ? String(session.teacher_id) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const teacher = session.teacher_id ? teachersById[session.teacher_id] : null;
  const colors = colorFor(session.subject);
  const teachers = Object.values(teachersById);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateClassSession(session.id, {
        day_of_week: session.day_of_week,
        start_time: session.start_time,
        end_time: session.end_time,
        teacher_id: selectedTeacherId ? Number(selectedTeacherId) : null,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {session.class_name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              {session.subject && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}
                >
                  {session.subject}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {session.day_of_week} · {formatTime(session.start_time)}–
                {formatTime(session.end_time)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Teacher section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Teacher
              </p>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {saveError && (
                  <p className="text-xs text-red-600">{saveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setSelectedTeacherId(
                        session.teacher_id ? String(session.teacher_id) : "",
                      );
                      setSaveError(null);
                    }}
                    className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : teacher ? (
              <div className="border border-slate-100 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium text-slate-800">
                  {teacher.name}
                </p>
                <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-slate-500">
                  {teacher.phone && <span>{teacher.phone}</span>}
                  {teacher.email && <span>{teacher.email}</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No teacher assigned to this session.
              </p>
            )}
          </div>

          {/* Students section */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Students ({session.students.length})
            </p>
            {session.students.length === 0 ? (
              <p className="text-sm text-slate-400">
                No students enrolled in this session yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {session.students.map((s) => (
                  <Link
                    key={s.id}
                    to={`/students/${s.id}`}
                    className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-blue-700 hover:underline">
                      {s.name}
                    </span>
                    <svg
                      className="w-3.5 h-3.5 text-slate-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notices table ─────────────────────────────────────────────────────────────
function noteFor(remaining) {
  if (remaining <= 0)
    return {
      text: "Sessions exhausted — contact the student/parent to renew before the next class.",
      tone: "bg-red-50 text-red-700",
    };
  if (remaining === 1)
    return {
      text: "Only 1 session left — notify the student/parent to renew soon.",
      tone: "bg-amber-50 text-amber-700",
    };
  return {
    text: `${remaining} sessions left — give the student/parent a heads-up about renewing.`,
    tone: "bg-amber-50 text-amber-700",
  };
}
const NOTICES_KEY = "dashboard_dismissed_notices";
function loadDismissed() {
  try {
    const r = localStorage.getItem(NOTICES_KEY);
    return r ? new Set(JSON.parse(r)) : new Set();
  } catch {
    return new Set();
  }
}
function saveDismissed(set) {
  try {
    localStorage.setItem(NOTICES_KEY, JSON.stringify([...set]));
  } catch {}
}
function NoticesTable({
  notices,
  dismissedKeys,
  onDismiss,
  onShowDismissed,
  dismissedCount,
}) {
  const visible = notices.filter((n) => !dismissedKeys.has(n.key));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Notices</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Students with {LOW_SESSIONS_THRESHOLD} or fewer sessions remaining.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dismissedCount > 0 && (
            <button
              onClick={onShowDismissed}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Restore {dismissedCount} dismissed
            </button>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
            {visible.length} {visible.length === 1 ? "notice" : "notices"}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[11%]" />
            <col className="w-[44%]" />
            <col className="w-[31%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="px-3 py-2">STT</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Notice Content</th>
              <th className="px-3 py-2">Additional Note</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-slate-400 text-sm"
                >
                  No students are currently running low on sessions.
                </td>
              </tr>
            ) : (
              visible.map((n, i) => (
                <tr
                  key={n.key}
                  className="border-t border-slate-100 align-top hover:bg-slate-50/60"
                >
                  <td className="px-3 py-2 text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">
                    {n.date}
                  </td>
                  <td className="px-3 py-2 text-slate-700 text-xs leading-relaxed">
                    <Link
                      to={`/students/${n.student_id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {n.student_name}
                    </Link>
                    {` has attended ${n.attended}/${n.total_sessions} registered class sessions for the ${n.subject ?? "—"} class`}
                    {n.teacher_name ? ` taught by ${n.teacher_name}` : ""}
                    {"."}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full font-medium ${n.tone}`}
                    >
                      {n.note}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onDismiss(n.key)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Reviews table ─────────────────────────────────────────────────────────────
const SELECT_CLS =
  "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700";
function ReviewsTable({ allReviews, classes }) {
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const subjectOptions = useMemo(
    () => [...new Set(classes.map((c) => c.subject).filter(Boolean))].sort(),
    [classes],
  );
  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => !filterSubject || c.subject === filterSubject)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [classes, filterSubject],
  );
  const teacherOptions = useMemo(() => {
    const rel = allReviews.filter(
      (r) =>
        (!filterSubject || r.subject === filterSubject) &&
        (!filterClassId || String(r.class_id) === String(filterClassId)),
    );
    return [...new Set(rel.map((r) => r.teacher_name).filter(Boolean))].sort();
  }, [allReviews, filterSubject, filterClassId]);
  function handleSubjectChange(v) {
    setFilterSubject(v);
    setFilterClassId("");
    setFilterTeacher("");
    setPage(1);
  }
  function handleClassChange(v) {
    setFilterClassId(v);
    setFilterTeacher("");
    setPage(1);
  }
  function handleTeacherChange(v) {
    setFilterTeacher(v);
    setPage(1);
  }
  const filtered = useMemo(
    () =>
      allReviews.filter(
        (r) =>
          (!filterSubject || r.subject === filterSubject) &&
          (!filterClassId || String(r.class_id) === String(filterClassId)) &&
          (!filterTeacher || r.teacher_name === filterTeacher),
      ),
    [allReviews, filterSubject, filterClassId, filterTeacher],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  function pageNumbers() {
    const pages = [],
      delta = 2,
      left = Math.max(2, safePage - delta),
      right = Math.min(totalPages - 1, safePage + delta);
    pages.push(1);
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }
  const resultBadge =
    filtered.length === allReviews.length
      ? `${allReviews.length} reviews`
      : `${filtered.length} of ${allReviews.length} reviews`;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Session Reviews
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{resultBadge}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {[20, 50].map((n) => (
            <button
              key={n}
              onClick={() => {
                setPageSize(n);
                setPage(1);
              }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${pageSize === n ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {n} / page
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filterSubject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All subjects</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterClassId}
          onChange={(e) => handleClassChange(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All classes</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterTeacher}
          onChange={(e) => handleTeacherChange(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All teachers</option>
          {teacherOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(filterSubject || filterClassId || filterTeacher) && (
          <button
            onClick={() => handleSubjectChange("")}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Session Content</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-slate-400 text-sm"
                >
                  No reviews match the current filters.
                </td>
              </tr>
            ) : (
              pageSlice.map((r) => {
                const colors = colorFor(r.subject);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 align-top hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2">
                      {r.subject ? (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}
                        >
                          {r.subject}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {r.day_of_week ? r.day_of_week.slice(0, 3) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs truncate">
                      <Link
                        to={`/classes/${r.class_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.class_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium text-xs truncate">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {r.review_date}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs whitespace-pre-wrap break-words">
                      {r.session_content || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs whitespace-pre-wrap break-words">
                      {r.review_text || (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.session_result ? (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.session_result === "Pass" ? "bg-green-50 text-green-700" : r.session_result === "Fail" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}
                        >
                          {r.session_result}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">
            Showing {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {pageNumbers().map((n, i) =>
              n === "…" ? (
                <span
                  key={`e${i}`}
                  className="text-xs px-2 text-slate-400 select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${safePage === n ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Attendance table ──────────────────────────────────────────────────

// Normalise raw API rows: convert the three per-status date arrays into Sets.
function normaliseRows(data) {
  return data.map((r) => ({
    ...r,
    present_dates: new Set(r.present_dates),
    absent_notice_dates: new Set(r.absent_notice_dates),
    absent_no_notice_dates: new Set(r.absent_no_notice_dates),
  }));
}

// The persisted status for a date, ignoring any unsaved pending edits.
function savedStatus(row, d) {
  if (row.present_dates.has(d)) return "present";
  if (row.absent_notice_dates.has(d)) return "absent_notice";
  if (row.absent_no_notice_dates.has(d)) return "absent_no_notice";
  return "none";
}

function AttendanceTable({ month, year, onSaved }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({});
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardAttendance(month, year);
      setRows(normaliseRows(data));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const subjectOptions = useMemo(
    () => [...new Set(rows.map((r) => r.subject).filter(Boolean))].sort(),
    [rows],
  );

  const teacherOptions = useMemo(() => {
    const source = filterSubject
      ? rows.filter((r) => r.subject === filterSubject)
      : rows;
    return [
      ...new Set(source.map((r) => r.teacher_name).filter(Boolean)),
    ].sort();
  }, [rows, filterSubject]);

  function handleSubjectChange(v) {
    setFilterSubject(v);
    setFilterTeacher("");
  }

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filterSubject || r.subject === filterSubject) &&
          (!filterTeacher || r.teacher_name === filterTeacher),
      ),
    [rows, filterSubject, filterTeacher],
  );

  const allDates = useMemo(() => {
    const set = new Set();
    filteredRows.forEach((r) => r.occurrence_dates.forEach((d) => set.add(d)));
    return [...set].sort();
  }, [filteredRows]);

  // Each date maps to a specific session_id via date_session_map from the backend
  function sessionIdForDate(row, d) {
    return row.date_session_map[d];
  }

  // Effective state for a cell: an unsaved pending edit wins over the saved value.
  function cellState(row, d) {
    if (!row.occurrence_dates.includes(d)) return "na";
    const sessionId = sessionIdForDate(row, d);
    const key = `${row.student_id}:${sessionId}:${d}`;
    if (pending[key] !== undefined) return pending[key];
    return savedStatus(row, d);
  }

  function toggleCell(row, d) {
    if (!row.occurrence_dates.includes(d)) return;
    const sessionId = sessionIdForDate(row, d);
    const key = `${row.student_id}:${sessionId}:${d}`;
    const cur = cellState(row, d);
    const idx = CYCLE_ORDER.indexOf(cur);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    const dbState = savedStatus(row, d);
    if (next === dbState) {
      setPending((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
    } else {
      setPending((p) => ({ ...p, [key]: next }));
    }
  }

  async function saveChanges() {
    if (Object.keys(pending).length === 0) return;
    setSaving(true);
    try {
      const toDelete = [];
      const toUpsert = [];

      for (const [key, status] of Object.entries(pending)) {
        const [student_id, session_id, attendance_date] = key.split(":");
        if (status === "none") {
          toDelete.push({
            student_id: Number(student_id),
            session_id: Number(session_id),
            attendance_date,
          });
        } else {
          // Look up teacher_id from the row's schedules
          const row = rows.find((r) => String(r.student_id) === student_id);
          toUpsert.push({
            student_id: Number(student_id),
            session_id: Number(session_id),
            attendance_date,
            status,
            teacher_id: row?.teacher_id ?? null,
            note: null,
          });
        }
      }

      await Promise.all(
        toDelete.map(async ({ student_id, session_id, attendance_date }) => {
          const existing = await getAttendanceRecord(
            student_id,
            session_id,
            attendance_date,
          );
          if (existing) await deleteAttendanceRecord(existing.id);
        }),
      );

      if (toUpsert.length > 0) await bulkUpsertAttendance(toUpsert);

      setPending({});
      await load();
      onSaved?.();
    } catch (e) {
      alert("Error saving: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <p className="text-sm text-slate-400">Loading attendance…</p>
      </div>
    );
  if (error)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );

  const hasPending = Object.keys(pending).length > 0;
  const resultLabel =
    filteredRows.length === rows.length
      ? `${rows.length} enrollment${rows.length !== 1 ? "s" : ""}`
      : `${filteredRows.length} of ${rows.length} enrollments`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Student Attendance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click a cell to cycle: No Info → Present → Absent (Notice) →
            Absent (No Notice). Save when done.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPending && (
            <span className="text-xs text-amber-600 font-medium">
              {Object.keys(pending).length} unsaved change
              {Object.keys(pending).length > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={saveChanges}
            disabled={!hasPending || saving}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <AttendanceLegend />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filterSubject}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All subjects</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All teachers</option>
          {teacherOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(filterSubject || filterTeacher) && (
          <button
            onClick={() => {
              setFilterSubject("");
              setFilterTeacher("");
            }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-1">{resultLabel}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table
          className="text-sm border border-slate-200 rounded-lg"
          style={{ minWidth: `${630 + allDates.length * 52}px` }}
        >
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th className="px-2 py-2 w-8 text-center text-xs sticky left-0 bg-slate-50 z-10">
                #
              </th>
              <th className="px-3 py-2 min-w-[140px] text-xs sticky left-8 bg-slate-50 z-10">
                Student
              </th>
              <th className="px-3 py-2 min-w-[230px] text-xs">Schedule</th>
              <th className="px-3 py-2 min-w-[70px] text-xs">Subject</th>
              <th className="px-3 py-2 min-w-[150px] text-xs">Teacher</th>
              <th className="px-3 py-2 min-w-[75px] text-xs text-right">
                Price
              </th>
              {allDates.map((d, i) => {
                const dt = new Date(d + "T00:00:00");
                return (
                  <th key={d} className="py-2 w-12 text-center" title={d}>
                    <div className="text-sm font-bold text-slate-700 leading-tight">
                      {i + 1}
                    </div>
                    <div className="text-xs font-normal text-slate-500 leading-tight">
                      {String(dt.getDate()).padStart(2, "0")}/
                      {String(dt.getMonth() + 1).padStart(2, "0")}
                    </div>
                  </th>
                );
              })}
              <th className="px-2 py-2 w-14 text-center text-xs">Total</th>
              <th className="px-2 py-2 w-14 text-center text-xs">Left</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + allDates.length}
                  className="px-3 py-8 text-center text-slate-400 text-sm"
                >
                  {rows.length === 0
                    ? "No active enrollments this month."
                    : "No enrollments match the current filters."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const colors = colorFor(row.subject);

                // Schedule label — all slots in this enrollment
                const scheduleLabel = (row.schedules ?? [])
                  .sort(
                    (a, b) =>
                      DAYS.indexOf(a.day_of_week) -
                        DAYS.indexOf(b.day_of_week) ||
                      a.start_time.localeCompare(b.start_time),
                  )
                  .map(
                    (s) =>
                      `${s.day_of_week.slice(0, 3)} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`,
                  )
                  .join(" & ");

                // Compute remaining accounting for unsaved pending changes.
                // Backend's remaining_sessions already reflects saved
                // Present/Absent(No Notice) records; we adjust it by the
                // net change in "session-consuming" status caused by
                // pending edits for this row.
                const rowSessionIds = new Set(
                  (row.schedules ?? []).map((s) => String(s.session_id)),
                );

                let pendingDecrementDelta = 0;
                for (const [key, status] of Object.entries(pending)) {
                  const [sid, sessid, d] = key.split(":");
                  if (
                    String(sid) !== String(row.student_id) ||
                    !rowSessionIds.has(sessid)
                  )
                    continue;
                  const oldStatus = savedStatus(row, d);
                  const oldDecrements = STATUS_CONFIG[oldStatus].decrements;
                  const newDecrements = STATUS_CONFIG[status].decrements;
                  if (newDecrements && !oldDecrements) pendingDecrementDelta += 1;
                  else if (!newDecrements && oldDecrements)
                    pendingDecrementDelta -= 1;
                }

                const attendedSoFar =
                  row.total_sessions != null
                    ? row.total_sessions - (row.remaining_sessions ?? 0)
                    : 0;

                const remaining =
                  row.total_sessions != null
                    ? Math.max(
                        0,
                        row.total_sessions -
                          attendedSoFar -
                          pendingDecrementDelta,
                      )
                    : null;

                return (
                  <tr
                    key={row.enrollment_id}
                    className={`border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}
                  >
                    <td className="px-2 py-2 text-center text-xs text-slate-400 sticky left-0 bg-inherit z-10">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-800 sticky left-8 bg-inherit z-10">
                      <Link
                        to={`/students/${row.student_id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {row.student_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 leading-snug">
                      {scheduleLabel}
                    </td>
                    <td className="px-3 py-2">
                      {row.subject ? (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}
                        >
                          {row.subject}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {row.teacher_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600 whitespace-nowrap">
                      {row.price != null ? row.price.toLocaleString() : "—"}
                    </td>
                    {allDates.map((d) => {
                      const state = cellState(row, d);
                      const isOccurrence = row.occurrence_dates.includes(d);
                      if (!isOccurrence) {
                        return (
                          <td
                            key={d}
                            className="w-12 text-center bg-slate-100/50 border-l border-slate-100"
                          />
                        );
                      }
                      const cfg = STATUS_CONFIG[state];
                      return (
                        <td
                          key={d}
                          className="w-12 text-center border-l border-slate-100 p-0"
                        >
                          <button
                            onClick={() => toggleCell(row, d)}
                            title={`${row.student_name} – ${d} – ${cfg.label}`}
                            className={`w-full h-9 text-sm font-bold transition-colors ${cfg.cellClass}`}
                          >
                            {cfg.symbol}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-sm font-semibold text-slate-700">
                      {row.total_sessions ?? "—"}
                    </td>
                    <td
                      className={`px-2 py-2 text-center text-sm font-semibold ${
                        remaining != null && remaining <= LOW_SESSIONS_THRESHOLD
                          ? "text-red-600"
                          : "text-slate-700"
                      }`}
                    >
                      {remaining ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Teacher Hours table ───────────────────────────────────────────────────────
function slotHours(sl) {
  const [sh, sm] = sl.start_time.split(":").map(Number);
  const [eh, em] = sl.end_time.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function TeacherHoursTable() {
  const { month, year, prev, next, label } = useMonthYear();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterSubject, setFilterSubject] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [expandedDates, setExpandedDates] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedTeacher(null);
    setExpandedDates(new Set());
    getDashboardTeacherHours(month, year)
      .then((data) => {
        setRows(data);
        if (data.length > 0) setSelectedTeacher(data[0].teacher_id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month, year]);

  const subjectOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) =>
      r.slots.forEach((sl) => {
        if (sl.subject) set.add(sl.subject);
      }),
    );
    return [...set].sort();
  }, [rows]);

  const teacherOptions = useMemo(() => {
    if (!filterSubject) return rows;
    return rows.filter((r) =>
      r.slots.some((sl) => sl.subject === filterSubject),
    );
  }, [rows, filterSubject]);

  function handleSubjectChange(v) {
    setFilterSubject(v);
    const eligible = v
      ? rows.filter((r) => r.slots.some((sl) => sl.subject === v))
      : rows;
    setSelectedTeacher(eligible.length > 0 ? eligible[0].teacher_id : null);
    setExpandedDates(new Set());
  }

  function handleTeacherChange(v) {
    setSelectedTeacher(Number(v));
    setExpandedDates(new Set());
  }

  function toggleExpand(dateStr) {
    setExpandedDates((prev) => {
      const n = new Set(prev);
      if (n.has(dateStr)) n.delete(dateStr);
      else n.add(dateStr);
      return n;
    });
  }

  const teacherRow = rows.find((r) => r.teacher_id === selectedTeacher) ?? null;

  const visibleSlots = useMemo(() => {
    if (!teacherRow) return [];
    return filterSubject
      ? teacherRow.slots.filter((sl) => sl.subject === filterSubject)
      : teacherRow.slots;
  }, [teacherRow, filterSubject]);

  // Hours broken down by subject — computed off the teacher's FULL slot
  // list (ignores the subject filter) so the summary chips always give
  // the complete picture regardless of which subject view is active.
  const hoursBySubject = useMemo(() => {
    if (!teacherRow) return {};
    const totals = {};
    for (const sl of teacherRow.slots) {
      const key = sl.subject || "Unspecified";
      totals[key] = (totals[key] || 0) + slotHours(sl);
    }
    return totals;
  }, [teacherRow]);

  const daysInMonth = useMemo(() => {
    const days = [];
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [year, month]);

  // Distinct subjects that appear in the currently visible slot set —
  // these become the table's columns (header shows subject only, no times).
  const subjectsList = useMemo(() => {
    const set = new Set();
    visibleSlots.forEach((sl) => set.add(sl.subject || "Unspecified"));
    return [...set].sort();
  }, [visibleSlots]);

  // Full slot objects grouped by date, so the expanded row can list each
  // individual session (time + class) underneath its subject.
  const slotsByDateFull = useMemo(() => {
    const map = {};
    for (const sl of visibleSlots) {
      if (!map[sl.date]) map[sl.date] = [];
      map[sl.date].push(sl);
    }
    return map;
  }, [visibleSlots]);

  function daySubjectHours(dateStr, subject) {
    const list = slotsByDateFull[dateStr] ?? [];
    return list
      .filter((sl) => (sl.subject || "Unspecified") === subject)
      .reduce((s, sl) => s + slotHours(sl), 0);
  }

  function dayTotalHours(dateStr) {
    const list = slotsByDateFull[dateStr] ?? [];
    return list.reduce((s, sl) => s + slotHours(sl), 0);
  }

  const subjectTotals = useMemo(() => {
    const totals = {};
    for (const subj of subjectsList) totals[subj] = 0;
    for (const sl of visibleSlots) {
      const subj = sl.subject || "Unspecified";
      totals[subj] = (totals[subj] || 0) + slotHours(sl);
    }
    return totals;
  }, [visibleSlots, subjectsList]);

  const totalHours = useMemo(
    () => Object.values(subjectTotals).reduce((s, h) => s + h, 0),
    [subjectTotals],
  );

  // Only keep the days in the month where the selected teacher actually
  // taught at least one slot — empty days are hidden from the table.
  const workingDays = useMemo(
    () =>
      daysInMonth.filter((dt) => {
        const dateStr = dt.toISOString().slice(0, 10);
        return dayTotalHours(dateStr) > 0;
      }),
    [daysInMonth, slotsByDateFull],
  );

  const DAY_NAMES_VN = [
    "Chủ Nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ];

  if (loading)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <p className="text-sm text-slate-400">Loading teacher hours…</p>
      </div>
    );
  if (error)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Teacher Hours
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hours taught per day, derived from attendance records. Click a
            row to see the session breakdown.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={prev}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
              title="Previous month"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <p className="text-xs font-medium text-slate-600 min-w-[110px] text-center">
              {label}
            </p>
            <button
              onClick={next}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
              title="Next month"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select
            value={filterSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={selectedTeacher ?? ""}
            onChange={(e) => handleTeacherChange(e.target.value)}
            disabled={teacherOptions.length === 0}
            className={SELECT_CLS}
          >
            {teacherOptions.length === 0 ? (
              <option value="">No teachers</option>
            ) : (
              teacherOptions.map((r) => (
                <option key={r.teacher_id} value={r.teacher_id}>
                  {r.teacher_name}
                </option>
              ))
            )}
          </select>
          {filterSubject && (
            <button
              onClick={() => handleSubjectChange("")}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!teacherRow || rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          No teaching activity recorded this month.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-6 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto">
            <div className="flex-shrink-0">
              <p className="text-xs text-slate-400 whitespace-nowrap">Teacher</p>
              <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                {teacherRow.teacher_name}
              </p>
            </div>
            {filterSubject && (
              <div className="border-l border-slate-200 pl-4 flex-shrink-0">
                <p className="text-xs text-slate-400 whitespace-nowrap">Subject</p>
                <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                  {filterSubject}
                </p>
              </div>
            )}
            <div className="border-l border-slate-200 pl-4 flex-shrink-0">
              <p className="text-xs text-slate-400 whitespace-nowrap">
                Total Hours This Month
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
              </p>
            </div>
            <div className="border-l border-slate-200 pl-4 flex-shrink-0">
              <p className="text-xs text-slate-400 whitespace-nowrap">
                Sessions Taught
              </p>
              <p className="text-2xl font-bold text-slate-800">
                {visibleSlots.length}
              </p>
            </div>
            <div className="border-l border-slate-200 pl-4 flex-shrink-0">
              <p className="text-xs text-slate-400 mb-1 whitespace-nowrap">
                Hours by Subject
              </p>
              <div className="flex items-center gap-2 whitespace-nowrap">
                {Object.entries(hoursBySubject).map(([subj, hrs]) => {
                  const c = colorFor(subj);
                  return (
                    <span
                      key={subj}
                      className={`text-sm px-2.5 py-1 rounded-full font-semibold ${c.badge}`}
                    >
                      {subj}: {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}h
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {workingDays.length === 0 ? (
            <p className="text-sm text-slate-400">
              No working days recorded for this teacher this month.
            </p>
          ) : (
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                  <th className="w-8"></th>
                  <th className="px-3 py-2 text-left w-24">Day</th>
                  <th className="px-3 py-2 text-left w-28">Date</th>
                  {subjectsList.map((subj) => {
                    const c = colorFor(subj);
                    return (
                      <th key={subj} className="px-2 py-2 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium normal-case ${c.badge}`}
                        >
                          {subj}
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2 text-center font-bold text-slate-700 w-20">
                    Giờ dạy
                  </th>
                </tr>
              </thead>
              <tbody>
                {workingDays.map((dt) => {
                  const dateStr = dt.toISOString().slice(0, 10);
                  const total = dayTotalHours(dateStr);
                  const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                  const isExpanded = expandedDates.has(dateStr);
                  const daySlots = slotsByDateFull[dateStr] ?? [];
                  return (
                    <>
                      <tr
                        key={dateStr}
                        onClick={() => toggleExpand(dateStr)}
                        className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50/40 transition-colors ${isWeekend ? "bg-slate-50/60" : ""} ${isExpanded ? "bg-blue-50/40" : ""}`}
                      >
                        <td className="px-1 py-1.5 text-center text-slate-400">
                          <svg
                            className={`w-3.5 h-3.5 mx-auto transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {DAY_NAMES_VN[dt.getDay()]}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {String(dt.getDate()).padStart(2, "0")}/
                          {String(dt.getMonth() + 1).padStart(2, "0")}/
                          {dt.getFullYear()}
                        </td>
                        {subjectsList.map((subj) => {
                          const hrs = daySubjectHours(dateStr, subj);
                          const c = colorFor(subj);
                          return (
                            <td key={subj} className="px-2 py-1.5 text-center">
                              {hrs > 0 ? (
                                <span
                                  className={`font-bold px-1.5 py-0.5 rounded ${c.badge}`}
                                >
                                  {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-200">–</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-1.5 text-center font-bold text-slate-800">
                          {total % 1 === 0 ? total : total.toFixed(1)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${dateStr}-detail`} className="bg-slate-50/70 border-t border-slate-100">
                          <td colSpan={subjectsList.length + 4} className="px-6 py-3">
                            <div className="flex flex-wrap gap-8">
                              {subjectsList
                                .filter((subj) => daySubjectHours(dateStr, subj) > 0)
                                .map((subj) => {
                                  const c = colorFor(subj);
                                  const sessions = daySlots.filter(
                                    (sl) => (sl.subject || "Unspecified") === subj,
                                  );
                                  return (
                                    <div key={subj} className="min-w-[180px]">
                                      <span
                                        className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-2 ${c.badge}`}
                                      >
                                        {subj}
                                      </span>
                                      <div className="space-y-1.5">
                                        {sessions.map((sl, i) => (
                                          <div
                                            key={i}
                                            className="text-xs text-slate-600 flex items-center justify-between gap-4"
                                          >
                                            <span>
                                              {sl.start_time.slice(0, 5)}–
                                              {sl.end_time.slice(0, 5)}
                                              {sl.class_name && (
                                                <span className="text-slate-400">
                                                  {" "}
                                                  ({sl.class_name})
                                                </span>
                                              )}
                                            </span>
                                            <span className="font-semibold text-slate-700 flex-shrink-0">
                                              {slotHours(sl) % 1 === 0
                                                ? slotHours(sl)
                                                : slotHours(sl).toFixed(1)}
                                              h
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                  <td className="px-3 py-2" colSpan={3}>
                    CỘNG
                  </td>
                  {subjectsList.map((subj) => {
                    const h = subjectTotals[subj] ?? 0;
                    return (
                      <td key={subj} className="px-2 py-2 text-center text-blue-700">
                        {h % 1 === 0 ? h : h.toFixed(1)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center text-blue-700">
                    {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [dismissedKeys, setDismissedKeys] = useState(loadDismissed);
  const [weekOffset, setWeekOffset] = useState(0);

  const tableMonth = useMonthYear();

  const refreshEnrollments = useCallback(async () => {
    try {
      const data = await getEnrollments();
      setEnrollments(data);
    } catch (e) {
      console.error("Failed to refresh enrollments:", e);
    }
  }, []);

  const refreshClasses = useCallback(async () => {
    try {
      const data = await getClasses();
      setClasses(data);
    } catch (e) {
      console.error("Failed to refresh classes:", e);
    }
  }, []);

  function dismissNotice(key) {
    setDismissedKeys((prev) => {
      const n = new Set(prev);
      n.add(key);
      saveDismissed(n);
      return n;
    });
  }
  function restoreDismissedNotices() {
    setDismissedKeys(() => {
      const n = new Set();
      saveDismissed(n);
      return n;
    });
  }

  useEffect(() => {
    Promise.all([getClasses(), getTeachers(), getStudents(), getEnrollments()])
      .then(([classData, teacherData, studentData, enrollmentData]) => {
        setClasses(classData);
        setTeachers(teacherData);
        setStudents(studentData);
        setEnrollments(enrollmentData);
        setLoading(false);
        const classMeta = Object.fromEntries(
          classData.map((c) => [
            c.id,
            { class_id: c.id, class_name: c.name, subject: c.subject },
          ]),
        );
        Promise.all(
          classData.map((c) =>
            getClassReviews(c.id)
              .then((reviews) =>
                reviews.map((r) => ({ ...r, ...classMeta[c.id] })),
              )
              .catch(() => []),
          ),
        ).then((nested) => {
          setAllReviews(
            nested
              .flat()
              .sort((a, b) =>
                (b.review_date ?? "").localeCompare(a.review_date ?? ""),
              ),
          );
          setReviewsLoading(false);
        });
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        setReviewsLoading(false);
      });
  }, []);

  const sessionInfo = useMemo(() => {
    const map = {};
    classes.forEach((c) =>
      c.sessions.forEach((s) => {
        map[s.id] = {
          class_id: c.id,
          class_name: c.name,
          subject: c.subject,
          teacher_name: s.teacher_name,
        };
      }),
    );
    return map;
  }, [classes]);

  const studentsById = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s])),
    [students],
  );

  // Notices — one notice per enrollment (which now covers N slots as a shared pool)
  const notices = useMemo(() => {
    const today = formatDateVN(new Date());
    return enrollments
      .filter(
        (e) =>
          e.status === "Enrolled" &&
          e.remaining_sessions != null &&
          e.total_sessions != null &&
          e.remaining_sessions <= LOW_SESSIONS_THRESHOLD,
      )
      .map((e) => {
        const student = studentsById[e.student_id];
        // Use the first session_id to look up class/subject/teacher metadata
        const primarySessionId = e.session_ids?.[0];
        const info = primarySessionId
          ? sessionInfo[primarySessionId] || {}
          : {};
        const { text, tone } = noteFor(e.remaining_sessions);
        return {
          key: `${e.student_id}:${e.id}:${e.remaining_sessions}`,
          student_id: e.student_id,
          session_id: primarySessionId,
          student_name: student?.name ?? "Unknown student",
          subject: info.subject,
          teacher_name: info.teacher_name,
          attended: e.total_sessions - e.remaining_sessions,
          total_sessions: e.total_sessions,
          remaining_sessions: e.remaining_sessions,
          date: today,
          note: text,
          tone,
        };
      })
      .sort(
        (a, b) =>
          a.remaining_sessions - b.remaining_sessions ||
          a.student_name.localeCompare(b.student_name),
      );
  }, [enrollments, studentsById, sessionInfo]);

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>;
  if (error) return <p className="p-8 text-red-500">{error}</p>;

  const teachersById = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const weekDates = getWeekDates(weekOffset);
  const visibleClasses = classes
    .filter((c) => c.status === "Active")
    .filter((c) => !selectedSubject || c.subject === selectedSubject);
  const eventsByDay = {};
  DAYS.forEach((d) => (eventsByDay[d] = []));
  const studentIds = new Set();
  visibleClasses.forEach((c) => {
    c.sessions.forEach((s) => {
      // Skip sessions with no enrolled students — keeps the weekly grid focused
      // on classes that are actually running.
      if (!s.students || s.students.length === 0) return;
      if (!eventsByDay[s.day_of_week]) return;
      // Skip occurrences that fall outside the class's start/end date range
      // for the week currently being viewed.
      const occurrenceDateStr = toISODateString(weekDates[s.day_of_week]);
      if (!classActiveOnDate(c, occurrenceDateStr)) return;
      s.students.forEach((stu) => studentIds.add(stu.id));
      eventsByDay[s.day_of_week].push({
        id: s.id,
        class_id: c.id,
        class_name: c.name,
        subject: c.subject,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        startMin: toMinutes(s.start_time),
        endMin: toMinutes(s.end_time),
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        students: s.students,
      });
    });
  });
  const totalStudents = studentIds.size;
  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT;
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`;
  const weekRangeLabel = `${weekDates["Monday"].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDates["Sunday"].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="p-8 w-full">
      <div className="flex items-end justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Quick overview of what's happening across the school.
      </p>

      {/* ── Weekly schedule ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              This Week's Schedule
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Previous week"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <p className="text-xs text-slate-400 min-w-[150px]">
                {weekRangeLabel}
              </p>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Next week"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium underline ml-1"
                >
                  This week
                </button>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900 leading-tight">
              {totalStudents}
            </p>
            <p className="text-xs text-slate-400">
              {selectedSubject
                ? `Students in ${selectedSubject}`
                : "Total Students"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setSelectedSubject("")}
            className={pillClasses(selectedSubject === "")}
          >
            All Subjects
          </button>
          {Object.entries(SUBJECT_COLORS).map(([subject, c]) => (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              className={pillClasses(selectedSubject === subject, c)}
            >
              {subject}
            </button>
          ))}
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: 640 }}>
            <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
              <div
                style={{ width: GUTTER_WIDTH }}
                className="flex-shrink-0 bg-white"
              />
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="flex-1 text-center py-2 border-l border-slate-100 first:border-l-0 bg-white"
                >
                  <p className="text-sm font-semibold text-slate-600">
                    {day.slice(0, 3)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {weekDates[day].toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex">
              <div
                style={{ width: GUTTER_WIDTH, height: totalHeight }}
                className="relative flex-shrink-0"
              >
                {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
                  <div
                    key={h}
                    className="absolute right-1.5 text-[12px] text-slate-400"
                    style={{ top: h === 0 ? 2 : h * HOUR_HEIGHT - 10 }}
                  >
                    {hourLabel(h)}
                  </div>
                ))}
              </div>
              <div className="relative flex-1" style={{ height: totalHeight }}>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: hourLineGradient }}
                />
                <div className="absolute inset-0 grid grid-cols-7">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="relative border-l border-slate-100 first:border-l-0"
                    >
                      {layoutDayEvents(eventsByDay[day]).map((e) => {
                        const top = (e.startMin / 60) * HOUR_HEIGHT;
                        const height = Math.max(
                          ((e.endMin - e.startMin) / 60) * HOUR_HEIGHT,
                          30,
                        );
                        const widthPct = 100 / e.trackCount,
                          leftPct = e.track * widthPct;
                        const colors = colorFor(e.subject);
                        return (
                          <button
                            key={e.id}
                            onClick={() => setSelectedSession(e)}
                            className={`absolute ${colors.bg} ${colors.border} border rounded-md px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow text-left cursor-pointer`}
                            style={{
                              top,
                              height,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                            }}
                            title={`${e.class_name} · ${e.subject ?? ""} · ${formatTime(e.start_time)}–${formatTime(e.end_time)}`}
                          >
                            {e.subject && (
                              <p
                                className={`text-[10px] font-semibold ${colors.text} truncate leading-tight`}
                              >
                                {e.subject}
                              </p>
                            )}
                            <p
                              className={`text-[10px] ${colors.text} opacity-80 truncate leading-tight`}
                            >
                              {e.teacher_name ?? "Unassigned"}
                            </p>
                            <p
                              className={`text-[9px] ${colors.text} opacity-60 truncate leading-tight`}
                            >
                              {formatTime(e.start_time)}–
                              {formatTime(e.end_time)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Month picker (Student Attendance) ── */}
      <div className="flex items-center gap-3 mt-8 mb-2">
        <button
          onClick={tableMonth.prev}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-base font-semibold text-slate-800 min-w-[160px] text-center">
          {tableMonth.label}
        </span>
        <button
          onClick={tableMonth.next}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <AttendanceTable
        month={tableMonth.month}
        year={tableMonth.year}
        onSaved={refreshEnrollments}
      />
      <TeacherHoursTable />

      <NoticesTable
        notices={notices}
        dismissedKeys={dismissedKeys}
        onDismiss={dismissNotice}
        onShowDismissed={restoreDismissedNotices}
        dismissedCount={dismissedKeys.size}
      />

      {reviewsLoading ? (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm text-slate-400">Loading reviews…</p>
        </div>
      ) : (
        <ReviewsTable allReviews={allReviews} classes={classes} />
      )}

      {selectedSession && (
        <SessionModal
          session={selectedSession}
          teachersById={teachersById}
          onClose={() => setSelectedSession(null)}
          onUpdated={refreshClasses}
        />
      )}
    </div>
  );
}