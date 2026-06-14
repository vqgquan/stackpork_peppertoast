import { useEffect, useState, useMemo } from "react"
import { getClasses, deleteClass } from "../api"
import SearchBar from "../components/SearchBar"

const SEARCH_FIELDS = [
  { key: "name",        label: "Name" },
  { key: "status",      label: "Status" },
  { key: "description", label: "Description" },
]

const STATUS_STYLES = {
  Active:    "bg-green-50 text-green-700",
  Completed: "bg-slate-100 text-slate-600",
  Cancelled: "bg-red-50 text-red-600",
}

const DAY_ABBREV = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
}

function formatTime(t) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

export default function Classes() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    getClasses()
      .then(data => setClasses(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (Object.keys(filters).length === 0) return classes
    return classes.filter(c =>
      Object.entries(filters).every(([key, value]) =>
        String(c[key] ?? "").toLowerCase().includes(value.toLowerCase())
      )
    )
  }, [classes, filters])

  async function handleDelete(id) {
    if (!confirm("Delete this class?")) return
    try {
      await deleteClass(id)
      setClasses(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      alert("Error deleting class: " + err.message)
    }
  }

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>
  if (error)   return <p className="p-8 text-red-500">{error}</p>

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-6">Classes</h1>

      <SearchBar fields={SEARCH_FIELDS} onSearch={setFilters} />

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          {classes.length === 0
            ? "No classes yet. Add one from the sidebar."
            : "No classes match your search."}
        </p>
      ) : (
        <>
          <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Teacher ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.teacher_id ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.schedules && c.schedules.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.schedules.map(s => (
                          <span key={s.id} className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                            {DAY_ABBREV[s.day_of_week]} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          </span>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.start_date ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.end_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.id)}
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
            Showing {filtered.length} of {classes.length} classes
          </p>
        </>
      )}
    </div>
  )
}
