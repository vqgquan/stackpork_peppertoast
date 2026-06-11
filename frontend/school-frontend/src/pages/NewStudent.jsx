import {useState} from "react";
import {createStudent} from "../api";

export default function NewStudent() {
    const [form, setForm] = useState({
        name: "",
        phone: "",
        gender: "",
        email: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    function handleChange(e) {
        setForm(prev => ({...prev, [e.target.name]: e.target.value}));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            await createStudent(form);
            setSuccess(true);
            setForm({name: "", phone :"", gender: "", email: ""});
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
    <div className="p-8 max-w-md">
      <h1 className="text-xl font-semibold mb-6">Add student</h1>

      {success && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          Student created successfully.
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label>
          <input
            name="phone" value={form.phone} onChange={handleChange}
            required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
          <select
            name="gender" value={form.gender} onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input
            name="email" type="email" value={form.email} onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit" disabled={submitting}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? 'Saving...' : 'Save student'}
        </button>
      </form>
    </div>
  )
}