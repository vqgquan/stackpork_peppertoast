const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(BASE + path, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP error! status: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

export const getTeachers = () => request("GET", "/teachers");
export const getTeacher = (id) => request("GET", `/teachers/${id}`);
export const getTeacherDetail = (id) => request("GET", `/teachers/${id}/detail`);
export const createTeacher = (data) => request("POST", "/teachers", data);
export const updateTeacher = (id, data) => request("PUT", `/teachers/${id}`, data);
export const deleteTeacher = (id) => request("DELETE", `/teachers/${id}`);

export const getStudents = () => request("GET", "/students");
export const getStudent = (id) => request("GET", `/students/${id}`);
export const getStudentDetail = (id) => request("GET", `/students/${id}/detail`);
export const createStudent = (data) => request("POST", "/students", data);
export const updateStudent = (id, data) => request("PUT", `/students/${id}`, data);
export const deleteStudent = (id) => request("DELETE", `/students/${id}`);

export const getClasses = () => request("GET", "/classes");
export const getClass = (id) => request("GET", `/classes/${id}`);
export const createClass = (data) => request("POST", "/classes", data);
export const updateClass = (id, data) => request("PUT", `/classes/${id}`, data);
export const deleteClass = (id) => request("DELETE", `/classes/${id}`);

export const createClassSession = (classId, data) => request("POST", `/classes/${classId}/sessions`, data);
export const updateClassSession = (sessionId, data) => request("PUT", `/sessions/${sessionId}`, data);
export const deleteClassSession = (sessionId) => request("DELETE", `/sessions/${sessionId}`);

export const getEnrollments = () => request("GET", "/enrollments");
export const createEnrollment = (data) => request("POST", "/enrollments", data);
export const deleteEnrollment = (id) => request("DELETE", `/enrollments/${id}`);
export const getEnrollment = (id) => request("GET", `/enrollments/${id}`);
export const updateEnrollment = (id, data) => request("PUT", `/enrollments/${id}`, data);

// Soft-end an enrollment (student exhausted their pack and won't renew, or
// left the class on their own). Keeps the enrollment + its history around
// and moves it into the student's "Past Enrollments" list.
// status defaults to "Dropped" server-side if omitted.
export const endEnrollment = (id, data) => request("POST", `/enrollments/${id}/end`, data);
// Undo an accidental end — puts the enrollment back on the active roster.
export const reactivateEnrollment = (id) => request("POST", `/enrollments/${id}/reactivate`);
// Buy more sessions for an active enrollment's shared pool. data: { additional_sessions, additional_price? }
export const addSessionsToEnrollment = (id, data) => request("POST", `/enrollments/${id}/add-sessions`, data);

export const getStudentReviews = (studentId) => request("GET", `/students/${studentId}/reviews`);
export const createStudentReview = (studentId, data) => request("POST", `/students/${studentId}/reviews`, data);
export const getTeacherReviews = (teacherId) => request("GET", `/teachers/${teacherId}/reviews`);
export const getReviews = () => request("GET", "/reviews");
export const getReview = (id) => request("GET", `/reviews/${id}`);
export const getClassReviews = (classId) => request("GET", `/classes/${classId}/reviews`);
export const deleteReview = (id) => request("DELETE", `/reviews/${id}`);
export const markSessionMissed = (studentId, sessionId, data) => request("POST", `/students/${studentId}/sessions/${sessionId}/miss`, data);
export const updateReview = (id, data) => request("PUT", `/reviews/${id}`, data);

export function getAttendance(params = {}) {
    const query = new URLSearchParams()
    if (params.session_id != null) query.append("session_id", params.session_id)
    if (params.student_id != null) query.append("student_id", params.student_id)
    if (params.date_from)          query.append("date_from",  params.date_from)
    if (params.date_to)            query.append("date_to",    params.date_to)
    return request("GET", `/attendance?${query.toString()}`)
}
export const createAttendance     = (data) => request("POST",   "/attendance", data);
export const updateAttendance     = (id, data) => request("PUT", `/attendance/${id}`, data);
export const deleteAttendance     = (id) => request("DELETE", `/attendance/${id}`);
export const bulkUpsertAttendance = (records) => request("POST", "/attendance/bulk", records);

// Fetch a single attendance record matching student + session + date
// using the dedicated query-param endpoint on the backend.
// Returns the record object or null if none exists.
export async function getAttendanceRecord(student_id, session_id, attendance_date) {
    const query = new URLSearchParams({
        student_id,
        session_id,
        attendance_date,
    })
    const res = await fetch(`${BASE}/attendance/record?${query.toString()}`)
    if (!res.ok) return null
    return res.json()  // backend returns null (JSON) if not found
}

// Delete a single attendance record by id.
export const deleteAttendanceRecord = (id) => request("DELETE", `/attendance/${id}`);

export const getDashboardAttendance   = (month, year) => request("GET", `/dashboard/attendance?month=${month}&year=${year}`);
export const getDashboardTeacherHours = (month, year) => request("GET", `/dashboard/teacher-hours?month=${month}&year=${year}`);

// --- Inventory ---
export const getInventory = () => request("GET", "/inventory");
export const createInventoryItem = (data) => request("POST", "/inventory", data);
export const updateInventoryItem = (id, data) => request("PUT", `/inventory/${id}`, data);
export const deleteInventoryItem = (id) => request("DELETE", `/inventory/${id}`);
// reason is optional — shown on the /inventory/history ledger for total_quantity changes.
export const adjustInventoryItem = (id, field, delta, reason) =>
  request("POST", `/inventory/${id}/adjust`, { field, delta, reason: reason || null });

// Restock at a known unit cost. Updates the item's cost_price to this
// value (always the latest) while the price paid is kept forever on the
// /inventory/history ledger entry this creates.
// data: { quantity, unit_cost, purchase_date?, reason? }
export const purchaseInventoryItem = (id, data) => request("POST", `/inventory/${id}/purchase`, data);

// Sell to a customer at a known unit price. Updates the item's sale_price
// to this value (always the latest) while the price charged — and the
// cost at the time, for profit — are kept forever on the ledger entry.
// data: { quantity, unit_price, buyer_name?, sale_date?, notes? }
export const sellInventoryItem = (id, data) => request("POST", `/inventory/${id}/sell`, data);

// Full in/out history ledger (purchases, corrections, gifts to students,
// and sales to customers) — this is also the backlog of past prices for
// an item, since InventoryItem only stores the latest cost/sale price.
// Pass an item id to scope to a single item, or omit for the whole school.
export const getInventoryHistory = (itemId) =>
  request("GET", `/inventory/history${itemId != null ? `?item_id=${itemId}` : ""}`);

// --- Gifts ---
// Full history of inventory items gifted to students (also surfaced,
// merged with restocks/corrections/sales, via getInventoryHistory above).
export const getGifts = (studentId) =>
  request("GET", `/gifts${studentId != null ? `?student_id=${studentId}` : ""}`);
