import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getStudentDetail } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function formatTime(t) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export default function StudentDetail() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStudentDetail(id)
      .then(data => setStudent(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>
  if (!student) return null

  // 1 day can have multiple entries.
  const byDay = {}
  DAYS.forEach(d => byDay[d] = [])
  student.classes.forEach(cls => {
    cls.schedules.forEach(sched => {
      byDay[sched.day_of_week].push({
        class_id: cls.id,
        class_name: cls.name,
        start_time: sched.start_time,
        end_time: sched.end_time,
      })
    })
  })
  DAYS.forEach(d => byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time)))

  const hasAnySchedule = student.classes.some(c => c.schedules.length > 0)
  const unscheduledClasses = student.classes.filter(c => c.schedules.length === 0)

  return (
    <div className="p-8 max-w-5xl">
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

      {/* Weekly schedule */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Schedule</h2>

        {!hasAnySchedule ? (
          <p className="text-sm text-slate-400">This student has no scheduled classes yet.</p>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map(day => (
              <div key={day} className="min-h-[140px]">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 text-center">
                  {day.slice(0, 3)}
                </p>
                <div className="space-y-2">
                  {byDay[day].length === 0 ? (
                    <div className="border border-dashed border-slate-100 rounded-lg h-16" />
                  ) : (
                    byDay[day].map((entry, i) => (
                      <div
                        key={`${entry.class_id}-${i}`}
                        className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs"
                      >
                        <p className="font-medium text-blue-800 truncate">{entry.class_name}</p>
                        <p className="text-blue-500 mt-0.5">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
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
