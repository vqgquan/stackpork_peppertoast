import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { getStudents, getClasses, deleteStudent } from "../api"
import SearchBar from "../components/SearchBar"

const SEARCH_FIELDS = [
  { key: "name",   label: "Name" },
  { key: "phone",  label: "Phone" },
  { key: "gender", label: "Gender" },
  { key: "email",  label: "Email" },
]

export default function Students() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    Promise.all([getStudents(), getClasses()])
      .then(([studentsData, classesData]) => {
        setStudents(studentsData)
        setClasses(classesData)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Build student_id -> sorted list of distinct subjects, scoped to
  // active classes with currently-enrolled students only.
  const subjectsByStudent = useMemo(() => {
    const map = {}
    for (const c of classes) {
      if (!c.subject || c.status !== "Active") continue
      for (const session of c.sessions ?? []) {
        for (const student of session.students ?? []) {
          if (!map[student.id]) map[student.id] = new Set()
          map[student.id].add(c.subject)
        }
      }
    }
    const sorted = {}
    for (const [id, set] of Object.entries(map)) {
      sorted[id] = [...set].sort()
    }
    return sorted
  }, [classes])

  const filtered = useMemo(() => {
    if (Object.keys(filters).length === 0) return students
    return students.filter(s =>
      Object.entries(filters).every(([key, value]) =>
        String(s[key] ?? "").toLowerCase().includes(value.toLowerCase())
      )
    )
  }, [students, filters])

  async function handleDelete(e, id) {
    e.stopPropagation()  // prevent row click from firing
    if (!confirm("Delete this student?")) return
    try {
      await deleteStudent(id)
      setStudents(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      alert("Error deleting student: " + err.message)
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">Students</h1>

      <SearchBar fields={SEARCH_FIELDS} onSearch={setFilters} />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          {students.length === 0
            ? "No students yet. Add one from the sidebar."
            : "No students match your search."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Parent Phone</th>
                <th className="px-4 py-3">Customer Group</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/students/${s.id}`)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-blue-700">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                    }`}>
                      {s.gender}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.email}</td>
                  <td className="px-4 py-3 text-slate-600">{s.parent_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.parent_phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.customer_group
                      ? <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{s.customer_group}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {(subjectsByStudent[s.id]?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {subjectsByStudent[s.id].map(subj => (
                          <span key={subj} className="inline-block text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            {subj}
                          </span>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-2">
            Showing {filtered.length} of {students.length} students
          </p>
        </div>
      )}
    </div>
  )
}