import { useEffect, useState } from "react"
import { getClasses, deleteClass } from "../api"

export default function Classes() {
    const [classes, setClasses] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getClasses()
            .then(data => setClasses(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

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
    if (error) return <p className="p-8 text-red-500">{error}</p>

    return (
        <div className="p-8">
            <h1 className="text-xl font-semibold mb-6">Classes</h1>
            <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
                <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Start Date</th>
                        <th className="px-4 py-3">End Date</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {classes.map(c => (
                        <tr key={c.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-3">{c.name}</td>
                            <td className="px-4 py-3">{c.status}</td>
                            <td className="px-4 py-3">{c.start_date ?? '—'}</td>
                            <td className="px-4 py-3">{c.end_date ?? '—'}</td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => handleDelete(c.id)}
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