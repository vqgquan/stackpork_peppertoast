import { useState, useEffect, useMemo } from "react"
import { createStudent, createEnrollment, getClasses } from "../api"

const STUDENT_FIELDS = [
  { name: "name",            label: "Full Name",       type: "text",   required: true },
  { name: "phone",           label: "Phone Number",    type: "text",   required: false },
  { name: "date_of_birth",   label: "Date of Birth",   type: "date",   required: false },
  { name: "address",         label: "Address",         type: "text",   required: false, span: 2 },
]

const OPTIONAL_FIELDS = [
  { name: "email", label: "Email", type: "email" },
]

const CUSTOMER_SOURCE_OPTIONS = ["Fb Ads", "Gg Map", "Vãng lai", "Tiktok", "Giới thiệu"]
const CUSTOMER_GROUP_OPTIONS = ["Đã đăng ký", "Chưa đăng ký", "Khách hàng quay lại", "Khách VIP"]
const PAYMENT_METHODS = ["Tiền Mặt", "Chuyển khoản", "Pos"]
const NO_SUBJECT_LABEL = "Other"

function formatTime(t) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const EMPTY = {
  name: "", phone: "", gender: "Male", email: "",
  date_of_birth: "", address: "", customer_source: "",
  parent_name: "", parent_phone: "", customer_group: "",
}

function makeEmptyEnrollment() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject: "",
    class_id: "",
    session_ids: [],
    total_sessions: "",
    start_date: "",
    price: "",
    payment_method: "",
    discount: "",
  }
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const labelClass = "block text-xs font-medium text-slate-600 mb-1"

