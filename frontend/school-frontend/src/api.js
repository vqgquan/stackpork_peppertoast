const BASE = "http://localhost:8000";

async function request(method, path, body = null) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(BASE + path, options);

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `HTTP error! status: ${res.status}`);
    }

    if (res.status === 204) {
        return null; // No content
    }

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

export const getStudentReviews = (studentId) => request("GET", `/students/${studentId}/reviews`);
export const createStudentReview = (studentId, data) => request("POST", `/students/${studentId}/reviews`, data);
export const getTeacherReviews = (teacherId) => request("GET", `/teachers/${teacherId}/reviews`);
export const getReviews = () => request("GET", "/reviews");
export const getReview = (id) => request("GET", `/reviews/${id}`);
export const getClassReviews = (classId) => request("GET", `/classes/${classId}/reviews`);
export const deleteReview = (id) => request("DELETE", `/reviews/${id}`);
