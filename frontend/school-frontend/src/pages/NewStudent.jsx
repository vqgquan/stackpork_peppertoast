import { useState } from "react"
import { createStudent } from "../api"

const FIELDS = [
  { name: "name",            label: "Full Name",       type: "text",   required: true },
  { name: "phone",           label: "Phone Number",    type: "text",   required: true },
  { name: "email",           label: "Email",           type: "email",  required: false },
  { name: "date_of_birth",   label: "Date of Birth",   type: "date",   required: false },
  { name: "address",         label: "Address",         type: "text",   required: false },
  { name: "facebook",        label: "Facebook",        type: "text",   required: false },
  { name: "citizenship",     label: "Citizenship",     type: "text",   required: false },
  { name: "passport_number", label: "Passport Number", type: "text",   required: false },
]

const EMPTY = {
  name: "", phone: "", gender: "Male", email: "",
  date_of_birth: "", address: "", facebook: "",
  citizenship: "", passport_number: "", customer_source: "",
}

export default function NewStudent() {
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
      // Send null for empty optional strings
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
      )
      // required fields must not be null
      payload.name = form.name
      payload.phone = form.phone
      payload.gender = form.gender
      await createStudent(payload)
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
      <h1 className="text-xl font-semibold mb-1">Add student</h1>
      <p className="text-sm text-slate-400 mb-6">Fields marked * are required.</p>

      {success && (
        <div className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✓ Student created successfully.
        </div>
      )}
      {error && (
        <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">

          {/* Text fields */}
          {FIELDS.map(f => (
            <div key={f.name} className={f.name === "address" ? "col-span-2" : ""}>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {f.label} {f.required && <span className="text-red-400">*</span>}
              </label>
              <input
                name={f.name}
                type={f.type}
                value={form[f.name]}
                onChange={handleChange}
                required={f.required}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          ))}

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Gender <span className="text-red-400">*</span>
            </label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Customer source */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer Source</label>
            <select
              name="customer_source"
              value={form.customer_source}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— Select —</option>
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="Referral">Referral</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Other">Other</option>
            </select>
          </div>

        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? "Saving..." : "Save student"}
        </button>
      </form>
    </div>
  )
}
