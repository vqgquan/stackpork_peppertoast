import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getClasses, getTeachers } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const HOUR_HEIGHT = 48
const TOTAL_HOURS = 24
const GUTTER_WIDTH = 68

const SUBJECT_COLORS = {
  "Guitar":         { bg: "bg-amber-100",   border: "border-amber-300",   text: "text-amber-800",   badge: "bg-amber-50 text-amber-700" },
  "Guitar điện":     { bg: "bg-orange-100",  border: "border-orange-300",  text: "text-orange-800",  badge: "bg-orange-50 text-orange-700" },
  "Piano":          { bg: "bg-blue-100",    border: "border-blue-300",    text: "text-blue-800",    badge: "bg-blue-50 text-blue-700" },
  "Organ":          { bg: "bg-purple-100",  border: "border-purple-300",  text: "text-purple-800",  badge: "bg-purple-50 text-purple-700" },
  "Trống":          { bg: "bg-rose-100",    border: "border-rose-300",    text: "text-rose-800",    badge: "bg-rose-50 text-rose-700" },
  "Thanh nhạc":      { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", badge: "bg-emerald-50 text-emerald-700" },
}
const DEFAULT_COLOR = { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-800", badge: "bg-slate-50 text-slate-700" }
function colorFor(subject) {
  return SUBJECT_COLORS[subject] || DEFAULT_COLOR
}

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

// Monday-Sunday calendar dates for the current week (for header labels only —
// sessions recur weekly by day-of-week, they aren't tied to one specific date)
function getWeekDates() {
  const today = new Date()
  const day = today.getDay() // 0 = Sun ... 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)
  const dates = {}
  DAYS.forEach((d, i) => {
    const dt = new Date(monday)
    dt.setDate(monday.getDate() + i)
    dates[d] = dt
  })
  return dates
}

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

function pillClasses(active, colors) {
  if (active) {
    const badgeClass = colors ? colors.badge : "bg-slate-800 text-white"
    return `text-xs px-3 py-1 rounded-full font-medium ${badgeClass} ring-1 ring-inset ring-current`
  }
  return "text-xs px-3 py-1 rounded-full font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
}

function SessionModal({ session, teachersById, onClose }) {
  if (!session) return null
  const teacher = session.teacher_id ? teachersById[session.teacher_id] : null
  const colors = colorFor(session.subject)

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{session.class_name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              {session.subject && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                  {session.subject}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {session.day_of_week} · {formatTime(session.start_time)}–{formatTime(session.end_time)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Teacher info */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Teacher</p>
            {teacher ? (
              <div className="border border-slate-100 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium text-slate-800">{teacher.name}</p>
                <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-slate-500">
                  {teacher.phone && <span>{teacher.phone}</span>}
                  {teacher.email && <span>{teacher.email}</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No teacher assigned to this session.</p>
            )}
          </div>

          {/* Roster */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Students ({session.students.length})
            </p>
            {session.students.length === 0 ? (
              <p className="text-sm text-slate-400">No students enrolled in this session yet.</p>
            ) : (
              <div className="space-y-1.5">
                {session.students.map(s => (
                  <Link
                    key={s.id}
                    to={`/students/${s.id}`}
                    className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-blue-700 hover:underline">{s.name}</span>
                    <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState("")

  useEffect(() => {
    Promise.all([getClasses(), getTeachers()])
      .then(([classData, teacherData]) => {
        setClasses(classData)
        setTeachers(teacherData)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>

  const teachersById = Object.fromEntries(teachers.map(t => [t.id, t]))
  const weekDates = getWeekDates()

  // Active classes, narrowed down by the selected subject filter (if any)
  const visibleClasses = classes
    .filter(c => c.status === "Active")
    .filter(c => !selectedSubject || c.subject === selectedSubject)

  // Flatten every session of every visible class into a single list
  const eventsByDay = {}
  DAYS.forEach(d => eventsByDay[d] = [])

  // Distinct students across all visible sessions — updates with the filter
  const studentIds = new Set()

  visibleClasses.forEach(c => {
    c.sessions.forEach(s => {
      s.students.forEach(stu => studentIds.add(stu.id))
      if (!eventsByDay[s.day_of_week]) return
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
      })
    })
  })

  const totalStudents = studentIds.size

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT
  const hourLineGradient = `repeating-linear-gradient(to bottom, transparent, transparent ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT - 1}px, #f1f5f9 ${HOUR_HEIGHT}px)`

  const weekRangeLabel = `${weekDates["Monday"].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDates["Sunday"].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <div className="p-8 w-full">
      <div className="flex items-end justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      </div>
      <p className="text-sm text-slate-400 mb-6">Quick overview of what's happening across the school.</p>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">This Week's Schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">{weekRangeLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900 leading-tight">{totalStudents}</p>
            <p className="text-xs text-slate-400">
              {selectedSubject ? `Students in ${selectedSubject}` : "Total Students"}
            </p>
          </div>
        </div>

        {/* Subject filter — also doubles as the color legend */}
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

            {/* Day headers with calendar dates */}
            <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
              <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 bg-white" />
              {DAYS.map(day => (
                <div
                  key={day}
                  className="flex-1 text-center py-2 border-l border-slate-100 first:border-l-0 bg-white"
                >
                  <p className="text-sm font-semibold text-slate-600">{day.slice(0, 3)}</p>
                  <p className="text-xs text-slate-400">
                    {weekDates[day].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex">
              {/* Hour labels */}
              <div style={{ width: GUTTER_WIDTH, height: totalHeight }} className="relative flex-shrink-0">
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

              {/* Grid */}
              <div className="relative flex-1" style={{ height: totalHeight }}>
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: hourLineGradient }} />
                <div className="absolute inset-0 grid grid-cols-7">
                  {DAYS.map(day => (
                    <div key={day} className="relative border-l border-slate-100 first:border-l-0">
                      {layoutDayEvents(eventsByDay[day]).map(e => {
                        const top = (e.startMin / 60) * HOUR_HEIGHT
                        const height = Math.max(((e.endMin - e.startMin) / 60) * HOUR_HEIGHT, 30)
                        const widthPct = 100 / e.trackCount
                        const leftPct = e.track * widthPct
                        const colors = colorFor(e.subject)
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
                              <p className={`text-[10px] font-semibold ${colors.text} truncate leading-tight`}>{e.subject}</p>
                            )}
                            <p className={`text-[10px] ${colors.text} opacity-80 truncate leading-tight`}>
                              {e.teacher_name ?? "Unassigned"}
                            </p>
                            <p className={`text-[9px] ${colors.text} opacity-60 truncate leading-tight`}>
                              {formatTime(e.start_time)}–{formatTime(e.end_time)}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedSession && (
        <SessionModal
          session={selectedSession}
          teachersById={teachersById}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  )
}
