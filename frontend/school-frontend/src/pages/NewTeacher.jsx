import { useState } from "react"
import { createTeacher } from "../api"
import TimeSelect from "../components/TimeSelect"

const SUBJECTS = ["Guitar", "Guitar điện", "Piano", "Organ", "Trống", "Thanh nhạc"]
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const EMPTY_AVAILABILITY_ROW = { day_of_week: "Monday", start_time: "", end_time: "", subject: "" }

const EMPTY = {
  name: "",
  phone: "",
  gender: "Male",
  email: "",
  date_of_birth: "",
  address: "",
}

export default function NewTeacher() {
  const [form, setForm] = useState(EMPTY)
  const [subjects, setSubjects] = useState([])
  const [degrees, setDegrees] = useState([""])
  const [availability, setAvailability] = useState([{ ...EMPTY_AVAILABILITY_ROW }])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const hasMultipleSubjects = subjects.length > 1

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleSubject(subject) {
    setSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    )
  }

  // Degrees
  function handleDegreeChange(index, value) {
    setDegrees(prev => prev.map((d, i) => i === index ? value : d))
  }
  function addDegreeRow() {
    setDegrees(prev => [...prev, ""])
  }
  function removeDegreeRow(index) {
    setDegrees(prev => prev.filter((_, i) => i !== index))
  }

  // Availability
  function handleAvailabilityChange(index, field, value) {
    setAvailability(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }
  function addAvailabilityRow() {
    setAvailability(prev => [...prev, { ...EMPTY_AVAILABILITY_ROW }])
  }
  function removeAvailabilityRow(index) {
    setAvailability(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (subjects.length === 0) {
      setError("Please select at least one teaching subject.")
      return
    }

    const filledRows = availability.filter(row => row.start_time && row.end_time)
    if (hasMultipleSubjects && filledRows.some(row => !row.subject)) {
      setError("Please choose a subject for each schedule slot.")
      return
    }

    setSubmitting(true)
    try {
      const validAvailability = filledRows.map(row => ({
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        subject: hasMultipleSubjects ? row.subject : subjects[0],
      }))

      const payload = {
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        address: form.address || null,
        subjects,
        qualifications: degrees.map(d => d.trim()).filter(Boolean),
        availability: validAvailability,
      }

      await createTeacher(payload)
      setSuccess(true)
      setForm(EMPTY)
      setSubjects([])
      setDegrees([""])
      setAvailability([{ ...EMPTY_AVAILABILITY_ROW }])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Add teacher</h1>
      <p className="text-sm text-slate-400 mb-6">Fields marked * are required.</p>

      {success && (
        <div className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✓ Teacher created successfully.
        </div>
      )}
      {error && (
        <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Section 1: Basic info */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Basic Information
        </p>
        <div className="grid grid-cols-2 gap-4">

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              name="name" type="text" value={form.name}
              onChange={handleChange} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              name="phone" type="text" value={form.phone}
              onChange={handleChange} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Gender <span className="text-red-400">*</span>
            </label>
            <select
              name="gender" value={form.gender}
              onChange={handleChange} required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              name="email" type="email" value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
            <input
              name="date_of_birth" type="date" value={form.date_of_birth}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input
              name="address" type="text" value={form.address}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

        </div>

        {/* Section 2: Teaching info */}
        <div className="border-t border-slate-100 pt-4 mt-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Teaching Information
          </p>

          {/* Subjects */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Teaching Subjects <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SUBJECTS.map(subject => {
                const checked = subjects.includes(subject)
                return (
                  <label
                    key={subject}
                    className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubject(subject)}
                      className="accent-blue-600"
                    />
                    {subject}
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2">Select at least one subject.</p>
          </div>

          {/* Degrees */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">Degrees</label>
              <button
                type="button"
                onClick={addDegreeRow}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add degree
              </button>
            </div>
            <div className="space-y-2">
              {degrees.map((degree, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={degree}
                    onChange={e => handleDegreeChange(i, e.target.value)}
                    placeholder="e.g. Bachelor of Music"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {degrees.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDegreeRow(i)}
                      className="text-slate-400 hover:text-red-500 flex-shrink-0"
                      title="Remove this degree"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Teaching schedule */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-600">Teaching Schedule</label>
              <button
                type="button"
                onClick={addAvailabilityRow}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add slot
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Set the days and times this teacher is generally available to teach.
              {hasMultipleSubjects && " Since they teach multiple subjects, pick which one applies to each slot."}
            </p>

            <div className="space-y-2">
              {availability.map((row, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={row.day_of_week}
                    onChange={e => handleAvailabilityChange(i, "day_of_week", e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <TimeSelect
                    value={row.start_time}
                    onChange={value => handleAvailabilityChange(i, "start_time", value)}
                    className="min-w-[90px]"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <TimeSelect
                    value={row.end_time}
                    onChange={value => handleAvailabilityChange(i, "end_time", value)}
                    className="min-w-[90px]"
                  />
                  {hasMultipleSubjects && (
                    <select
                      value={row.subject}
                      onChange={e => handleAvailabilityChange(i, "subject", e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Choose subject —</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {availability.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAvailabilityRow(i)}
                      className="text-slate-400 hover:text-red-500 flex-shrink-0"
                      title="Remove this slot"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Leave times blank for a row to skip it.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? "Saving..." : "Save teacher"}
        </button>
      </form>
    </div>
  )
}