export default function NewStudent() {
  const [form, setForm] = useState(EMPTY)
  const [enrollments, setEnrollments] = useState([])
  const [activeClasses, setActiveClasses] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    getClasses().then(classes => {
      setActiveClasses(classes.filter(c => c.status === "Active"))
    })
  }, [])

  const subjects = useMemo(() => {
    const set = new Set(activeClasses.map(c => c.subject || NO_SUBJECT_LABEL))
    return Array.from(set).sort()
  }, [activeClasses])

  function classesForSubject(subject) {
    return activeClasses.filter(c => (c.subject || NO_SUBJECT_LABEL) === subject)
  }

  function sessionsForClass(classId) {
    const cls = activeClasses.find(c => String(c.id) === String(classId))
    return cls ? cls.sessions : []
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function addEnrollment() {
    setEnrollments(prev => [...prev, makeEmptyEnrollment()])
  }

  function removeEnrollment(key) {
    setEnrollments(prev => prev.filter(en => en.key !== key))
  }

  function updateEnrollment(key, field, value) {
    setEnrollments(prev =>
      prev.map(en => {
        if (en.key !== key) return en
        const updated = { ...en, [field]: value }
        if (field === "subject") {
          updated.class_id = ""
          updated.session_ids = []
        } else if (field === "class_id") {
          updated.session_ids = []
        }
        return updated
      })
    )
  }

  function toggleSession(key, sessionId) {
    setEnrollments(prev =>
      prev.map(en => {
        if (en.key !== key) return en
        const idStr = String(sessionId)
        const already = en.session_ids.map(String).includes(idStr)
        const session_ids = already
          ? en.session_ids.filter(id => String(id) !== idStr)
          : [...en.session_ids, sessionId]
        return { ...en, session_ids }
      })
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const studentPayload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
      )
      studentPayload.name = form.name
      studentPayload.phone = form.phone
      studentPayload.gender = form.gender || null

      const newStudent = await createStudent(studentPayload)

      // One enrollment per card — all selected session_ids share the same pool
      const enrollmentJobs = enrollments
        .filter(en => en.session_ids.length > 0)
        .map(en => ({
          student_id: newStudent.id,
          session_ids: en.session_ids.map(Number),
          enrolled_date: en.start_date || new Date().toISOString().slice(0, 10),
          status: "Enrolled",
          total_sessions: en.total_sessions !== "" ? Number(en.total_sessions) : null,
          price: en.price !== "" ? Number(en.price) : null,
          payment_method: en.payment_method || null,
          discount: en.discount || null,
        }))

      let enrollFailures = 0
      for (const job of enrollmentJobs) {
        try {
          await createEnrollment(job)
        } catch {
          enrollFailures += 1
        }
      }

      if (enrollmentJobs.length === 0) {
        setSuccess("✓ Student created successfully.")
      } else if (enrollFailures === 0) {
        setSuccess(
          enrollmentJobs.length === 1
            ? "✓ Student created and enrolled successfully."
            : `✓ Student created and enrolled in ${enrollmentJobs.length} class pack(s) successfully.`
        )
      } else {
        setSuccess(
          `✓ Student created, but ${enrollFailures} of ${enrollmentJobs.length} enrollment(s) failed. You can enroll them from the student's detail page.`
        )
      }

      setForm(EMPTY)
      setEnrollments([])
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
          {success}
        </div>
      )}
      {error && (
        <div className="mb-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* I. Student Information */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          I. Student Information
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {STUDENT_FIELDS.map(f => (
            <div key={f.name} className={f.span === 2 ? "col-span-2" : ""}>
              <label className={labelClass}>
                {f.label} {f.required && <span className="text-red-400">*</span>}
              </label>
              <input
                name={f.name}
                type={f.type}
                value={form[f.name]}
                onChange={handleChange}
                required={f.required}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label className={labelClass}>Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} className={inputClass}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {OPTIONAL_FIELDS.map(f => (
            <div key={f.name}>
              <label className={labelClass}>{f.label}</label>
              <input
                name={f.name} type={f.type} value={form[f.name]} onChange={handleChange}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        {/* II. Parent / Guardian Information */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          II. Parent / Guardian Information
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass}>Parent Full Name</label>
            <input
              name="parent_name" type="text" value={form.parent_name} onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Parent Phone Number</label>
            <input
              name="parent_phone" type="text" value={form.parent_phone} onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        {/* Customer classification */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Customer Classification
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass}>Customer Source</label>
            <select name="customer_source" value={form.customer_source} onChange={handleChange} className={inputClass}>
              <option value="">— Select —</option>
              {CUSTOMER_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Customer Group</label>
            <select name="customer_group" value={form.customer_group} onChange={handleChange} className={inputClass}>
              <option value="">— Select —</option>
              {CUSTOMER_GROUP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* III. Course Registration */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          III. Course Registration{" "}
          <span className="text-slate-400 normal-case font-normal">
            (optional — pick a subject, a class, then one or more sessions)
          </span>
        </p>

        <div className="space-y-4">
          {enrollments.map((en, idx) => {
            const classOptions = en.subject ? classesForSubject(en.subject) : []
            const sessionOptions = en.class_id ? sessionsForClass(en.class_id) : []

            return (
              <div key={en.key} className="border border-slate-200 rounded-lg p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Class Registration #{idx + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeEnrollment(en.key)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelClass}>Subject</label>
                    <select
                      value={en.subject}
                      onChange={e => updateEnrollment(en.key, "subject", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Select —</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Class</label>
                    <select
                      value={en.class_id}
                      onChange={e => updateEnrollment(en.key, "class_id", e.target.value)}
                      disabled={!en.subject}
                      className={inputClass}
                    >
                      <option value="">— Select —</option>
                      {classOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className={labelClass}>
                    Sessions{" "}
                    {en.class_id && (
                      <span className="text-slate-400 font-normal">(select one or more — they share the session pool below)</span>
                    )}
                  </label>

                  {!en.class_id ? (
                    <p className="text-xs text-slate-400 italic px-1">Choose a class first.</p>
                  ) : sessionOptions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic px-1">This class has no sessions yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {sessionOptions.map(s => {
                        const checked = en.session_ids.map(String).includes(String(s.id))
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer transition-colors ${
                              checked ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSession(en.key, s.id)}
                              className="accent-blue-600"
                            />
                            <span className="flex-1">
                              {s.day_of_week.slice(0, 3)} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {s.teacher_name || "Unassigned"}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Total Sessions</label>
                    <input
                      type="number" min="1" value={en.total_sessions} placeholder="e.g. 6"
                      onChange={e => updateEnrollment(en.key, "total_sessions", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input
                      type="date" value={en.start_date}
                      onChange={e => updateEnrollment(en.key, "start_date", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Price</label>
                    <input
                      type="number" min="0" value={en.price} placeholder="VNĐ"
                      onChange={e => updateEnrollment(en.key, "price", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Payment Method</label>
                    <select
                      value={en.payment_method}
                      onChange={e => updateEnrollment(en.key, "payment_method", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Select —</option>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Discount</label>
                    <input
                      type="text" value={en.discount} placeholder="e.g. 10% or 200,000đ"
                      onChange={e => updateEnrollment(en.key, "discount", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {en.session_ids.length > 1 && (
                  <p className="text-xs text-slate-400 mt-3 italic">
                    {en.total_sessions !== ""
                      ? `${en.total_sessions} sessions shared across all ${en.session_ids.length} selected slots — the student can attend any combination. `
                      : ""}
                    Price and payment method apply to the whole pack.
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addEnrollment}
          className="mt-3 w-full py-2 border border-dashed border-slate-300 text-sm text-slate-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add class registration
        </button>

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
