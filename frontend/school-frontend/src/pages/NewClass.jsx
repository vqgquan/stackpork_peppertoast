import { useState } from "react"
import { createClass } from "../api"

export default function NewClass() {
    const [form, setForm] = useState({
        name: "",
        description: "",
        teacher_id: "",
        start_date: "",
        end_date: "",
        status: "Active",
    })
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
        try {
            // teacher_id must be a number or null, not an empty string
            const payload = {
                ...form,
                teacher_id: form.teacher_id !== "" ? Number(form.teacher_id) : null,
            }
            await createClass(payload)
            setSuccess(true)
            setForm({ name: "", description: "", teacher_id: "", start_date: "", end_date: "", status: "Active" })
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="p-8 max-w-md">
            <h1 className="text-xl font-semibold mb-6">Add class</h1>

            {success && (
                <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    Class created successfully.
                </div>
            )}
            {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                    <input
                        name="name" value={form.name} onChange={handleChange}
                        required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <textarea
                        name="description" value={form.description} onChange={handleChange}
                        rows={3} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Teacher ID</label>
                    <input
                        name="teacher_id" type="number" value={form.teacher_id} onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                    <input
                        name="start_date" type="date" value={form.start_date} onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                    <input
                        name="end_date" type="date" value={form.end_date} onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status *</label>
                    <select
                        name="status" value={form.status} onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option>Active</option>
                        <option>Completed</option>
                        <option>Cancelled</option>
                    </select>
                </div>
                <button
                    type="submit" disabled={submitting}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {submitting ? 'Saving...' : 'Save class'}
                </button>
            </form>
        </div>
    )
}