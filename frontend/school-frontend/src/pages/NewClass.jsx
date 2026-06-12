import { useState } from "react"
import { createClass } from "../api"

const EMPTY = {
  name: "",
  description: "",
  teacher_id: "",
  start_date: "",
  end_date: "",
  status: "Active",
}

export default function NewClass() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const payload = {
        ...form,
        teacher_id: form.teacher_id !== "" ? Number(form.teacher_id) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        description: form.description || null,
      }
      await createClass(payload)
      setSuccess(true)
      setForm(EMPTY)
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
