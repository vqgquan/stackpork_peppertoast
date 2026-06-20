import { useEffect, useState, useRef, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { getStudentDetail, getClasses, createEnrollment, deleteEnrollment } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const HOUR_HEIGHT = 48
const TOTAL_HOURS = 24
const GUTTER_WIDTH = 52
const PAYMENT_METHODS = ["Tiền Mặt", "Chuyển khoản", "Pos"]
const NO_SUBJECT_LABEL = "Other"

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function formatTime(t) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

function hourLabel(h) {
  const period = h >= 12 ? "pm" : "am"
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${period}`
}

function enrollmentSummary(s) {
  const parts = []
  if (s.total_sessions) parts.push(`${s.total_sessions} sessions`)
  if (s.price != null) parts.push(`${s.price.toLocaleString()}đ`)
  if (s.payment_method) parts.push(s.payment_method)
  if (s.discount) parts.push(`Discount: ${s.discount}`)
  return parts.join(" · ")
}

// Groups overlapping events into clusters, then assigns each event a
// "track" (column) within its cluster so overlapping sessions render
// side-by-side instead of on top of each other.
function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin)
  const clusters = []
  let current = []
  let currentEnd = -Infinity

  for (const e of sorted) {
    if (current.length === 0 || e.startMin < currentEnd) {
      current.push(e)
      currentEnd = Math.max(currentEnd, e.endMin)
    } else {
      clusters.push(current)
      current = [e]
      currentEnd = e.endMin
    }
  }
  if (current.length) clusters.push(current)

  const result = []
  for (const cluster of clusters) {
    const trackEnds = []
    const clusterPositioned = []
    for (const e of cluster) {
      let track = trackEnds.findIndex(end => end <= e.startMin)
      if (track === -1) {
        track = trackEnds.length
        trackEnds.push(e.endMin)
      } else {
        trackEnds[track] = e.endMin
      }
      clusterPositioned.push({ ...e, track })
    }
    const trackCount = trackEnds.length
    clusterPositioned.forEach(e => result.push({ ...e, trackCount }))
  }
  return result
}

function WeeklyTimetable({ sessions }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 16
    }
  }, [])

  const eventsByDay = {}
  DAYS.forEach(d => eventsByDay[d] = [])

  sessions.forEach(s => {
    const startMin = toMinutes(s.start_time)
    const endMin = toMinutes(s.end_time)
    if (eventsByDay[s.day_of_week]) {
      eventsByDay[s.day_of_week].push({
        id: s.session_id,
        class_name: s.class_name,
        teacher_name: s.teacher_name,
        start_time: s.start_time,
        end_time: s.end_time,
        startMin,
        endMin,
      })
    }
  })

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>

        <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
          <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 bg-white" />
          {DAYS.map(day => (
            <div
              key={day}
              className="flex-1 text-center text-xs font-semibold text-slate-600 py-2 border-l border-slate-100 first:border-l-0 bg-white"
            >
              {day.slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="flex">
          <div style={{ width: GUTTER_WIDTH, height: totalHeight }} className="relative flex-shrink-0">
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
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: hourLineGradient }} />

            <div className="absolute inset-0 grid grid-cols-7">
              {DAYS.map(day => (
                <div key={day} className="relative border-l border-slate-100 first:border-l-0">
                  {layoutDayEvents(eventsByDay[day]).map(e => {
                    const top = (e.startMin / 60) * HOUR_HEIGHT
                    const height = Math.max(((e.endMin - e.startMin) / 60) * HOUR_HEIGHT, 22)
                    const widthPct = 100 / e.trackCount
                    const leftPct = e.track * widthPct
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
                        title={`${e.class_name} · ${formatTime(e.start_time)} – ${formatTime(e.end_time)}${e.teacher_name ? ` · ${e.teacher_name}` : ""}`}
                      >
                        <p className="text-[11px] font-medium text-blue-800 truncate leading-tight">{e.class_name}</p>
                        <p className="text-[10px] text-blue-500 truncate leading-tight">
                          {formatTime(e.start_time)} – {formatTime(e.end_time)}
                        </p>
                        {e.teacher_name && (
                          <p className="text-[10px] text-blue-400 truncate leading-tight">{e.teacher_name}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const labelClass = "block text-xs font-medium text-slate-600 mb-1"

function makeEmptyEnrollDraft() {
  return {
    subject: "",
    class_id: "",
    session_ids: [],
    total_sessions: "",
    price: "",
    payment_method: "",
    discount: "",
  }
}

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [allClasses, setAllClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [draft, setDraft] = useState(makeEmptyEnrollDraft())
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState(null)

  function loadStudent() {
    return getStudentDetail(id).then(data => setStudent(data))
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([loadStudent(), getClasses().then(setAllClasses)])
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const activeClasses = useMemo(
    () => allClasses.filter(c => c.status === "Active"),
    [allClasses]
  )

  const enrolledSessionIds = useMemo(
    () => new Set(student ? student.sessions.map(s => s.session_id) : []),
    [student]
  )

  // Unique list of subjects across all active classes (classes with no
  // subject set are grouped under "Other").
  const subjects = useMemo(() => {
    const set = new Set(activeClasses.map(c => c.subject || NO_SUBJECT_LABEL))
    return Array.from(set).sort()
  }, [activeClasses])

  function classesForSubject(subject) {
    return activeClasses.filter(c => (c.subject || NO_SUBJECT_LABEL) === subject)
  }

  function sessionsForClass(classId) {
    const cls = activeClasses.find(c => String(c.id) === String(classId))
    if (!cls) return []
    return cls.sessions.filter(s => !enrolledSessionIds.has(s.id))
  }

  function updateDraft(field, value) {
    setDraft(prev => {
      const updated = { ...prev, [field]: value }
      // Cascading resets: changing subject clears class & sessions,
      // changing class clears the selected sessions.
      if (field === "subject") {
        updated.class_id = ""
        updated.session_ids = []
      } else if (field === "class_id") {
        updated.session_ids = []
      }
      return updated
    })
  }

  function toggleSession(sessionId) {
    setDraft(prev => {
      const idStr = String(sessionId)
      const already = prev.session_ids.map(String).includes(idStr)
      const session_ids = already
        ? prev.session_ids.filter(sid => String(sid) !== idStr)
        : [...prev.session_ids, sessionId]
      return { ...prev, session_ids }
    })
  }

  async function handleEnroll(e) {
    e.preventDefault()
    if (draft.session_ids.length === 0) return
    setEnrolling(true)
    setEnrollError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      let failures = 0
      for (const sessionId of draft.session_ids) {
        try {
          await createEnrollment({
            student_id: Number(id),
            session_id: Number(sessionId),
            enrolled_date: today,
            status: "Enrolled",
            total_sessions: draft.total_sessions !== "" ? Number(draft.total_sessions) : null,
            price: draft.price !== "" ? Number(draft.price) : null,
            payment_method: draft.payment_method || null,
            discount: draft.discount || null,
          })
        } catch (err) {
          failures += 1
        }
      }
      if (failures > 0) {
        setEnrollError(
          `${failures} of ${draft.session_ids.length} enrollment(s) failed. The rest were added successfully.`
        )
      }
      setDraft(makeEmptyEnrollDraft())
      await loadStudent()
    } catch (err) {
      setEnrollError(err.message)
    } finally {
      setEnrolling(false)
    }
  }

  async function handleUnenroll(enrollmentId, className) {
    if (!confirm(`Remove "${className}" from this student?`)) return
    try {
      await deleteEnrollment(enrollmentId)
      await loadStudent()
    } catch (err) {
      alert("Error removing enrollment: " + err.message)
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>
  if (!student) return null

  const classOptions = draft.subject ? classesForSubject(draft.subject) : []
  const sessionOptions = draft.class_id ? sessionsForClass(draft.class_id) : []

  return (
    <div className="p-8 max-w-6xl">
      <Link to="/students" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Students
      </Link>

      {/* Profile card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{student.name}</h1>
            {student.gender && (
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                student.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
              }`}>
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
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Parent / Guardian
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Info label="Name" value={student.parent_name} />
              <Info label="Phone" value={student.parent_phone} />
            </div>
          </div>
        )}
      </div>

      {/* Weekly timetable */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Schedule</h2>

        {student.sessions.length === 0 ? (
          <p className="text-sm text-slate-400">This student has no scheduled sessions yet.</p>
        ) : (
          <WeeklyTimetable sessions={student.sessions} />
        )}
      </div>

      {/* Enrolled sessions + enroll form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Enrolled Sessions</h2>

        {student.sessions.length === 0 ? (
          <p className="text-sm text-slate-400 mb-5">Not enrolled in any class sessions yet.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {student.sessions.map(s => (
              <div
                key={s.enrollment_id}
                className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.class_name}</p>
                    {s.subject && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 flex-shrink-0">
                        {s.subject}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                    {s.teacher_name && ` · ${s.teacher_name}`}
                  </p>
                  {enrollmentSummary(s) && (
                    <p className="text-xs text-slate-400 truncate">{enrollmentSummary(s)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleUnenroll(s.enrollment_id, s.class_name)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium flex-shrink-0 ml-3"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleEnroll} className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Enroll in a class
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass}>Subject</label>
              <select
                value={draft.subject}
                onChange={e => updateDraft("subject", e.target.value)}
                className={inputClass}
              >
                <option value="">— Select —</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Class</label>
              <select
                value={draft.class_id}
                onChange={e => updateDraft("class_id", e.target.value)}
                disabled={!draft.subject}
                className={inputClass}
              >
                <option value="">— Select —</option>
                {classOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className={labelClass}>
              Sessions {draft.class_id && <span className="text-slate-400 font-normal">(select one or more)</span>}
            </label>

            {!draft.class_id ? (
              <p className="text-xs text-slate-400 italic px-1">Choose a class first.</p>
            ) : sessionOptions.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-1">
                No available sessions — the student may already be enrolled in all of them.
              </p>
            ) : (
              <div className="space-y-1.5">
                {sessionOptions.map(s => {
                  const checked = draft.session_ids.map(String).includes(String(s.id))
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-colors ${
                        checked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSession(s.id)}
                        className="accent-blue-600"
                      />
                      <span className="flex-1">
                        {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {s.teacher_name || "Unassigned"}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass}>Total Sessions</label>
              <input
                type="number" min="1"
                value={draft.total_sessions} onChange={e => updateDraft("total_sessions", e.target.value)}
                placeholder="e.g. 16"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Price</label>
              <input
                type="number" min="0"
                value={draft.price} onChange={e => updateDraft("price", e.target.value)}
                placeholder="VNĐ"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Payment Method</label>
              <select
                value={draft.payment_method} onChange={e => updateDraft("payment_method", e.target.value)}
                className={inputClass}
              >
                <option value="">— Select —</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Discount</label>
              <input
                type="text"
                value={draft.discount} onChange={e => updateDraft("discount", e.target.value)}
                placeholder="e.g. 10% or 200,000đ"
                className={inputClass}
              />
            </div>
          </div>

          {draft.session_ids.length > 1 && (
            <p className="text-xs text-slate-400 mb-3 italic">
              Price, payment method, and discount above will apply to all {draft.session_ids.length} selected sessions.
            </p>
          )}

          <button
            type="submit"
            disabled={draft.session_ids.length === 0 || enrolling}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {enrolling
              ? "Enrolling..."
              : draft.session_ids.length > 1
                ? `Enroll in ${draft.session_ids.length} sessions`
                : "Enroll"}
          </button>
        </form>
        {enrollError && (
          <p className="text-sm text-red-600 mt-2">{enrollError}</p>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-slate-800">{value ?? "—"}</p>
    </div>
  )
}
