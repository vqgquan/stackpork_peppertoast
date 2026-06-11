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
export const createTeacher = (data) => request("POST", "/teachers", data);
export const updateTeacher = (id, data) => request("PUT", `/teachers/${id}`, data);
export const deleteTeacher = (id) => request("DELETE", `/teachers/${id}`);

export const getStudents = () => request("GET", "/students");
export const getStudent = (id) => request("GET", `/students/${id}`);
export const createStudent = (data) => request("POST", "/students", data);
export const updateStudent = (id, data) => request("PUT", `/students/${id}`, data);
export const deleteStudent = (id) => request("DELETE", `/students/${id}`);

export const getClasses = () => request("GET", "/classes");
export const getClass = (id) => request("GET", `/classes/${id}`);
export const createClass = (data) => request("POST", "/classes", data);
export const updateClass = (id, data) => request("PUT", `/classes/${id}`, data);
export const deleteClass = (id) => request("DELETE", `/classes/${id}`); 

export const getEnrollments = () => request("GET", "/enrollments");
export const createEnrollment = (data) => request("POST", "/enrollments", data);
export const deleteEnrollment = (id) => request("DELETE", `/enrollments/${id}`);
export const getEnrollment = (id) => request("GET", `/enrollments/${id}`);
export const updateEnrollment = (id, data) => request("PUT", `/enrollments/${id}`, data);


