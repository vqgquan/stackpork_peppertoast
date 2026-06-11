import React, {useEffect, useState } from "react"
import { getStudents, deleteStudent } from "../api"

export default function Students() {
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getStudents()
            .then(data => setStudents(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

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
    if (error) return <p className="p-8 text-red-500">{error}</p>

    return (<div className="p-8">
      <h1 className="text-xl font-semibold mb-6">Students</h1>
      <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr key={s.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3">{s.name}</td>
              <td className="px-4 py-3">{s.phone}</td>
              <td className="px-4 py-3">{s.email ?? '—'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}