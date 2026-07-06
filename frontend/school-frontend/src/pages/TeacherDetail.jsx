import { useEffect, useState, useRef, useMemo } from "react"
import { useParams, Link } from "react-router-dom"
import { getTeacherDetail, getDashboardTeacherHours } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const HOUR_HEIGHT = 44
const TOTAL_HOURS = 24
const GUTTER_WIDTH = 52

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
                subject: s.subject,
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
                                            <div key={e.id}
                                                className="absolute bg-violet-100 border border-violet-300 rounded-md px-1.5 py-1 overflow-hidden hover:z-10 hover:shadow-md transition-shadow"
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

    useEffect(() => {
        setLoading(true)
        setError(null)
        getDashboardTeacherHours(month, year)
            .then((data) => {
                const row = data.find(r => String(r.teacher_id) === String(teacherId))
                setSlots(row ? row.slots : [])
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [month, year, teacherId])

    const daysInMonth = useMemo(() => {
        const days = []
        const d = new Date(year, month - 1, 1)
        while (d.getMonth() === month - 1) {
            days.push(new Date(d))
            d.setDate(d.getDate() + 1)
        }
        return days
    }, [year, month])

    const timeSlots = useMemo(() => {
        const seen = new Set()
        const list = []
        for (const sl of slots) {
            const key = `${sl.start_time}–${sl.end_time}`
            if (!seen.has(key)) {
                seen.add(key)
                list.push({ start_time: sl.start_time, end_time: sl.end_time })
            }
        }
        return list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    }, [slots])

    const slotsByDate = useMemo(() => {
        const map = {}
        for (const sl of slots) {
            if (!map[sl.date]) map[sl.date] = new Set()
            map[sl.date].add(`${sl.start_time}–${sl.end_time}`)
        }
        return map
    }, [slots])

    function dayHours(daySlots) {
        let h = 0
        for (const sl of timeSlots) {
            const key = `${sl.start_time}–${sl.end_time}`
            if (daySlots.has(key)) h += slotHours(sl)
        }
        return h
    }

    const slotHourTotals = useMemo(() => {
        const totals = {}
        for (const sl of timeSlots) {
            const key = `${sl.start_time}–${sl.end_time}`
            const count = Object.values(slotsByDate).filter(s => s.has(key)).length
            totals[key] = count * slotHours(sl)
        }
        return totals
    }, [timeSlots, slotsByDate])

    const totalHours = useMemo(
        () => Object.values(slotHourTotals).reduce((s, h) => s + h, 0),
        [slotHourTotals],
    )

    // Only keep days where this teacher actually taught at least one slot.
    const workingDays = useMemo(
        () => daysInMonth.filter((dt) => {
            const dateStr = dt.toISOString().slice(0, 10)
            const daySlots = slotsByDate[dateStr] ?? new Set()
            return dayHours(daySlots) > 0
        }),
        [daysInMonth, slotsByDate, timeSlots],
    )

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Teacher Hours</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Hours taught per day, derived from attendance records.
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
                        <p className="text-xs font-medium text-slate-600 min-w-[110px]">{label}</p>
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
                    <div className="flex items-center gap-6 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                            <p className="text-xs text-slate-400">Total Hours This Month</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
                            </p>
                        </div>
                        <div className="border-l border-slate-200 pl-4">
                            <p className="text-xs text-slate-400">Sessions Taught</p>
                            <p className="text-2xl font-bold text-slate-800">{slots.length}</p>
                        </div>
                    </div>

                    {workingDays.length === 0 ? (
                        <p className="text-sm text-slate-400">No working days recorded this month.</p>
                    ) : (
                        <table className="w-full text-sm border border-slate-200 rounded-lg">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide border-b border-slate-200">
                                    <th className="px-3 py-2 text-left w-24">Day</th>
                                    <th className="px-3 py-2 text-left w-28">Date</th>
                                    {timeSlots.map(sl => (
                                        <th key={`${sl.start_time}–${sl.end_time}`} className="px-2 py-2 text-center">
                                            {sl.start_time.slice(0, 5)}–{sl.end_time.slice(0, 5)}
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-center font-bold text-slate-700 w-20">Giờ dạy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workingDays.map(dt => {
                                    const dateStr = dt.toISOString().slice(0, 10)
                                    const daySlots = slotsByDate[dateStr] ?? new Set()
                                    const hours = dayHours(daySlots)
                                    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6
                                    return (
                                        <tr key={dateStr} className={`border-t border-slate-100 ${isWeekend ? "bg-slate-50/60" : ""}`}>
                                            <td className="px-3 py-1.5 text-slate-700">{DAY_NAMES_VN[dt.getDay()]}</td>
                                            <td className="px-3 py-1.5 text-slate-700">
                                                {String(dt.getDate()).padStart(2, "0")}/
                                                {String(dt.getMonth() + 1).padStart(2, "0")}/
                                                {dt.getFullYear()}
                                            </td>
                                            {timeSlots.map(sl => {
                                                const key = `${sl.start_time}–${sl.end_time}`
                                                const taught = daySlots.has(key)
                                                const slot = slots.find(
                                                    s => s.date === dateStr && `${s.start_time}–${s.end_time}` === key,
                                                )
                                                return (
                                                    <td
                                                        key={key}
                                                        className="px-2 py-1.5 text-center"
                                                        title={slot ? `${slot.class_name}${slot.subject ? ` (${slot.subject})` : ""}` : ""}
                                                    >
                                                        {taught ? (
                                                            <span className="font-bold text-blue-600">
                                                                {slotHours(sl) % 1 === 0 ? slotHours(sl) : slotHours(sl).toFixed(1)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-200">–</span>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                            <td className="px-3 py-1.5 text-center font-bold text-slate-800">
                                                {hours % 1 === 0 ? hours : hours.toFixed(1)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-700">
                                    <td className="px-3 py-2" colSpan={2}>TỔNG CỘNG</td>
                                    {timeSlots.map(sl => {
                                        const key = `${sl.start_time}–${sl.end_time}`
                                        const h = slotHourTotals[key] ?? 0
                                        return (
                                            <td key={key} className="px-2 py-2 text-center text-blue-700">
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
                        <WeeklyTimetable sessions={teacher.sessions} />
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
