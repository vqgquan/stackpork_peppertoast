import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { getTeachers, deleteTeacher } from "../api"
import SearchBar from "../components/SearchBar"

const SEARCH_FIELDS = [
  { key: "name",    label: "Name" },
  { key: "email",   label: "Email" },
  { key: "subject", label: "Subject" },
]

export default function Teachers() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    getTeachers()
      .then(data => setTeachers(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (Object.keys(filters).length === 0) return teachers
    return teachers.filter(t =>
      Object.entries(filters).every(([key, value]) =>
        String(t[key] ?? "").toLowerCase().includes(value.toLowerCase())
      )
    )
  }, [teachers, filters])

  async function handleDelete(e, id) {
    e.stopPropagation()  // prevent row click from firing
    if (!confirm("Delete this teacher?")) return
    try {
      await deleteTeacher(id)
      setTeachers(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      alert("Error deleting teacher: " + err.message)
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">Teachers</h1>
      <SearchBar fields={SEARCH_FIELDS} onSearch={setFilters} />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          {teachers.length === 0
            ? "No teachers yet. Add one from the sidebar."
            : "No teachers match your search."}
        </p>
      ) : (
        <>
          <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Phone number</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/teachers/${t.id}`)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-blue-700">{t.name}</td>
                  <td className="px-4 py-3">
                    {t.subjects
                      ? <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.subjects}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{t.address ?? "—"}</td>
                  
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleDelete(e, t.id)}
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
            Showing {filtered.length} of {teachers.length} teachers
          </p>
        </>
      )}
    </div>
  )
}