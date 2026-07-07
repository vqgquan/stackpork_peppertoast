import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getStudentDetail,
  getClasses,
  createEnrollment,
  deleteEnrollment,
  endEnrollment,
  reactivateEnrollment,
  addSessionsToEnrollment,
  getStudentReviews,
  createStudentReview,
  deleteReview,
  getAttendance,
} from "../api";

const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const HOUR_HEIGHT = 44;
const TOTAL_HOURS = 24;
const GUTTER_WIDTH = 52;
const PAYMENT_METHODS = ["Tiền Mặt", "Chuyển khoản", "Pos"];
const NO_SUBJECT_LABEL = "Other";

// ─── Attendance status display config (read-only) ─────────────────────────
// Matches the same 4-state model used in the Dashboard / Class Detail roll
// call: Present and Absent (No Notice) consume a session, Absent (Notice)
// does not. There's no "no info" row here since we only ever render rows
// for records that actually exist.
const ATTENDANCE_STATUS_CONFIG = {
  present: {
    label: "Present",
    symbol: "✓",
    badgeClass: "bg-green-50 text-green-700 border border-green-200",
  },
  absent_notice: {
    label: "Absent (Notice)",
    symbol: "N",
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  absent_no_notice: {
    label: "Absent (No Notice)",
    symbol: "✗",
    badgeClass: "bg-red-50 text-red-600 border border-red-200",
  },
};
function attendanceStatusConfig(status) {
  return (
    ATTENDANCE_STATUS_CONFIG[status] ?? {
      label: status,
      symbol: "?",
      badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    }
  );
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hourLabel(h) {
  return `${String(h).padStart(2, "0")}:00`;
}

function durationMinutes(s) {
  return toMinutes(s.end_time) - toMinutes(s.start_time);
}

const DAY_TO_INDEX = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
};

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// All weekly occurrences of `dayOfWeek` between startDate and endDate (inclusive).
function occurrenceDatesInRange(dayOfWeek, startDate, endDate) {
  if (startDate > endDate) return [];
  const target = DAY_TO_INDEX[dayOfWeek];
  const startIdx = (startDate.getDay() + 6) % 7; // Monday = 0
  const delta = (target - startIdx + 7) % 7;
  const current = new Date(startDate);
  current.setDate(current.getDate() + delta);
  const dates = [];
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

function mostRecentDateFor(dayOfWeek) {
  const targetIdx = DAYS.indexOf(dayOfWeek);
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7;
  let diff = todayIdx - targetIdx;
  if (diff < 0) diff += 7;
  const result = new Date(today);
  result.setDate(today.getDate() - diff);
  return result.toISOString().slice(0, 10);
}

// Enrollment summary for a grouped card (total/remaining across all slots)
function enrollmentSummary(group) {
  const parts = [];
  if (group.total_sessions != null) {
    const remaining = group.remaining_sessions ?? group.total_sessions;
    parts.push(`${remaining}/${group.total_sessions} sessions left`);
  }
  if (group.price != null) parts.push(`${group.price.toLocaleString()}đ`);
  if (group.payment_method) parts.push(group.payment_method);
  if (group.discount) parts.push(`Discount: ${group.discount}`);
  return parts.join(" · ");
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
    const clusterPositioned = [];
    for (const e of cluster) {
      let track = trackEnds.findIndex((end) => end <= e.startMin);
      if (track === -1) { track = trackEnds.length; trackEnds.push(e.endMin); }
      else trackEnds[track] = e.endMin;
      clusterPositioned.push({ ...e, track });
    }
    const trackCount = trackEnds.length;
    clusterPositioned.forEach((e) => result.push({ ...e, trackCount }));
  }
  return result;
}

function WeeklyTimetable({ sessions }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 16;
  }, []);

  const eventsByDay = {};
  DAYS.forEach((d) => (eventsByDay[d] = []));
  sessions.forEach((s) => {
    const startMin = toMinutes(s.start_time);
    const endMin = toMinutes(s.end_time);
    if (eventsByDay[s.day_of_week]) {
      eventsByDay[s.day_of_week].push({
        id: s.session_id,
        class_name: s.class_name,
        teacher_name: s.teacher_name,
        start_time: s.start_time,
        end_time: s.end_time,
        startMin,
        endMin,
      });
    }
  });

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT;
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
          <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 bg-white" />
          {DAYS.map((day) => (
            <div key={day} className="flex-1 text-center text-xs font-semibold text-slate-600 py-2 border-l border-slate-100 first:border-l-0 bg-white">
              {day.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="flex">
          <div style={{ width: GUTTER_WIDTH, height: totalHeight }} className="relative flex-shrink-0">
            {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
              <div key={h} className="absolute right-1.5 text-[10px] text-slate-400" style={{ top: h * HOUR_HEIGHT + 2 }}>
                {hourLabel(h)}
              </div>
            ))}
          </div>
          <div className="relative flex-1" style={{ height: totalHeight }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: hourLineGradient }} />
            <div className="absolute inset-0 grid grid-cols-7">
              {DAYS.map((day) => (
                <div key={day} className="relative border-l border-slate-100 first:border-l-0">
                  {layoutDayEvents(eventsByDay[day]).map((e) => {
                    const top = (e.startMin / 60) * HOUR_HEIGHT;
                    const height = Math.max(((e.endMin - e.startMin) / 60) * HOUR_HEIGHT, 22);
                    const widthPct = 100 / e.trackCount;
                    const leftPct = e.track * widthPct;
                    return (
                      <div
                        key={e.id}
                        className="absolute bg-blue-100 border border-blue-300 rounded-md px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow"
                        style={{ top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` }}
                        title={`${e.class_name} · ${formatTime(e.start_time)} – ${formatTime(e.end_time)}${e.teacher_name ? ` · ${e.teacher_name}` : ""}`}
                      >
                        <p className="text-[11px] font-medium text-blue-800 truncate leading-tight">{e.class_name}</p>
                        <p className="text-[10px] text-blue-500 truncate leading-tight">{formatTime(e.start_time)} – {formatTime(e.end_time)}</p>
                        {e.teacher_name && <p className="text-[10px] text-blue-400 truncate leading-tight">{e.teacher_name}</p>}
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

const inputClass = "w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

function makeEmptyEnrollDraft() {
  return { subject: "", class_id: "", session_ids: [], total_sessions: "", price: "", payment_method: "", discount: "" };
}

function makeEmptyReviewDraft() {
  return { subject: "", class_id: "", session_id: "", review_date: "", session_content: "", review_text: "", session_result: "" };
}

function pastEnrollmentStatusClass(status) {
  if (status === "Completed") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600"; // Dropped
}

function resultBadgeClass(result) {
  if (result === "Pass") return "bg-green-50 text-green-700";
  if (result === "Fail") return "bg-red-50 text-red-600";
  if (result === "Unattended") return "bg-orange-50 text-orange-600";
  return "bg-slate-100 text-slate-600";
}

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [draft, setDraft] = useState(makeEmptyEnrollDraft());
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewDraft, setReviewDraft] = useState(makeEmptyReviewDraft());
  const [reviewError, setReviewError] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [endingId, setEndingId] = useState(null);
  const [endDate, setEndDate] = useState("");
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [endError, setEndError] = useState(null);
  const [reactivatingId, setReactivatingId] = useState(null);

  const [addingId, setAddingId] = useState(null);
  const [addSessionsCount, setAddSessionsCount] = useState("");
  const [addSessionsPrice, setAddSessionsPrice] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);

  // Attendance History filters (Subject > Class), month navigation, and read-only data
  const [attSubject, setAttSubject] = useState("");
  const [attClassId, setAttClassId] = useState("");
  const [attMonth, setAttMonth] = useState(() => new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(() => new Date().getFullYear());
  const [attRecords, setAttRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState(null);
  const [openAttCell, setOpenAttCell] = useState(null); // { date, session_id } | null

  function loadStudent() {
    return getStudentDetail(id).then((data) => setStudent(data));
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      loadStudent(),
      getClasses().then(setAllClasses),
      getStudentReviews(id).then(setReviews),
    ])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const activeClasses = useMemo(() => allClasses.filter((c) => c.status === "Active"), [allClasses]);

  // All session_ids this student is currently enrolled in (across all enrollments)
  const enrolledSessionIds = useMemo(
    () => new Set(student ? student.sessions.map((s) => s.session_id) : []),
    [student],
  );

  const subjects = useMemo(() => {
    const set = new Set(activeClasses.map((c) => c.subject || NO_SUBJECT_LABEL));
    return Array.from(set).sort();
  }, [activeClasses]);

  function classesForSubject(subject) {
    return activeClasses.filter((c) => (c.subject || NO_SUBJECT_LABEL) === subject);
  }

  function sessionsForClass(classId) {
    const cls = activeClasses.find((c) => String(c.id) === String(classId));
    if (!cls) return [];
    return cls.sessions.filter((s) => !enrolledSessionIds.has(s.id));
  }

  // Review form — scoped to sessions this student is actually enrolled in
  const reviewSubjects = useMemo(() => {
    if (!student) return [];
    const set = new Set(student.sessions.map((s) => s.subject || NO_SUBJECT_LABEL));
    return Array.from(set).sort();
  }, [student]);

  function reviewClassesForSubject(subject) {
    if (!student) return [];
    const seen = new Map();
    student.sessions
      .filter((s) => (s.subject || NO_SUBJECT_LABEL) === subject)
      .forEach((s) => seen.set(s.class_id, s.class_name));
    return Array.from(seen, ([class_id, class_name]) => ({ class_id, class_name }));
  }

  function reviewSessionsForClass(classId) {
    if (!student) return [];
    return student.sessions.filter((s) => String(s.class_id) === String(classId));
  }

  const selectedReviewSession = useMemo(() => {
    if (!student) return null;
    return student.sessions.find((s) => String(s.session_id) === String(reviewDraft.session_id)) ?? null;
  }, [student, reviewDraft.session_id]);

  const sessionLookup = useMemo(() => {
    const map = new Map();
    if (student) student.sessions.forEach((s) => map.set(String(s.session_id), s));
    return map;
  }, [student]);

  // Group student.sessions by enrollment_id for the enrolled sessions card UI
  const enrollmentGroups = useMemo(() => {
    if (!student) return [];
    const map = new Map();
    for (const s of student.sessions) {
      if (!map.has(s.enrollment_id)) {
        map.set(s.enrollment_id, {
          enrollment_id: s.enrollment_id,
          class_id: s.class_id,
          class_name: s.class_name,
          subject: s.subject,
          enrolled_date: s.enrolled_date,
          total_sessions: s.total_sessions,
          remaining_sessions: s.remaining_sessions,
          price: s.price,
          payment_method: s.payment_method,
          discount: s.discount,
          slots: [],
        });
      }
      map.get(s.enrollment_id).slots.push(s);
    }
    // Sort slots within each group by day then time
    for (const group of map.values()) {
      group.slots.sort(
        (a, b) =>
          DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
          a.start_time.localeCompare(b.start_time),
      );
    }
    return Array.from(map.values());
  }, [student]);

  // Flattened past-enrollment history (memoised so it's available before the
  // early-return checks below and can be reused by the attendance grid).
  const pastEnrollments = useMemo(() => (student ? (student.past_enrollments ?? []) : []), [student]);

  // ─── Attendance History: classes (active or past) this student has ever
  // been linked to, grouped by subject, each carrying every session_id
  // (weekly slot) tied to that class so we can pull the full attendance
  // history regardless of whether the enrollment is still active.
  const attendanceClasses = useMemo(() => {
    if (!student) return [];
    const map = new Map(); // class_id -> { class_id, class_name, subject, session_ids: Set, sessionMeta: Map }
    const upsert = (classId, className, subject, sessionId, meta) => {
      if (!map.has(classId)) {
        map.set(classId, {
          class_id: classId,
          class_name: className,
          subject: subject || NO_SUBJECT_LABEL,
          session_ids: new Set(),
        });
      }
      if (sessionId != null) map.get(classId).session_ids.add(sessionId);
    };
    student.sessions.forEach((s) =>
      upsert(s.class_id, s.class_name, s.subject, s.session_id),
    );
    (student.past_enrollments ?? []).forEach((p) =>
      p.slots.forEach((s) =>
        upsert(s.class_id, s.class_name, s.subject, s.session_id),
      ),
    );
    return Array.from(map.values()).map((g) => ({
      ...g,
      session_ids: Array.from(g.session_ids),
    }));
  }, [student]);

  const attendanceSubjects = useMemo(() => {
    const set = new Set(attendanceClasses.map((c) => c.subject));
    return Array.from(set).sort();
  }, [attendanceClasses]);

  function attendanceClassesForSubject(subject) {
    return attendanceClasses.filter((c) => c.subject === subject);
  }

  const selectedAttClass = useMemo(
    () => attendanceClasses.find((c) => String(c.class_id) === String(attClassId)) ?? null,
    [attendanceClasses, attClassId],
  );

  // Resolve the underlying enrollment (active, else most recent past) behind
  // the selected class, so the read-only grid can show its pack size, price,
  // and per-slot schedule alongside the attendance symbols.
  const selectedEnrollmentInfo = useMemo(() => {
    if (!selectedAttClass) return null;
    const active = enrollmentGroups.find((g) => String(g.class_id) === String(selectedAttClass.class_id));
    if (active) {
      return {
        enrolled_date: active.enrolled_date,
        total_sessions: active.total_sessions,
        remaining_sessions: active.remaining_sessions,
        price: active.price,
        slots: active.slots,
      };
    }
    const past = pastEnrollments
      .filter((p) => p.slots.some((s) => String(s.class_id) === String(selectedAttClass.class_id)))
      .sort((a, b) => (b.end_date || b.enrolled_date).localeCompare(a.end_date || a.enrolled_date))[0];
    if (past) {
      return {
        enrolled_date: past.enrolled_date,
        total_sessions: past.total_sessions,
        remaining_sessions: past.remaining_sessions,
        price: past.price,
        slots: past.slots,
      };
    }
    return null;
  }, [selectedAttClass, enrollmentGroups, pastEnrollments]);

  // All date columns to display for the current month: every scheduled
  // occurrence of each slot from the enrollment date onward, plus any date
  // that happens to have an actual attendance record (e.g. a make-up class).
  const attDateColumns = useMemo(() => {
    if (!selectedEnrollmentInfo) return [];
    const monthStart = new Date(attYear, attMonth - 1, 1);
    const monthEnd = new Date(attYear, attMonth, 0);
    const enrollDate = selectedEnrollmentInfo.enrolled_date
      ? new Date(selectedEnrollmentInfo.enrolled_date + "T00:00:00")
      : monthStart;
    const rangeStart = enrollDate > monthStart ? enrollDate : monthStart;
    const map = new Map(); // dateStr -> session_id
    (selectedEnrollmentInfo.slots || []).forEach((slot) => {
      occurrenceDatesInRange(slot.day_of_week, rangeStart, monthEnd).forEach((d) => {
        map.set(toISODate(d), slot.session_id);
      });
    });
    attRecords.forEach((r) => {
      if (!map.has(r.attendance_date)) map.set(r.attendance_date, r.session_id);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, session_id]) => ({ date, session_id }));
  }, [selectedEnrollmentInfo, attMonth, attYear, attRecords]);

  function attStatusFor(dateStr, sessionId) {
    const rec = attRecords.find((r) => r.attendance_date === dateStr && r.session_id === sessionId);
    return rec ? rec.status : "none";
  }
  function attNoteFor(dateStr, sessionId) {
    const rec = attRecords.find((r) => r.attendance_date === dateStr && r.session_id === sessionId);
    return rec?.note || null;
  }

  function attPrevMonth() {
    if (attMonth === 1) { setAttMonth(12); setAttYear((y) => y - 1); }
    else setAttMonth((m) => m - 1);
  }
  function attNextMonth() {
    if (attMonth === 12) { setAttMonth(1); setAttYear((y) => y + 1); }
    else setAttMonth((m) => m + 1);
  }

  function updateAttSubject(value) {
    setAttSubject(value);
    setAttClassId("");
    setAttRecords([]);
    setAttError(null);
  }

  function updateAttClass(value) {
    setAttClassId(value);
  }

  useEffect(() => {
    if (!selectedEnrollmentInfo || !selectedEnrollmentInfo.slots?.length) {
      setAttRecords([]);
      return;
    }
    const sessionIds = [...new Set(selectedEnrollmentInfo.slots.map((s) => s.session_id))];
    const monthStart = new Date(attYear, attMonth - 1, 1);
    const monthEnd = new Date(attYear, attMonth, 0);
    setAttLoading(true);
    setAttError(null);
    Promise.all(
      sessionIds.map((sessionId) =>
        getAttendance({
          student_id: Number(id),
          session_id: sessionId,
          date_from: toISODate(monthStart),
          date_to: toISODate(monthEnd),
        }),
      ),
    )
      .then((lists) => setAttRecords(lists.flat()))
      .catch((e) => setAttError(e.message))
      .finally(() => setAttLoading(false));
  }, [selectedEnrollmentInfo, attMonth, attYear, id]);

  function updateDraft(field, value) {
    setDraft((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "subject") { updated.class_id = ""; updated.session_ids = []; }
      else if (field === "class_id") { updated.session_ids = []; }
      return updated;
    });
  }

  function toggleSession(sessionId) {
    setDraft((prev) => {
      const idStr = String(sessionId);
      const already = prev.session_ids.map(String).includes(idStr);
      const session_ids = already
        ? prev.session_ids.filter((sid) => String(sid) !== idStr)
        : [...prev.session_ids, sessionId];
      return { ...prev, session_ids };
    });
  }

  async function handleEnroll(e) {
    e.preventDefault();
    if (draft.session_ids.length === 0) return;
    setEnrolling(true);
    setEnrollError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // One enrollment covering all selected sessions as a shared pool
      await createEnrollment({
        student_id: Number(id),
        session_ids: draft.session_ids.map(Number),
        enrolled_date: today,
        status: "Enrolled",
        total_sessions: draft.total_sessions !== "" ? Number(draft.total_sessions) : null,
        price: draft.price !== "" ? Number(draft.price) : null,
        payment_method: draft.payment_method || null,
        discount: draft.discount || null,
      });
      setDraft(makeEmptyEnrollDraft());
      await loadStudent();
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(enrollmentId, className) {
    if (!confirm(`Permanently delete "${className}" and all its history for this student? This can't be undone.`)) return;
    try {
      await deleteEnrollment(enrollmentId);
      await loadStudent();
    } catch (err) {
      alert("Error removing enrollment: " + err.message);
    }
  }

  function startEndEnrollment(enrollmentId) {
    setEndingId(enrollmentId);
    setEndDate(new Date().toISOString().slice(0, 10));
    setEndError(null);
  }

  function handleEndEnrollmentClick(group) {
    if (!confirm(`End enrollment for "${group.class_name}"? You'll be asked to set an exit date next.`)) return;
    startEndEnrollment(group.enrollment_id);
  }

  function cancelEndEnrollment() {
    setEndingId(null);
    setEndError(null);
  }

  async function confirmEndEnrollment(enrollmentId) {
    if (!endDate) return;
    setEndSubmitting(true);
    setEndError(null);
    try {
      await endEnrollment(enrollmentId, { end_date: endDate, status: "Dropped" });
      setEndingId(null);
      await loadStudent();
    } catch (err) {
      setEndError(err.message);
    } finally {
      setEndSubmitting(false);
    }
  }

  async function handleReactivate(enrollmentId) {
    setReactivatingId(enrollmentId);
    try {
      await reactivateEnrollment(enrollmentId);
      await loadStudent();
    } catch (err) {
      alert("Error reactivating enrollment: " + err.message);
    } finally {
      setReactivatingId(null);
    }
  }

  function startAddSessions(enrollmentId) {
    setAddingId(enrollmentId);
    setAddSessionsCount("");
    setAddSessionsPrice("");
    setAddError(null);
  }

  function cancelAddSessions() {
    setAddingId(null);
    setAddError(null);
  }

  async function confirmAddSessions(enrollmentId) {
    const count = Number(addSessionsCount);
    if (!count || count <= 0) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      await addSessionsToEnrollment(enrollmentId, {
        additional_sessions: count,
        additional_price: addSessionsPrice !== "" ? Number(addSessionsPrice) : null,
      });
      setAddingId(null);
      await loadStudent();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSubmitting(false);
    }
  }

  function updateReviewDraft(field, value) {
    setReviewDraft((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "subject") { updated.class_id = ""; updated.session_id = ""; updated.review_date = ""; }
      else if (field === "class_id") { updated.session_id = ""; updated.review_date = ""; }
      else if (field === "session_id") {
        const session = student.sessions.find((s) => String(s.session_id) === String(value));
        updated.review_date = session ? mostRecentDateFor(session.day_of_week) : "";
      }
      return updated;
    });
  }

  async function handleAddReview(e) {
    e.preventDefault();
    if (!selectedReviewSession || !reviewDraft.review_date) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await createStudentReview(id, {
        student_id: Number(id),
        session_id: Number(reviewDraft.session_id),
        teacher_id: selectedReviewSession.teacher_id,
        review_date: reviewDraft.review_date,
        session_content: reviewDraft.session_content || null,
        review_text: reviewDraft.review_text || null,
        session_result: reviewDraft.session_result || null,
      });
      setReviewDraft(makeEmptyReviewDraft());
      await getStudentReviews(id).then(setReviews);
      await loadStudent();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReview(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      await loadStudent();
    } catch (err) {
      alert("Error deleting review: " + err.message);
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>;
  if (error) return <p className="p-8 text-red-500">{error}</p>;
  if (!student) return null;

  const classOptions = draft.subject ? classesForSubject(draft.subject) : [];
  const sessionOptions = draft.class_id ? sessionsForClass(draft.class_id) : [];
  const reviewClassOptions = reviewDraft.subject ? reviewClassesForSubject(reviewDraft.subject) : [];
  const reviewSessionOptions = reviewDraft.class_id ? reviewSessionsForClass(reviewDraft.class_id) : [];
  const attClassOptions = attSubject ? attendanceClassesForSubject(attSubject) : [];

  return (
    <div className="p-8 w-full">
      <Link to="/students" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Students
      </Link>

      {/* Profile card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{student.name}</h1>
            {student.gender && (
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${student.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>
                {student.gender}
              </span>
            )}
            {student.customer_group && (
              <span className="inline-block mt-1 ml-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                {student.customer_group}
              </span>
            )}
          </div>
          {student.customer_source && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
              Source: {student.customer_source}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
          <Info label="Phone" value={student.phone} />
          <Info label="Email" value={student.email} />
          <Info label="Date of Birth" value={student.date_of_birth} />
          <Info label="Address" value={student.address} className="col-span-2" />
        </div>
        {(student.parent_name || student.parent_phone) && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Parent / Guardian</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Info label="Name" value={student.parent_name} />
              <Info label="Phone" value={student.parent_phone} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Schedule</h2>
          {student.sessions.length === 0 ? (
            <p className="text-sm text-slate-400">This student has no scheduled sessions yet.</p>
          ) : (
            <WeeklyTimetable sessions={student.sessions} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Enroll form */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Enroll in a Class</h2>

            <form onSubmit={handleEnroll}>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className={labelClass}>Subject</label>
                  <select value={draft.subject} onChange={(e) => updateDraft("subject", e.target.value)} className={inputClass}>
                    <option value="">— Select —</option>
                    {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Class</label>
                  <select value={draft.class_id} onChange={(e) => updateDraft("class_id", e.target.value)} disabled={!draft.subject} className={inputClass}>
                    <option value="">— Select —</option>
                    {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className={labelClass}>
                  Sessions{" "}
                  {draft.class_id && (
                    <span className="text-slate-400 font-normal">(select one or more — shared pool)</span>
                  )}
                </label>
                {!draft.class_id ? (
                  <p className="text-xs text-slate-400 italic px-1">Choose a class first.</p>
                ) : sessionOptions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">No available sessions — the student may already be enrolled in all of them.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {sessionOptions.map((s) => {
                      const checked = draft.session_ids.map(String).includes(String(s.id));
                      return (
                        <label key={s.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs border rounded-lg cursor-pointer transition-colors ${checked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSession(s.id)} className="accent-blue-600" />
                          <span className="flex-1">{s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                          <span className="text-slate-500">{s.teacher_name || "Unassigned"}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className={labelClass}>Total Sessions</label>
                  <input type="number" min="1" value={draft.total_sessions} onChange={(e) => updateDraft("total_sessions", e.target.value)} placeholder="e.g. 6" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Price</label>
                  <input type="number" min="0" value={draft.price} onChange={(e) => updateDraft("price", e.target.value)} placeholder="VNĐ" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select value={draft.payment_method} onChange={(e) => updateDraft("payment_method", e.target.value)} className={inputClass}>
                    <option value="">— Select —</option>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Discount</label>
                  <input type="text" value={draft.discount} onChange={(e) => updateDraft("discount", e.target.value)} placeholder="e.g. 10% or 200,000đ" className={inputClass} />
                </div>
              </div>

              {draft.session_ids.length > 1 && (
                <p className="text-xs text-slate-400 mb-3 italic">
                  {draft.total_sessions !== ""
                    ? `${draft.total_sessions} sessions shared across all ${draft.session_ids.length} selected slots. `
                    : ""}
                  Price and payment apply to the whole pack.
                </p>
              )}

              {enrollError && <p className="text-xs text-red-600 mb-2">{enrollError}</p>}

              <button
                type="submit"
                disabled={draft.session_ids.length === 0 || enrolling}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {enrolling ? "Enrolling..." : draft.session_ids.length > 1 ? `Enroll in ${draft.session_ids.length} slots (shared pack)` : "Enroll"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Enrolled Sessions */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-5">Enrolled Sessions</h2>

        {enrollmentGroups.length === 0 ? (
          <p className="text-base text-slate-400">Not enrolled in any class sessions yet.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {enrollmentGroups.map((group) => {
              const isExhausted =
                group.total_sessions != null && (group.remaining_sessions ?? group.total_sessions) <= 0;
              const isEnding = endingId === group.enrollment_id;
              const attended =
                group.total_sessions != null
                  ? group.total_sessions - (group.remaining_sessions ?? group.total_sessions)
                  : null;
              const pct =
                group.total_sessions != null
                  ? Math.min(100, Math.max(0, (attended / group.total_sessions) * 100))
                  : null;
              const isAdding = addingId === group.enrollment_id;
              return (
                <div key={group.enrollment_id} className="border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-semibold text-slate-800 truncate">{group.class_name}</p>
                        {group.subject && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium flex-shrink-0">
                            {group.subject}
                          </span>
                        )}
                        {isExhausted && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium flex-shrink-0">
                            Exhausted
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {group.slots.length} {group.slots.length === 1 ? "session" : "sessions"} per week
                      </p>
                    </div>
                    {group.enrolled_date && (
                      <p className="text-xs text-slate-400 flex-shrink-0 text-right whitespace-nowrap">
                        Enrolled<br />{group.enrolled_date}
                      </p>
                    )}
                  </div>

                  {/* All slots for this enrollment */}
                  <div className="space-y-1.5">
                    {group.slots.map((s) => (
                      <div key={s.session_id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700 font-medium truncate">
                          {s.day_of_week} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          <span className="text-slate-400 font-normal"> · {s.teacher_name || "Unassigned"}</span>
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{durationMinutes(s)} min</span>
                      </div>
                    ))}
                  </div>

                  {group.total_sessions != null && (
                    <div>
                      <div className="flex items-center justify-between text-sm text-slate-500 mb-1.5">
                        <span>Sessions used</span>
                        <span className="font-medium text-slate-600">{attended} / {group.total_sessions}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isExhausted ? "bg-red-400" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {(group.price != null || group.payment_method || group.discount) && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-slate-100 pt-3">
                      {group.price != null && <Info label="Price" value={`${group.price.toLocaleString()}đ`} />}
                      {group.payment_method && <Info label="Payment Method" value={group.payment_method} />}
                      {group.discount && <Info label="Discount" value={group.discount} className="col-span-2" />}
                    </div>
                  )}

                  {isExhausted && !isEnding && (
                    <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-700">
                        No sessions remaining — the student has dropped off this class's roster. Renew or end the enrollment.
                      </p>
                    </div>
                  )}

                  {isEnding && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                      <p className="text-sm text-amber-800 mb-2">
                        Mark <span className="font-semibold">{group.class_name}</span> as ended. This keeps the enrollment's history (attended sessions, reviews) but removes it from the active roster.
                      </p>
                      <label className="block text-xs font-medium text-amber-700 mb-1">Exit date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      />
                      {endError && <p className="text-xs text-red-600 mt-1.5">{endError}</p>}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={cancelEndEnrollment}
                          disabled={endSubmitting}
                          className="flex-1 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmEndEnrollment(group.enrollment_id)}
                          disabled={endSubmitting || !endDate}
                          className="flex-1 py-1.5 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white"
                        >
                          {endSubmitting ? "Saving..." : "Confirm"}
                        </button>
                      </div>
                    </div>
                  )}

                  {isAdding && (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-800 mb-2">
                        Add more sessions to <span className="font-semibold">{group.class_name}</span>'s pack.
                        {group.total_sessions != null && (
                          <> Currently {group.total_sessions} total.</>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Sessions to add</label>
                          <input
                            type="number"
                            min="1"
                            value={addSessionsCount}
                            onChange={(e) => setAddSessionsCount(e.target.value)}
                            placeholder="e.g. 4"
                            className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Additional price (optional)</label>
                          <input
                            type="number"
                            min="0"
                            value={addSessionsPrice}
                            onChange={(e) => setAddSessionsPrice(e.target.value)}
                            placeholder="VNĐ"
                            className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                          />
                        </div>
                      </div>
                      {addError && <p className="text-xs text-red-600 mt-1.5">{addError}</p>}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={cancelAddSessions}
                          disabled={addSubmitting}
                          className="flex-1 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => confirmAddSessions(group.enrollment_id)}
                          disabled={addSubmitting || !addSessionsCount || Number(addSessionsCount) <= 0}
                          className="flex-1 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
                        >
                          {addSubmitting ? "Saving..." : "Confirm"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-auto pt-1">
                    <button
                      onClick={() => startAddSessions(group.enrollment_id)}
                      className="py-2 px-1 text-xs sm:text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      Buy More Sessions
                    </button>
                    <button
                      onClick={() => handleEndEnrollmentClick(group)}
                      className="py-2 px-1 text-xs sm:text-sm font-medium rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                    >
                      End Enrollment
                    </button>
                    <button
                      onClick={() => handleUnenroll(group.enrollment_id, group.class_name)}
                      className="py-2 px-1 text-xs sm:text-sm font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past enrollments */}
      {pastEnrollments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Past Enrollments</h2>
          <p className="text-xs text-slate-400 mb-4">Classes this student has ended or completed. History is kept for reference.</p>
          <div className="space-y-2">
            {pastEnrollments.map((p) => (
              <div key={p.enrollment_id} className="border border-slate-100 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {p.slots[0]?.class_name ?? "—"}
                      </p>
                      {p.slots[0]?.subject && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 flex-shrink-0">
                          {p.slots[0].subject}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${pastEnrollmentStatusClass(p.status)}`}>
                        {p.status}
                      </span>
                    </div>
                    {p.slots.map((s) => (
                      <p key={s.session_id} className="text-xs text-slate-400 truncate">
                        {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                        {s.teacher_name && ` · ${s.teacher_name}`}
                      </p>
                    ))}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.enrolled_date} → {p.end_date ?? "—"}
                      {p.total_sessions != null
                        ? ` · ${p.attended_sessions}/${p.total_sessions} sessions attended`
                        : ` · ${p.attended_sessions} sessions attended`}
                      {p.price != null && ` · ${p.price.toLocaleString()}đ`}
                      {p.payment_method && ` · ${p.payment_method}`}
                      {p.discount && ` · Discount: ${p.discount}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReactivate(p.enrollment_id)}
                    disabled={reactivatingId === p.enrollment_id}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0 disabled:opacity-50 whitespace-nowrap"
                  >
                    {reactivatingId === p.enrollment_id ? "Reactivating..." : "Reactivate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance History (read-only) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Attendance History</h2>
        <p className="text-xs text-slate-400 mb-4">
          Read-only record of past attendance. Select a subject and class, then browse by month.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4 max-w-md">
          <div>
            <label className={labelClass}>Subject</label>
            <select
              value={attSubject}
              onChange={(e) => updateAttSubject(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {attendanceSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <select
              value={attClassId}
              onChange={(e) => updateAttClass(e.target.value)}
              disabled={!attSubject}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {attClassOptions.map((c) => (
                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
              ))}
            </select>
          </div>
        </div>

        {attendanceClasses.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            This student has no enrollment history to show attendance for.
          </p>
        ) : !attClassId ? (
          <p className="text-sm text-slate-400 italic">
            Choose a subject and class to view attendance history.
          </p>
        ) : !selectedEnrollmentInfo ? (
          <p className="text-sm text-slate-400 italic">
            No enrollment record found for this class.
          </p>
        ) : (
          <>
            {/* Month navigation */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={attPrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-slate-800 min-w-[130px] text-center">
                {new Date(attYear, attMonth - 1, 1).toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={attNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
                title="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {Object.entries(ATTENDANCE_STATUS_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold ${cfg.badgeClass}`}>
                    {cfg.symbol}
                  </span>
                  <span className="text-xs text-slate-600">{cfg.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                  −
                </span>
                <span className="text-xs text-slate-600">No Info</span>
              </div>
              <span className="text-xs text-slate-400 ml-auto">Click a cell for details</span>
            </div>

            {attLoading ? (
              <p className="text-sm text-slate-400">Loading attendance…</p>
            ) : attError ? (
              <p className="text-sm text-red-500">{attError}</p>
            ) : attDateColumns.length === 0 ? (
              <p className="text-sm text-slate-400">No sessions scheduled this month for this class.</p>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="text-sm border border-slate-200 rounded-lg"
                  style={{ minWidth: `${520 + attDateColumns.length * 56}px` }}
                >
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                      <th className="px-3 py-2 min-w-[210px]">Schedule</th>
                      <th className="px-3 py-2 min-w-[90px]">Subject</th>
                      <th className="px-3 py-2 min-w-[130px]">Teacher</th>
                      {attDateColumns.map((col, i) => {
                        const dt = new Date(col.date + "T00:00:00");
                        return (
                          <th key={col.date} className="py-2 w-14 text-center">
                            <div className="text-sm font-bold text-slate-700 leading-tight">{i + 1}</div>
                            <div className="text-[10px] font-normal text-slate-500 leading-tight">
                              {String(dt.getDate()).padStart(2, "0")}/{String(dt.getMonth() + 1).padStart(2, "0")}
                            </div>
                          </th>
                        );
                      })}
                      <th className="px-2 py-2 w-16 text-center">Total</th>
                      <th className="px-2 py-2 w-16 text-center">Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-500 leading-snug align-middle">
                        {selectedEnrollmentInfo.slots
                          .slice()
                          .sort(
                            (a, b) =>
                              DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
                              a.start_time.localeCompare(b.start_time),
                          )
                          .map((s) => `${s.day_of_week.slice(0, 3)} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`)
                          .join(" & ")}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {selectedAttClass.subject && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                            {selectedAttClass.subject}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 align-middle">
                        {[...new Set(selectedEnrollmentInfo.slots.map((s) => s.teacher_name).filter(Boolean))].join(", ") || "—"}
                      </td>
                      {attDateColumns.map((col) => {
                        const status = attStatusFor(col.date, col.session_id);
                        const isNone = status === "none";
                        const cfg = attendanceStatusConfig(status);
                        return (
                          <td key={col.date} className="w-14 text-center border-l border-slate-100 p-0 align-middle">
                            <button
                              onClick={() => setOpenAttCell({ date: col.date, session_id: col.session_id })}
                              title={`${col.date} — ${cfg.label}`}
                              className={`w-full h-9 flex items-center justify-center text-base font-bold transition-colors ${
                                isNone
                                  ? "bg-slate-50 text-slate-300 hover:bg-slate-100"
                                  : `${cfg.badgeClass} hover:brightness-95`
                              }`}
                            >
                              {isNone ? "−" : cfg.symbol}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center text-sm font-semibold text-slate-700 align-middle">
                        {selectedEnrollmentInfo.total_sessions ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center text-sm font-semibold text-slate-700 align-middle">
                        {selectedEnrollmentInfo.remaining_sessions ?? "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Attendance cell note popup */}
      {openAttCell && (
        <div
          className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpenAttCell(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">{openAttCell.date}</p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {attendanceStatusConfig(attStatusFor(openAttCell.date, openAttCell.session_id)).label}
                </h3>
              </div>
              <button
                onClick={() => setOpenAttCell(null)}
                className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Note</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {attNoteFor(openAttCell.date, openAttCell.session_id) || "No note recorded for this session."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session reviews */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Session Reviews</h2>
        <p className="text-xs text-slate-400 mb-4">Feedback left by teachers for this student.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
            <colgroup>
              <col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[8%]" />
              <col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[24.5%]" /><col className="w-[24.5%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2">Subject</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Teacher</th>
                <th className="px-3 py-2">Session Content</th><th className="px-3 py-2">Teacher's Review</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const session = sessionLookup.get(String(r.session_id));
                return (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-600 truncate">{session?.subject || "—"}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium truncate">{session?.class_name || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{session ? session.day_of_week.slice(0, 3) : "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.review_date}</td>
                    <td className="px-3 py-2 text-slate-600 truncate">{session?.teacher_name || r.teacher_name || "Unassigned"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">{r.session_content || "—"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-pre-wrap break-words">
                      <div className="flex items-start justify-between gap-2">
                        <span>{r.review_text || "—"}</span>
                        {r.session_result && (
                          <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${resultBadgeClass(r.session_result)}`}>
                            {r.session_result}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reviews.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-400 text-sm">No reviews yet for this student.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-slate-800">{value ?? "—"}</p>
    </div>
  );
}
