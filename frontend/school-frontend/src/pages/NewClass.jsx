import { useState, useEffect, useMemo } from "react"
import { createClass, getTeachers } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const SUBJECTS = ["Guitar", "Guitar điện", "Piano", "Organ", "Trống", "Thanh nhạc"]

const EMPTY = {
  name: "",
  description: "",
  subject: "",
  start_date: "",
  end_date: "",
  status: "Active",
}

const EMPTY_SESSION_ROW = { day_of_week: "Monday", start_time: "", end_time: "", teacher_id: "" }

export default function NewClass() {
  const [form, setForm] = useState(EMPTY)
  const [sessions, setSessions] = useState([{ ...EMPTY_SESSION_ROW }])
  const [teachers, setTeachers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    getTeachers().then(setTeachers).catch(() => {})
  }, [])

  // Only teachers who teach the class's selected subject can be assigned
  // to one of its sessions. With no subject chosen yet, show everyone.
  const eligibleTeachers = useMemo(() => {
    if (!form.subject) return teachers
    return teachers.filter(t => t.subjects?.includes(form.subject))
  }, [teachers, form.subject])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))

    // If the subject changes, clear any already-picked teacher that
    // no longer teaches the newly selected subject.
    if (name === "subject") {
      setSessions(prev => prev.map(row => {
        if (!row.teacher_id) return row
        const teacher = teachers.find(t => String(t.id) === String(row.teacher_id))
        const stillEligible = !value || teacher?.subjects?.includes(value)
        return stillEligible ? row : { ...row, teacher_id: "" }
      }))
    }
  }

  function handleSessionChange(index, field, value) {
    setSessions(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function addSessionRow() {
    setSessions(prev => [...prev, { ...EMPTY_SESSION_ROW }])
  }

  function removeSessionRow(index) {
    setSessions(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const validSessions = sessions
        .filter(row => row.start_time && row.end_time)
        .map(row => ({
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          teacher_id: row.teacher_id !== "" ? Number(row.teacher_id) : null,
        }))

      const payload = {
        ...form,
        subject: form.subject || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description || null,
        sessions: validSessions,
      }
      await createClass(payload)
      setSuccess(true)
      setForm(EMPTY)
      setSessions([{ ...EMPTY_SESSION_ROW }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Add class</h1>
      <p className="text-sm text-slate-400 mb-6">Fields marked * are required.</p>

      {success && (
        <div className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✓ Class created successfully.
        </div>
      )}
      {error && (
        <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Class Name <span className="text-red-400">*</span>
            </label>
            <input
              name="name" type="text" value={form.name}
              onChange={handleChange} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select
              name="subject" value={form.subject}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Select —</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Status <span className="text-red-400">*</span>
            </label>
            <select
              name="status" value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              name="description" value={form.description}
              onChange={handleChange} rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
            <input
              name="start_date" type="date" value={form.start_date}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
            <input
              name="end_date" type="date" value={form.end_date}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

        </div>

        {/* Sessions section */}
        <div className="border-t border-slate-100 pt-4 mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Sessions
            </p>
            <button
              type="button"
              onClick={addSessionRow}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add session
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            A class can have multiple sessions (e.g. Monday 9–11am and Monday 11am–1pm), each with its own teacher and its own independent roster of students.
          </p>
          {!form.subject && (
            <p className="text-xs text-amber-600 mb-3">
              Select a subject above to filter the teacher list to those who teach it.
            </p>
          )}

          <div className="space-y-2">
            {sessions.map((row, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <select
                  value={row.day_of_week}
                  onChange={e => handleSessionChange(i, "day_of_week", e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  type="time"
                  value={row.start_time}
                  onChange={e => handleSessionChange(i, "start_time", e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="time"
                  value={row.end_time}
                  onChange={e => handleSessionChange(i, "end_time", e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <select
                  value={row.teacher_id}
                  onChange={e => handleSessionChange(i, "teacher_id", e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— No teacher assigned —</option>
                  {eligibleTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSessionRow(i)}
                    className="text-slate-400 hover:text-red-500 flex-shrink-0"
                    title="Remove this session"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Leave times blank for a row to skip it.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? "Saving..." : "Save class"}
        </button>
      </form>
    </div>
  )
}
