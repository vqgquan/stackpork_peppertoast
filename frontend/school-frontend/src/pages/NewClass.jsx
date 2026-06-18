import { useState } from "react"
import { createClass } from "../api"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const EMPTY = {
  name: "",
  description: "",
  teacher_id: "",
  start_date: "",
  end_date: "",
  status: "Active",
}

const EMPTY_SCHEDULE_ROW = { day_of_week: "Monday", start_time: "", end_time: "" }

export default function NewClass() {
  const [form, setForm] = useState(EMPTY)
  const [schedules, setSchedules] = useState([{ ...EMPTY_SCHEDULE_ROW }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleScheduleChange(index, field, value) {
    setSchedules(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function addScheduleRow() {
    setSchedules(prev => [...prev, { ...EMPTY_SCHEDULE_ROW }])
  }

  function removeScheduleRow(index) {
    setSchedules(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      // Only keep schedule rows where both times are filled in
      const validSchedules = schedules
        .filter(row => row.start_time && row.end_time)
        .map(row => ({
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
        }))

      const payload = {
        ...form,
        teacher_id: form.teacher_id !== "" ? Number(form.teacher_id) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description || null,
        schedules: validSchedules,
      }
      await createClass(payload)
      setSuccess(true)
      setForm(EMPTY)
      setSchedules([{ ...EMPTY_SCHEDULE_ROW }])
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

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              name="description" value={form.description}
              onChange={handleChange} rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teacher ID</label>
            <input
              name="teacher_id" type="number" value={form.teacher_id}
              onChange={handleChange} min="1"
              placeholder="Leave blank if unassigned"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <p className="text-xs text-slate-400 mt-1">Enter the ID from the Teachers list</p>
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

        {/* Weekly schedule section */}
        <div className="border-t border-slate-100 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Weekly schedule
            </p>
            <button
              type="button"
              onClick={addScheduleRow}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add day
            </button>
          </div>

          <div className="space-y-2">
            {schedules.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.day_of_week}
                  onChange={e => handleScheduleChange(i, "day_of_week", e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  type="time"
                  value={row.start_time}
                  onChange={e => handleScheduleChange(i, "start_time", e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="time"
                  value={row.end_time}
                  onChange={e => handleScheduleChange(i, "end_time", e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {schedules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScheduleRow(i)}
                    className="text-slate-400 hover:text-red-500 flex-shrink-0"
                    title="Remove this day"
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
            Leave times blank for a day to skip it. A class can meet on multiple days each with its own time.
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
