import { useEffect, useState, useRef, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { getTeacherDetail, getDashboardTeacherHours } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const HOUR_HEIGHT = 44
const TOTAL_HOURS = 24
const GUTTER_WIDTH = 52

const SUBJECT_COLORS = {
    Guitar: { badge: "bg-amber-50 text-amber-700" },
    "Guitar điện": { badge: "bg-orange-50 text-orange-700" },
    Piano: { badge: "bg-blue-50 text-blue-700" },
    Organ: { badge: "bg-purple-50 text-purple-700" },
    Trống: { badge: "bg-rose-50 text-rose-700" },
    "Thanh nhạc": { badge: "bg-emerald-50 text-emerald-700" },
}
const DEFAULT_SUBJECT_COLOR = { badge: "bg-slate-50 text-slate-700" }
function colorFor(subject) {
    return SUBJECT_COLORS[subject] || DEFAULT_SUBJECT_COLOR
}

function toMinutes(t) {
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
}

function formatTime(t) {
    if (!t) return ""
    const [h, m] = t.split(":").map(Number)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function hourLabel(h) {
    return `${String(h).padStart(2, "0")}:00`
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

// ─── Session modal ──────────────────────────────────────────────────────
// Same shape as the Dashboard's SessionModal, minus the teacher-reassignment
// section (we're already on that teacher's own page, so editing it here
// wouldn't make sense). Shows the enrolled roster and a link to the class.
function SessionModal({ session, onClose }) {
    if (!session) return null
    const colors = colorFor(session.subject)
    const students = session.students ?? []

    return (
        <div
            className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                            {session.class_name}
                        </h3>
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
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {session.class_id && (
                        <Link
                            to={`/classes/${session.class_id}`}
                            className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                        >
                            View class
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </Link>
                    )}

                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Students ({students.length})
                        </p>
                        {students.length === 0 ? (
                            <p className="text-sm text-slate-400">
                                No students enrolled in this session yet.
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {students.map((s) => (
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
    )
}

function WeeklyTimetable({ sessions, onSessionClick }) {
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
                class_id: s.class_id,
                class_name: s.class_name,
                subject: s.subject,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                students: s.students,
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
                {/* Day headers */}
                <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
                    <div style={{ width: GUTTER_WIDTH }} className="flex-shrink-0 bg-white" />
                    {DAYS.map(day => (
                        <div key={day}
                            className="flex-1 text-center text-xs font-semibold text-slate-600 py-2 border-l border-slate-100 first:border-l-0 bg-white">
                            {day.slice(0, 3)}
                        </div>
                    ))}
                </div>

                <div className="flex">
                    {/* Hour labels */}
                    <div style={{ width: GUTTER_WIDTH, height: totalHeight }} className="relative flex-shrink-0">
                        {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
                            <div key={h} className="absolute right-1.5 text-[10px] text-slate-400"
                                style={{ top: h * HOUR_HEIGHT + 2 }}>
                                {hourLabel(h)}
                            </div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="relative flex-1" style={{ height: totalHeight }}>
                        <div className="absolute inset-0 pointer-events-none"
                            style={{ backgroundImage: hourLineGradient }} />
                        <div className="absolute inset-0 grid grid-cols-7">
                            {DAYS.map(day => (
                                <div key={day} className="relative border-l border-slate-100 first:border-l-0">
                                    {layoutDayEvents(eventsByDay[day]).map(e => {
                                        const top = (e.startMin / 60) * HOUR_HEIGHT
                                        const height = Math.max(((e.endMin - e.startMin) / 60) * HOUR_HEIGHT, 22)
                                        const widthPct = 100 / e.trackCount
                                        const leftPct = e.track * widthPct
                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => onSessionClick?.(e)}
                                                className="absolute bg-violet-100 border border-violet-300 rounded-md px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow text-left cursor-pointer"
                                                style={{
                                                    top,
                                                    height,
                                                    left: `calc(${leftPct}% + 2px)`,
                                                    width: `calc(${widthPct}% - 4px)`,
                                                }}
                                                title={`${e.class_name} · ${formatTime(e.start_time)} – ${formatTime(e.end_time)}`}
                                            >
                                                <p className="text-[11px] font-medium text-violet-800 truncate leading-tight">{e.class_name}</p>
                                                {e.subject && (
                                                    <p className="text-[10px] text-violet-400 truncate leading-tight">{e.subject}</p>
                                                )}
                                                <p className="text-[10px] text-violet-500 truncate leading-tight">
                                                    {formatTime(e.start_time)} – {formatTime(e.end_time)}
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
    )
}

// ─── Month picker helper ──────────────────────────────────────────────────
function useMonthYear() {
    const today = new Date()
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [year, setYear] = useState(today.getFullYear())
    function prev() {
        if (month === 1) {
            setMonth(12)
            setYear(y => y - 1)
        } else setMonth(m => m - 1)
    }
    function next() {
        if (month === 12) {
            setMonth(1)
            setYear(y => y + 1)
        } else setMonth(m => m + 1)
    }
    const label = new Date(year, month - 1, 1).toLocaleString("default", {
        month: "long",
        year: "numeric",
    })
    return { month, year, prev, next, label }
}

function slotHours(sl) {
    const [sh, sm] = sl.start_time.split(":").map(Number)
    const [eh, em] = sl.end_time.split(":").map(Number)
    return (eh * 60 + em - (sh * 60 + sm)) / 60
}

const DAY_NAMES_VN = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]

// ─── Teacher Hours table ────────────────────────────────────────────────────
// Same underlying data as the Dashboard's Teacher Hours table, but scoped to
// this one teacher directly — no teacher/subject picker needed since the
// page already knows exactly who it is.
function TeacherHoursTable({ teacherId }) {
    const { month, year, prev, next, label } = useMonthYear()
    const [slots, setSlots] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [expandedDates, setExpandedDates] = useState(new Set())

    useEffect(() => {
        setLoading(true)
        setError(null)
        setExpandedDates(new Set())
        getDashboardTeacherHours(month, year)
            .then((data) => {
                const row = data.find(r => String(r.teacher_id) === String(teacherId))
                setSlots(row ? row.slots : [])
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [month, year, teacherId])

    function toggleExpand(dateStr) {
        setExpandedDates(prev => {
            const n = new Set(prev)
            if (n.has(dateStr)) n.delete(dateStr)
            else n.add(dateStr)
            return n
        })
    }

    const daysInMonth = useMemo(() => {
        const days = []
        const d = new Date(year, month - 1, 1)
        while (d.getMonth() === month - 1) {
            days.push(new Date(d))
            d.setDate(d.getDate() + 1)
        }
        return days
    }, [year, month])

    // Distinct subjects — these become the table's columns.
    const subjectsList = useMemo(() => {
        const set = new Set()
        slots.forEach(sl => set.add(sl.subject || "Unspecified"))
        return [...set].sort()
    }, [slots])

    // Full slot objects grouped by date, for the expanded session breakdown.
    const slotsByDateFull = useMemo(() => {
        const map = {}
        for (const sl of slots) {
            if (!map[sl.date]) map[sl.date] = []
            map[sl.date].push(sl)
        }
        return map
    }, [slots])

    function daySubjectHours(dateStr, subject) {
        const list = slotsByDateFull[dateStr] ?? []
        return list
            .filter(sl => (sl.subject || "Unspecified") === subject)
            .reduce((s, sl) => s + slotHours(sl), 0)
    }

    function dayTotalHours(dateStr) {
        const list = slotsByDateFull[dateStr] ?? []
        return list.reduce((s, sl) => s + slotHours(sl), 0)
    }

    const subjectTotals = useMemo(() => {
        const totals = {}
        for (const subj of subjectsList) totals[subj] = 0
        for (const sl of slots) {
            const subj = sl.subject || "Unspecified"
            totals[subj] = (totals[subj] || 0) + slotHours(sl)
        }
        return totals
    }, [slots, subjectsList])

    const totalHours = useMemo(
        () => Object.values(subjectTotals).reduce((s, h) => s + h, 0),
        [subjectTotals],
    )

    const hoursBySubject = subjectTotals

    // Only keep days where this teacher actually taught at least one slot.
    const workingDays = useMemo(
        () => daysInMonth.filter((dt) => {
            const dateStr = dt.toISOString().slice(0, 10)
            return dayTotalHours(dateStr) > 0
        }),
        [daysInMonth, slotsByDateFull],
    )

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Teacher Hours</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Hours taught per day, derived from attendance records. Click a row to see the session breakdown.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={prev}
                            className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
                            title="Previous month"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <p className="text-xs font-medium text-slate-600 min-w-[110px] text-center">{label}</p>
                        <button
                            onClick={next}
                            className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
                            title="Next month"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-slate-400">Loading teacher hours…</p>
            ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
            ) : slots.length === 0 ? (
                <p className="text-sm text-slate-400">No teaching activity recorded this month.</p>
            ) : (
                <>
                    <div className="flex items-center gap-6 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto">
                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-400 whitespace-nowrap">Total Hours This Month</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
                            </p>
                        </div>
                        <div className="border-l border-slate-200 pl-4 flex-shrink-0">
                            <p className="text-xs text-slate-400 whitespace-nowrap">Sessions Taught</p>
                            <p className="text-2xl font-bold text-slate-800">{slots.length}</p>
                        </div>
                        <div className="border-l border-slate-200 pl-4 flex-shrink-0">
                            <p className="text-xs text-slate-400 mb-1 whitespace-nowrap">Hours by Subject</p>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                {Object.entries(hoursBySubject).map(([subj, hrs]) => {
                                    const c = colorFor(subj)
                                    return (
                                        <span key={subj} className={`text-sm px-2.5 py-1 rounded-full font-semibold ${c.badge}`}>
                                            {subj}: {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}h
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {workingDays.length === 0 ? (
                        <p className="text-sm text-slate-400">No working days recorded this month.</p>
                    ) : (
                        <table className="w-full text-sm border border-slate-200 rounded-lg">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                                    <th className="w-8"></th>
                                    <th className="px-3 py-2 text-left w-24">Day</th>
                                    <th className="px-3 py-2 text-left w-28">Date</th>
                                    {subjectsList.map(subj => {
                                        const c = colorFor(subj)
                                        return (
                                            <th key={subj} className="px-2 py-2 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium normal-case ${c.badge}`}>
                                                    {subj}
                                                </span>
                                            </th>
                                        )
                                    })}
                                    <th className="px-3 py-2 text-center font-bold text-slate-700 w-20">Giờ dạy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workingDays.map(dt => {
                                    const dateStr = dt.toISOString().slice(0, 10)
                                    const total = dayTotalHours(dateStr)
                                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6
                                    const isExpanded = expandedDates.has(dateStr)
                                    const daySlots = slotsByDateFull[dateStr] ?? []
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
                                                        fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                                                    >
                                                        <path d="M9 18l6-6-6-6" />
                                                    </svg>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-700">{DAY_NAMES_VN[dt.getDay()]}</td>
                                                <td className="px-3 py-1.5 text-slate-700">
                                                    {String(dt.getDate()).padStart(2, "0")}/
                                                    {String(dt.getMonth() + 1).padStart(2, "0")}/
                                                    {dt.getFullYear()}
                                                </td>
                                                {subjectsList.map(subj => {
                                                    const hrs = daySubjectHours(dateStr, subj)
                                                    const c = colorFor(subj)
                                                    return (
                                                        <td key={subj} className="px-2 py-1.5 text-center">
                                                            {hrs > 0 ? (
                                                                <span className={`font-bold px-1.5 py-0.5 rounded ${c.badge}`}>
                                                                    {hrs % 1 === 0 ? hrs : hrs.toFixed(1)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-200">–</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                                <td className="px-3 py-1.5 text-center font-bold text-slate-800">
                                                    {total % 1 === 0 ? total : total.toFixed(1)}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${dateStr}-detail`} className="bg-slate-50/70 border-t border-slate-100">
                                                    <td colSpan={subjectsList.length + 4} className="px-6 py-3">
                                                        <div className="flex flex-wrap">
                                                            {subjectsList
                                                                .filter(subj => daySubjectHours(dateStr, subj) > 0)
                                                                .map(subj => {
                                                                    const c = colorFor(subj)
                                                                    const sessions = daySlots.filter(
                                                                        sl => (sl.subject || "Unspecified") === subj,
                                                                    )
                                                                    return (
                                                                        <div key={subj} className="min-w-[180px] px-6 first:pl-0 border-l border-slate-200 first:border-l-0">
                                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mb-2 ${c.badge}`}>
                                                                                {subj}
                                                                            </span>
                                                                            <div className="space-y-1.5">
                                                                                {sessions.map((sl, i) => (
                                                                                    <div key={i} className="text-xs text-slate-600 flex items-center justify-between gap-4">
                                                                                        <span>
                                                                                            {sl.start_time.slice(0, 5)}–{sl.end_time.slice(0, 5)}
                                                                                        </span>
                                                                                        <span className="font-semibold text-slate-700 flex-shrink-0">
                                                                                            {slotHours(sl) % 1 === 0 ? slotHours(sl) : slotHours(sl).toFixed(1)}h
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                                    <td className="px-3 py-2" colSpan={3}>TỔNG CỘNG</td>
                                    {subjectsList.map(subj => {
                                        const h = subjectTotals[subj] ?? 0
                                        return (
                                            <td key={subj} className="px-2 py-2 text-center text-blue-700">
                                                {h % 1 === 0 ? h : h.toFixed(1)}
                                            </td>
                                        )
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
    )
}

export default function TeacherDetail() {
    const { id } = useParams()
    const [teacher, setTeacher] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedSession, setSelectedSession] = useState(null)

    useEffect(() => {
        getTeacherDetail(id)
            .then(data => setTeacher(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [id])

    if (loading) return <p className="p-8 text-slate-400">Loading...</p>
    if (error)   return <p className="p-8 text-red-500">{error}</p>
    if (!teacher) return null

    return (
        <div className="p-8 w-full">
            <Link to="/teachers" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
                ← Back to Teachers
            </Link>

            {/* Profile card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">{teacher.name}</h1>
                        {teacher.gender && (
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                teacher.gender === "Male" ? "bg-blue-50 text-blue-700" :
                                teacher.gender === "Female" ? "bg-pink-50 text-pink-700" :
                                "bg-slate-100 text-slate-600"
                            }`}>
                                {teacher.gender}
                            </span>
                        )}
                    </div>
                    {teacher.customer_source && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                            Source: {teacher.customer_source}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
                    <Info label="Phone" value={teacher.phone} />
                    <Info label="Email" value={teacher.email} />
                    <Info label="Subjects" value={teacher.subjects} />
                    <Info label="Qualifications" value={teacher.qualifications} />
                    <Info label="Address" value={teacher.address} className="col-span-2" />
                    <Info label="Facebook" value={teacher.facebook} />
                </div>
            </div>

            {/* Schedule + Teaching Sessions, side by side to use full width */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Schedule</h2>
                    {teacher.sessions.length === 0 ? (
                        <p className="text-sm text-slate-400">No scheduled sessions yet.</p>
                    ) : (
                        <WeeklyTimetable
                            sessions={teacher.sessions}
                            onSessionClick={(s) => setSelectedSession(s)}
                        />
                    )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Teaching Sessions</h2>
                    {teacher.sessions.length === 0 ? (
                        <p className="text-sm text-slate-400">No sessions assigned yet.</p>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {teacher.sessions.map(s => (
                                <div key={s.session_id}
                                    className="border border-slate-100 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-sm font-medium text-slate-800 truncate">{s.class_name}</p>
                                        {s.subject && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 flex-shrink-0">
                                                {s.subject}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <TeacherHoursTable teacherId={teacher.id} />

            {selectedSession && (
                <SessionModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                />
            )}
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
