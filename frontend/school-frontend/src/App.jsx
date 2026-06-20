import { Routes, Route, Link, useLocation } from "react-router-dom";
import Teachers from "./pages/Teachers";
import NewTeacher from "./pages/NewTeacher";
import Classes from "./pages/Classes";
import NewClass from "./pages/NewClass";
import Students from "./pages/Students";
import NewStudent from "./pages/NewStudent";
import StudentDetail from "./pages/StudentDetail";
import TeacherDetail from './pages/TeacherDetail'

export default function App() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-48 bg-white border-r border-slate-200 p-3">
        <p className="px-3 py-3 text-sm font-semibold text-slate-900">
          School Admin
        </p>
        {[
          ["/teachers", "Teachers"],
          ["/teachers/new", "Add Teacher"],
          ["/students", "Students"],
          ["/students/new", "Add Student"],
          ["/classes", "Classes"],
          ["/classes/new", "Add Class"],
        ].map(([path, label]) => (
          <Link
            key={path}
            to={path}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              location.pathname === path
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/teachers/new" element={<NewTeacher />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/new" element={<NewClass />} />
          <Route path="/students" element={<Students />} />
          <Route path="/students/new" element={<NewStudent />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/teachers/:id" element={<TeacherDetail />} />
        </Routes>
      </main>
    </div>
  );
}
