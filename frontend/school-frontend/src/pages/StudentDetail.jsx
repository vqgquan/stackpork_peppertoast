import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { getStudentDetail, getClasses, createEnrollment, deleteEnrollment } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const HOUR_HEIGHT = 48   // px per hour row
const TOTAL_HOURS = 24
const GUTTER_WIDTH = 52  // px width of the time-label column

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

function scheduleSummary(cls) {
  if (!cls.schedules || cls.schedules.length === 0) return "No schedule set"
  return cls.schedules
    .map(s => `${s.day_of_week.slice(0, 3)} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`)
    .join(", ")
}

// Groups overlapping events into clusters, then assigns each event a
// "track" (column) within its cluster so overlapping classes render
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

function WeeklyTimetable({ classes }) {
  const scrollRef = useRef(null)

  // Scroll to a sensible default start time (7am) on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 16
    }
  }, [])

  const eventsByDay = {}
  DAYS.forEach(d => eventsByDay[d] = [])

  classes.forEach(cls => {
    cls.schedules.forEach(sched => {
      const startMin = toMinutes(sched.start_time)
      const endMin = toMinutes(sched.end_time)
      if (eventsByDay[sched.day_of_week]) {
        eventsByDay[sched.day_of_week].push({
          id: `${cls.id}-${sched.id}`,
          class_name: cls.name,
          start_time: sched.start_time,
          end_time: sched.end_time,
          startMin,
          endMin,
        })
      }
    })
  })

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Single scroll container — header and grid live inside it together
          so they always share the exact same width, scrollbar included. */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 560 }}>

        {/* Header row — sticky inside the scroll container, not a separate sibling */}
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
          {/* Time label gutter */}
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

          {/* Day columns */}
          <div className="relative flex-1" style={{ height: totalHeight }}>
            {/* hour gridlines, full width */}
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
                        title={`${e.class_name} · ${formatTime(e.start_time)} – ${formatTime(e.end_time)}`}
                      >
                        <p className="text-[11px] font-medium text-blue-800 truncate leading-tight">{e.class_name}</p>
                        <p className="text-[10px] text-blue-500 truncate leading-tight">
                          {formatTime(e.start_time)} – {formatTime(e.end_time)}
                        </p>
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

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [allClasses, setAllClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedClassId, setSelectedClassId] = useState("")
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

  async function handleEnroll(e) {
    e.preventDefault()
    if (!selectedClassId) return
    setEnrolling(true)
    setEnrollError(null)
    try {
      await createEnrollment({
        student_id: Number(id),
        class_id: Number(selectedClassId),
        enrolled_date: new Date().toISOString().slice(0, 10),
        status: "Enrolled",
      })
      setSelectedClassId("")
      await loadStudent()   // refreshes classes + timetable automatically
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
      await loadStudent()   // refreshes classes + timetable automatically
    } catch (err) {
      alert("Error removing enrollment: " + err.message)
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>
  if (!student) return null

  const hasAnySchedule = student.classes.some(c => c.schedules.length > 0)
  const unscheduledClasses = student.classes.filter(c => c.schedules.length === 0)

  const enrolledIds = new Set(student.classes.map(c => c.id))
  const availableClasses = allClasses.filter(
    c => !enrolledIds.has(c.id) && c.status === "Active"
  )

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
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              student.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
            }`}>
              {student.gender}
            </span>
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
          <Info label="Facebook" value={student.facebook} />
          <Info label="Citizenship" value={student.citizenship} />
          <Info label="Passport Number" value={student.passport_number} />
        </div>
      </div>

      {/* Enrolled classes + enroll form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Enrolled Classes</h2>

        {student.classes.length === 0 ? (
          <p className="text-sm text-slate-400 mb-5">Not enrolled in any classes yet.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {student.classes.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 truncate">{scheduleSummary(c)}</p>
                </div>
                <button
                  onClick={() => handleUnenroll(c.enrollment_id, c.name)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium flex-shrink-0 ml-3"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleEnroll} className="flex items-end gap-2 border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Enroll in a class</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Select a class —</option>
              {availableClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({scheduleSummary(c)})
                </option>
              ))}
            </select>
            {availableClasses.length === 0 && allClasses.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                No other active classes available to enroll in.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!selectedClassId || enrolling}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {enrolling ? "Enrolling..." : "Enroll"}
          </button>
        </form>
        {enrollError && (
          <p className="text-sm text-red-600 mt-2">{enrollError}</p>
        )}
      </div>

      {/* Weekly timetable */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Schedule</h2>

        {!hasAnySchedule ? (
          <p className="text-sm text-slate-400">This student has no scheduled classes yet.</p>
        ) : (
          <WeeklyTimetable classes={student.classes} />
        )}

        {unscheduledClasses.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Enrolled (no schedule set)
            </p>
            <div className="flex flex-wrap gap-2">
              {unscheduledClasses.map(c => (
                <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
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
