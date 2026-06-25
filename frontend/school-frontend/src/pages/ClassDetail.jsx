import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getClass,
  getClassReviews,
  getTeachers,
  createStudentReview,
  deleteReview,
  createClassSession,
  updateClassSession,
  deleteClassSession,
  getAttendance,
  bulkUpsertAttendance,
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
const HOUR_HEIGHT = 44;
const TOTAL_HOURS = 24;
const GUTTER_WIDTH = 52;

const STATUS_STYLES = {
  Active: "bg-green-50 text-green-700",
  Completed: "bg-slate-100 text-slate-600",
  Cancelled: "bg-red-50 text-red-600",
};

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

function hourLabel(h) {
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${period}`;
}

// "09:00:00" -> "09:00" for <input type="time">
function toTimeInputValue(t) {
  return t ? t.slice(0, 5) : "";
}

// Most recent calendar date (YYYY-MM-DD) on/before today that falls on
// the given day-of-week. Sessions only store a recurring day-of-week,
// not a specific date, so this is used to auto-fill "Session date".
function mostRecentDateFor(dayOfWeek) {
  const targetIdx = DAYS.indexOf(dayOfWeek); // Monday = 0 ... Sunday = 6
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // JS Sun=0 -> Monday=0
  let diff = todayIdx - targetIdx;
  if (diff < 0) diff += 7;
  const result = new Date(today);
  result.setDate(today.getDate() - diff);
  return result.toISOString().slice(0, 10);
}

function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);
  const clusters = [];
  let current = [];
  let currentEnd = -Infinity;

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
    const trackEnds = [];
    const positioned = [];
    for (const e of cluster) {
      let track = trackEnds.findIndex((end) => end <= e.startMin);
      if (track === -1) {
        track = trackEnds.length;
        trackEnds.push(e.endMin);
      } else {
        trackEnds[track] = e.endMin;
      }
      positioned.push({ ...e, track });
    }
    const trackCount = trackEnds.length;
    positioned.forEach((e) => result.push({ ...e, trackCount }));
  }
  return result;
}

function WeeklySchedule({ sessions }) {
  const eventsByDay = {};
  DAYS.forEach((d) => (eventsByDay[d] = []));

  sessions.forEach((s) => {
    eventsByDay[s.day_of_week]?.push({
      id: s.id,
      teacher_name: s.teacher_name,
      start_time: s.start_time,
      end_time: s.end_time,
      startMin: toMinutes(s.start_time),
      endMin: toMinutes(s.end_time),
      studentCount: s.students.length,
    });
  });

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT;
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
          <div
            style={{ width: GUTTER_WIDTH }}
            className="flex-shrink-0 bg-white"
          />
          {DAYS.map((day) => (
            <div
              key={day}
              className="flex-1 text-center text-xs font-semibold text-slate-600 py-2 border-l border-slate-100 first:border-l-0 bg-white"
            >
              {day.slice(0, 3)}
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
                className="absolute right-1.5 text-[10px] text-slate-400"
                style={{ top: h * HOUR_HEIGHT + 2 }}
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
                      22,
                    );
                    const widthPct = 100 / e.trackCount;
                    const leftPct = e.track * widthPct;
                    return (
                      <div
                        key={e.id}
                        className="absolute bg-blue-100 border border-blue-300 rounded-md px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow"
                        style={{
                          top,
                          height,
                          left: `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        title={`${formatTime(e.start_time)} – ${formatTime(e.end_time)} · ${e.teacher_name ?? "Unassigned"}`}
                      >
                        <p className="text-[11px] font-medium text-blue-800 truncate leading-tight">
                          {formatTime(e.start_time)} – {formatTime(e.end_time)}
                        </p>
                        <p className="text-[10px] text-blue-500 truncate leading-tight">
                          {e.teacher_name ?? "Unassigned"}
                        </p>
                        <p className="text-[10px] text-blue-400 truncate leading-tight">
                          {e.studentCount} student
                          {e.studentCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function makeEmptySessionDraft() {
  return {
    day_of_week: "Monday",
    start_time: "09:00",
    end_time: "10:00",
    teacher_id: "",
  };
}

// One row in the session management list. Handles its own edit state
// so editing one session doesn't re-render the whole list's inputs.
function SessionRow({ session, teachers, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    day_of_week: session.day_of_week,
    start_time: toTimeInputValue(session.start_time),
    end_time: toTimeInputValue(session.end_time),
    teacher_id: session.teacher_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  function startEdit() {
    setDraft({
      day_of_week: session.day_of_week,
      start_time: toTimeInputValue(session.start_time),
      end_time: toTimeInputValue(session.end_time),
      teacher_id: session.teacher_id ?? "",
    });
    setErr(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      await onSave(session.id, {
        day_of_week: draft.day_of_week,
        start_time: draft.start_time,
        end_time: draft.end_time,
        teacher_id: draft.teacher_id ? Number(draft.teacher_id) : null,
      });
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {session.day_of_week.slice(0, 3)} {formatTime(session.start_time)}–
            {formatTime(session.end_time)}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {session.teacher_name ?? "Unassigned"} · {session.students.length}{" "}
            student
            {session.students.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <button
            onClick={startEdit}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(session)}
            className="text-xs text-red-400 hover:text-red-600 font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.day_of_week}
          onChange={(e) =>
            setDraft((p) => ({ ...p, day_of_week: e.target.value }))
          }
          className={inputClass}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={draft.teacher_id}
          onChange={(e) =>
            setDraft((p) => ({ ...p, teacher_id: e.target.value }))
          }
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={draft.start_time}
          onChange={(e) =>
            setDraft((p) => ({ ...p, start_time: e.target.value }))
          }
          className={inputClass}
        />
        <input
          type="time"
          value={draft.end_time}
          onChange={(e) =>
            setDraft((p) => ({ ...p, end_time: e.target.value }))
          }
          className={inputClass}
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-md"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ClassDetail() {
  const { id } = useParams();
  const [classData, setClassData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newSession, setNewSession] = useState(makeEmptySessionDraft());
  const [addingSession, setAddingSession] = useState(false);
  const [addSessionError, setAddSessionError] = useState(null);

  const [draft, setDraft] = useState(makeEmptyReviewDraft());
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const [rollCallSessionId, setRollCallSessionId] = useState("");
  const [rollCallDate, setRollCallDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [attendance, setAttendance] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);

  function makeEmptyReviewDraft() {
    return {
      session_id: "",
      student_id: "",
      review_date: "",
      session_content: "",
      review_text: "",
      session_result: "",
    };
  }

  function loadClass() {
    return getClass(id).then((data) => {
      setClassData(data);
      // Set default session for roll call if not already set
      if (data.sessions.length > 0 && !rollCallSessionId) {
        setRollCallSessionId(String(data.sessions[0].id));
      }
    });
  }
  function loadReviews() {
    return getClassReviews(id).then(setReviews);
  }

  async function handleSaveAttendance() {
    if (!rollCallSession || !rollCallDate) return;
    setSavingAttendance(true);
    setAttendanceError(null);
    setAttendanceSuccess(false);
    try {
      const records = Object.entries(attendance).map(([studentId, a]) => ({
        student_id: Number(studentId),
        session_id: Number(rollCallSessionId),
        teacher_id: rollCallSession.teacher_id || null,
        attendance_date: rollCallDate,
        attended: a.attended,
        note: a.note || null,
      }));
      await bulkUpsertAttendance(records);
      setAttendanceSuccess(true);
      setTimeout(() => setAttendanceSuccess(false), 3000);
    } catch (err) {
      setAttendanceError(err.message);
    } finally {
      setSavingAttendance(false);
    }
  }

  const rollCallSession = useMemo(
    () =>
      classData?.sessions.find((s) => String(s.id) === rollCallSessionId) ??
      null,
    [classData, rollCallSessionId],
  );

  useEffect(() => {
    if (!rollCallSession || !rollCallDate) return;
    setLoadingAttendance(true);

    getAttendance({
      session_id: rollCallSessionId,
      date_from: rollCallDate,
      date_to: rollCallDate,
    })
      .then((records) => {
        const existingMap = {};
        records.forEach((r) => {
          existingMap[r.student_id] = {
            attended: r.attended,
            note: r.note || "",
            record_id: r.id,
          };
        });
        // Merge with enrolled students — default to attended=true
        const merged = {};
        rollCallSession.students.forEach((s) => {
          merged[s.id] = existingMap[s.id] ?? {
            attended: true,
            note: "",
            record_id: null,
          };
        });
        setAttendance(merged);
      })
      .catch(() => {
        const merged = {};
        rollCallSession.students.forEach((s) => {
          merged[s.id] = { attended: true, note: "", record_id: null };
        });
        setAttendance(merged);
      })
      .finally(() => setLoadingAttendance(false));
  }, [rollCallSessionId, rollCallDate, rollCallSession]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadClass(), getTeachers().then(setTeachers), loadReviews()])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedSession = useMemo(
    () =>
      classData?.sessions.find(
        (s) => String(s.id) === String(draft.session_id),
      ) ?? null,
    [classData, draft.session_id],
  );

  // --- Session management ---
  async function handleAddSession(e) {
    e.preventDefault();
    setAddingSession(true);
    setAddSessionError(null);
    try {
      await createClassSession(id, {
        day_of_week: newSession.day_of_week,
        start_time: newSession.start_time,
        end_time: newSession.end_time,
        teacher_id: newSession.teacher_id
          ? Number(newSession.teacher_id)
          : null,
      });
      setNewSession(makeEmptySessionDraft());
      await loadClass();
    } catch (err) {
      setAddSessionError(err.message);
    } finally {
      setAddingSession(false);
    }
  }

  async function handleSaveSession(sessionId, payload) {
    await updateClassSession(sessionId, payload);
    await loadClass();
  }

  async function handleDeleteSession(session) {
    if (
      !confirm(
        `Delete the ${session.day_of_week} ${formatTime(session.start_time)} session? This can't be undone.`,
      )
    )
      return;
    try {
      await deleteClassSession(session.id);
      await loadClass();
    } catch (err) {
      alert("Error deleting session: " + err.message);
    }
  }

  // --- Review management ---
  function handleSessionChange(sessionId) {
    const session = classData.sessions.find(
      (s) => String(s.id) === String(sessionId),
    );
    setDraft((prev) => ({
      ...prev,
      session_id: sessionId,
      student_id: "",
      review_date: session ? mostRecentDateFor(session.day_of_week) : "",
    }));
  }

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddReview(e) {
    e.preventDefault();
    if (!selectedSession || !draft.student_id || !draft.review_date) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      await createStudentReview(draft.student_id, {
        student_id: Number(draft.student_id),
        session_id: Number(draft.session_id),
        teacher_id: selectedSession.teacher_id,
        review_date: draft.review_date,
        session_content: draft.session_content || null,
        review_text: draft.review_text || null,
        session_result: draft.session_result || null,
      });
      setDraft(makeEmptyReviewDraft());
      await loadReviews();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (err) {
      alert("Error deleting review: " + err.message);
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>;
  if (error) return <p className="p-8 text-red-500">{error}</p>;
  if (!classData) return null;

  return (
    <div className="p-8 w-full">
      <Link
        to="/classes"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Back to Classes
      </Link>

      {/* Class info card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {classData.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              {classData.subject && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700">
                  {classData.subject}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[classData.status] ?? "bg-slate-100 text-slate-600"}`}
              >
                {classData.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900 leading-tight">
              {classData.sessions.length}
            </p>
            <p className="text-xs text-slate-400">Sessions / week</p>
          </div>
        </div>

        {classData.description && (
          <p className="text-sm text-slate-600 mt-4">{classData.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Start Date</p>
            <p className="text-slate-800">{classData.start_date ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">End Date</p>
            <p className="text-slate-800">{classData.end_date ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Schedule + session management, side by side to use full width */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Schedule
          </h2>
          {classData.sessions.length === 0 ? (
            <p className="text-sm text-slate-400">
              No sessions scheduled for this class yet.
            </p>
          ) : (
            <WeeklySchedule sessions={classData.sessions} />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Manage Sessions
          </h2>

          {classData.sessions.length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">
              No sessions yet — add the first one below.
            </p>
          ) : (
            <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto pr-1">
              {classData.sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  teachers={teachers}
                  onSave={handleSaveSession}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
          )}

          <form
            onSubmit={handleAddSession}
            className="border-t border-slate-100 pt-4"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Add a session
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                value={newSession.day_of_week}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, day_of_week: e.target.value }))
                }
                className={inputClass}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={newSession.teacher_id}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, teacher_id: e.target.value }))
                }
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={newSession.start_time}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, start_time: e.target.value }))
                }
                className={inputClass}
              />
              <input
                type="time"
                value={newSession.end_time}
                onChange={(e) =>
                  setNewSession((p) => ({ ...p, end_time: e.target.value }))
                }
                className={inputClass}
              />
            </div>
            {addSessionError && (
              <p className="text-xs text-red-600 mb-2">{addSessionError}</p>
            )}
            <button
              type="submit"
              disabled={addingSession}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {addingSession ? "Adding..." : "Add Session"}
            </button>
          </form>
        </div>
      </div>

      {/* Session reviews */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Session Reviews
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Leave feedback for a student after a specific session.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[24%]" />
              <col className="w-[24%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Session Content</th>
                <th className="px-3 py-2">Teacher's Review</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {/* Add-new row */}
              <tr className="border-t border-slate-100 bg-blue-50/30">
                <td className="px-3 py-2 align-top">
                  <select
                    value={draft.session_id}
                    onChange={(e) => handleSessionChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Select —</option>
                    {classData.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={draft.student_id}
                    onChange={(e) => updateDraft("student_id", e.target.value)}
                    disabled={!selectedSession}
                    className={inputClass}
                  >
                    <option value="">— Select —</option>
                    {selectedSession?.students.map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.name}
                      </option>
                    ))}
                  </select>
                  {selectedSession && selectedSession.students.length === 0 && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      No students enrolled.
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="date"
                    value={draft.review_date}
                    onChange={(e) => updateDraft("review_date", e.target.value)}
                    disabled={!selectedSession}
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2 align-top text-slate-600">
                  {selectedSession
                    ? (selectedSession.teacher_name ?? "Unassigned")
                    : "—"}
                </td>
                <td className="px-3 py-2 align-top">
                  <textarea
                    rows={3}
                    value={draft.session_content}
                    onChange={(e) =>
                      updateDraft("session_content", e.target.value)
                    }
                    placeholder="What was covered..."
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <textarea
                    rows={3}
                    value={draft.review_text}
                    onChange={(e) => updateDraft("review_text", e.target.value)}
                    placeholder="Feedback..."
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={draft.session_result}
                    onChange={(e) =>
                      updateDraft("session_result", e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">—</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  <button
                    onClick={handleAddReview}
                    disabled={
                      !selectedSession ||
                      !draft.student_id ||
                      !draft.review_date ||
                      submitting
                    }
                    className="text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md whitespace-nowrap"
                  >
                    {submitting ? "..." : "Save"}
                  </button>
                </td>
              </tr>

              {/* Existing reviews */}
              {reviews.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-slate-600">
                    {r.day_of_week.slice(0, 3)}
                  </td>
                  <td className="px-3 py-2 text-slate-800 font-medium truncate">
                    {r.student_name}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.review_date}</td>
                  <td className="px-3 py-2 text-slate-600 truncate">
                    {r.teacher_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">
                    {r.session_content || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">
                    {r.review_text || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.session_result ? (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          r.session_result === "Pass"
                            ? "bg-green-50 text-green-700"
                            : r.session_result === "Fail"
                              ? "bg-red-50 text-red-600"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.session_result}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDeleteReview(r.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {reviews.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-4 text-center text-slate-400 text-sm"
                  >
                    No reviews yet for this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {reviewError && (
          <p className="text-sm text-red-600 mt-2">{reviewError}</p>
        )}
      </div>
      {/* Roll Call */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Roll Call</h2>
        <p className="text-xs text-slate-400 mb-4">
          Mark attendance for a session on a specific date.
        </p>

        {classData.sessions.length === 0 ? (
          <p className="text-sm text-slate-400">
            Add sessions to this class first.
          </p>
        ) : (
          <>
            {/* Controls */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Session
                </label>
                <select
                  value={rollCallSessionId}
                  onChange={(e) => setRollCallSessionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {classData.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.day_of_week} · {formatTime(s.start_time)}–
                      {formatTime(s.end_time)}
                      {s.teacher_name ? ` · ${s.teacher_name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={rollCallDate}
                  onChange={(e) => setRollCallDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {loadingAttendance ? (
              <p className="text-sm text-slate-400 py-4">Loading...</p>
            ) : !rollCallSession || rollCallSession.students.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                No students enrolled in this session yet.
              </p>
            ) : (
              <>
                {/* Summary */}
                {(() => {
                  const entries = Object.entries(attendance);
                  const present = entries.filter(([, a]) => a.attended).length;
                  const absent = entries.length - present;
                  return (
                    <div className="flex gap-3 mb-4">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                        Present: {present}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                        Absent: {absent}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        Total: {entries.length}
                      </span>
                    </div>
                  );
                })()}

                {/* Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Attendance</th>
                        <th className="px-4 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(attendance).map(([studentId, a]) => {
                        const student = rollCallSession.students.find(
                          (s) => String(s.id) === studentId,
                        );
                        return (
                          <tr
                            key={studentId}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {student?.name ?? `Student #${studentId}`}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() =>
                                  setAttendance((prev) => ({
                                    ...prev,
                                    [studentId]: {
                                      ...prev[studentId],
                                      attended: !prev[studentId].attended,
                                    },
                                  }))
                                }
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                                  a.attended
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-600 border-red-200"
                                }`}
                              >
                                {a.attended ? "Present" : "Absent"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={a.note || ""}
                                onChange={(e) =>
                                  setAttendance((prev) => ({
                                    ...prev,
                                    [studentId]: {
                                      ...prev[studentId],
                                      note: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Optional note"
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {attendanceError && (
                  <p className="text-sm text-red-600 mb-2">{attendanceError}</p>
                )}
                {attendanceSuccess && (
                  <p className="text-sm text-green-600 mb-2">
                    Attendance saved.
                  </p>
                )}

                <button
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingAttendance ? "Saving..." : "Save attendance"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
