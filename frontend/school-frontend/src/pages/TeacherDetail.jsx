import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { getTeacherDetail } from "../api"

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