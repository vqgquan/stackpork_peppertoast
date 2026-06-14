import { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { getStudents, deleteStudent } from "../api"
import SearchBar from "../components/SearchBar"

const SEARCH_FIELDS = [
  { key: "name",   label: "Name" },
  { key: "phone",  label: "Phone" },
  { key: "gender", label: "Gender" },
  { key: "email",  label: "Email" },
]

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    getStudents()
      .then(data => setStudents(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (Object.keys(filters).length === 0) return students
    return students.filter(s =>
      Object.entries(filters).every(([key, value]) =>
        String(s[key] ?? "").toLowerCase().includes(value.toLowerCase())
      )
    )
  }, [students, filters])

  async function handleDelete(id) {
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
                <th className="px-4 py-3">Date of Birth</th>
                <th className="px-4 py-3">Citizenship</th>
                <th className="px-4 py-3">Passport</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/students/${s.id}`} className="text-blue-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.gender === "Male" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                    }`}>
                      {s.gender}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.date_of_birth ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.citizenship ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.passport_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.customer_source
                      ? <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{s.customer_source}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
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
