from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy import create_engine, Column, Integer, String, Date, Time, ForeignKey, Enum, Boolean, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional
from datetime import date, time, timedelta
from dotenv import load_dotenv
import os
import enum
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

# --- DB Setup ---
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Enums ---
class ClassStatusEnum(str, enum.Enum):
    active = "Active"
    completed = "Completed"
    cancelled = "Cancelled"

class EnrollmentStatusEnum(str, enum.Enum):
    enrolled = "Enrolled"
    dropped = "Dropped"
    completed = "Completed"

class DayOfWeekEnum(str, enum.Enum):
    monday = "Monday"
    tuesday = "Tuesday"
    wednesday = "Wednesday"
    thursday = "Thursday"
    friday = "Friday"
    saturday = "Saturday"
    sunday = "Sunday"

# --- Constants ---
ALLOWED_SUBJECTS = ["Guitar", "Guitar điện", "Piano", "Organ", "Trống", "Thanh nhạc"]

DAY_TO_WEEKDAY = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}

SESSION_RESULT_UNATTENDED = "Unattended"

# --- Models ---
class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    subjects = Column(String, nullable=True)
    qualifications = Column(String, nullable=True)
    customer_source = Column(String, nullable=True)
    sessions = relationship("ClassSession", back_populates="teacher")
    session_reviews = relationship("SessionReview", back_populates="teacher")
    availability = relationship("TeacherAvailability", back_populates="teacher", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="teacher")

class TeacherAvailability(Base):
    __tablename__ = "teacher_availability"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    day_of_week = Column(Enum(DayOfWeekEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    subject = Column(String, nullable=True)
    teacher = relationship("Teacher", back_populates="availability")

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    gender = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    customer_source = Column(String, nullable=True)
    parent_name = Column(String, nullable=True)
    parent_phone = Column(String, nullable=True)
    customer_group = Column(String, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    enrollments = relationship("Enrollment", back_populates="student")
    session_reviews = relationship("SessionReview", back_populates="student")

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(Enum(ClassStatusEnum), nullable=False, default=ClassStatusEnum.active)
    sessions = relationship("ClassSession", back_populates="class_", cascade="all, delete-orphan")

class ClassSession(Base):
    __tablename__ = "class_sessions"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    day_of_week = Column(Enum(DayOfWeekEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    valid_from = Column(Date, nullable=True)
    class_ = relationship("Class", back_populates="sessions")
    teacher = relationship("Teacher", back_populates="sessions")
    enrollments = relationship("Enrollment", back_populates="session")
    session_reviews = relationship("SessionReview", back_populates="session")
    attendance_records = relationship("AttendanceRecord", back_populates="session")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=False)
    enrolled_date = Column(Date, nullable=False)
    status = Column(Enum(EnrollmentStatusEnum), nullable=False, default=EnrollmentStatusEnum.enrolled)
    total_sessions = Column(Integer, nullable=True)
    remaining_sessions = Column(Integer, nullable=True)
    price = Column(Integer, nullable=True)
    payment_method = Column(String, nullable=True)
    discount = Column(String, nullable=True)
    student = relationship("Student", back_populates="enrollments")
    session = relationship("ClassSession", back_populates="enrollments")

class SessionReview(Base):
    __tablename__ = "session_reviews"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    review_date = Column(Date, nullable=False)
    session_content = Column(String, nullable=True)
    review_text = Column(String, nullable=True)
    session_result = Column(String, nullable=True)
    student = relationship("Student", back_populates="session_reviews")
    session = relationship("ClassSession", back_populates="session_reviews")
    teacher = relationship("Teacher", back_populates="session_reviews")

class AttendanceRecord(Base):
    """One row per (student, session, date) occurrence.
    attended=True  → student was present; burns one remaining session.
    attended=False → student was absent; does NOT burn a session.
    teacher_id is denormalised here so teacher-hours reports don't need
    to join through ClassSession when the teacher may have changed."""
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    attendance_date = Column(Date, nullable=False)
    attended = Column(Boolean, nullable=False, default=True)
    note = Column(String, nullable=True)
    student = relationship("Student")
    session = relationship("ClassSession", back_populates="attendance_records")
    teacher = relationship("Teacher", back_populates="attendance_records")
    __table_args__ = (
        UniqueConstraint("student_id", "session_id", "attendance_date", name="uq_attendance_per_occurrence"),
    )

Base.metadata.create_all(bind=engine)

# --- Teacher schemas ---
class TeacherAvailabilityCreate(BaseModel):
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    subject: Optional[str] = None

class TeacherAvailabilityOut(TeacherAvailabilityCreate):
    id: int
    class Config: from_attributes = True

class TeacherCreate(BaseModel):
    name: str
    phone: str
    gender: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    subjects: list[str] = Field(..., min_length=1)
    qualifications: list[str] = []
    availability: list[TeacherAvailabilityCreate] = []

    @field_validator("subjects")
    @classmethod
    def validate_subjects(cls, v):
        invalid = [s for s in v if s not in ALLOWED_SUBJECTS]
        if invalid:
            raise ValueError(f"Invalid subject(s): {', '.join(invalid)}. Must be one of {ALLOWED_SUBJECTS}")
        return v

    @model_validator(mode="after")
    def resolve_availability_subjects(self):
        single_subject = self.subjects[0] if len(self.subjects) == 1 else None
        for slot in self.availability:
            if single_subject is not None:
                slot.subject = single_subject
            elif not slot.subject:
                raise ValueError("Each schedule slot must specify a subject when the teacher has multiple subjects.")
            elif slot.subject not in self.subjects:
                raise ValueError(f"Schedule subject '{slot.subject}' is not one of this teacher's selected subjects.")
        return self

class TeacherOut(BaseModel):
    id: int
    name: str
    phone: str
    gender: str
    email: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    subjects: list[str] = []
    qualifications: list[str] = []
    class Config: from_attributes = True

def build_teacher_out(t: Teacher) -> TeacherOut:
    return TeacherOut(
        id=t.id, name=t.name, phone=t.phone, gender=t.gender, email=t.email,
        address=t.address, date_of_birth=t.date_of_birth,
        subjects=[s.strip() for s in t.subjects.split(",")] if t.subjects else [],
        qualifications=[q.strip() for q in t.qualifications.split(",")] if t.qualifications else [],
    )

class StudentCreate(BaseModel):
    name: str
    phone: str
    gender: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    customer_source: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    customer_group: Optional[str] = None

class StudentOut(StudentCreate):
    id: int
    is_archived: bool = False
    class Config: from_attributes = True

class SessionReviewCreate(BaseModel):
    student_id: int
    session_id: int
    teacher_id: Optional[int] = None
    review_date: date
    session_content: Optional[str] = None
    review_text: Optional[str] = None
    session_result: Optional[str] = None

class SessionReviewOut(SessionReviewCreate):
    id: int
    class Config: from_attributes = True

class SessionReviewUpdate(BaseModel):
    review_date: Optional[date] = None
    teacher_id: Optional[int] = None
    session_content: Optional[str] = None
    review_text: Optional[str] = None
    session_result: Optional[str] = None

class MarkMissedRequest(BaseModel):
    review_date: date

# --- Attendance schemas ---
class AttendanceCreate(BaseModel):
    student_id: int
    session_id: int
    teacher_id: Optional[int] = None
    attendance_date: date
    attended: bool = True
    note: Optional[str] = None

class AttendanceUpdate(BaseModel):
    attended: Optional[bool] = None
    note: Optional[str] = None
    teacher_id: Optional[int] = None

class AttendanceOut(BaseModel):
    id: int
    student_id: int
    session_id: int
    teacher_id: Optional[int] = None
    attendance_date: date
    attended: bool
    note: Optional[str] = None
    class Config: from_attributes = True

# --- Class session schemas ---
class ClassSessionCreate(BaseModel):
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    teacher_id: Optional[int] = None

class SessionRosterStudentOut(BaseModel):
    id: int
    name: str

class ClassSessionOut(BaseModel):
    id: int
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    students: list[SessionRosterStudentOut] = []
    class Config: from_attributes = True

class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = None
    subject: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ClassStatusEnum = ClassStatusEnum.active
    sessions: list[ClassSessionCreate] = []

class ClassOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    subject: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ClassStatusEnum
    sessions: list[ClassSessionOut] = []
    class Config: from_attributes = True

class ClassSessionReviewOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    session_id: int
    day_of_week: DayOfWeekEnum
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    review_date: date
    session_content: Optional[str] = None
    review_text: Optional[str] = None
    session_result: Optional[str] = None

def build_class_out(c: Class) -> ClassOut:
    sessions = []
    for s in c.sessions:
        roster = [
            SessionRosterStudentOut(id=e.student.id, name=e.student.name)
            for e in s.enrollments
            if e.status == EnrollmentStatusEnum.enrolled and not e.student.is_archived
        ]
        sessions.append(ClassSessionOut(
            id=s.id, day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time,
            teacher_id=s.teacher_id,
            teacher_name=s.teacher.name if s.teacher else None,
            students=roster,
        ))
    return ClassOut(
        id=c.id, name=c.name, description=c.description, subject=c.subject,
        start_date=c.start_date, end_date=c.end_date, status=c.status, sessions=sessions,
    )

class EnrollmentCreate(BaseModel):
    student_id: int
    session_id: int
    enrolled_date: date
    status: EnrollmentStatusEnum = EnrollmentStatusEnum.enrolled
    total_sessions: Optional[int] = None
    price: Optional[int] = None
    payment_method: Optional[str] = None
    discount: Optional[str] = None

class EnrollmentOut(EnrollmentCreate):
    id: int
    remaining_sessions: Optional[int] = None
    class Config: from_attributes = True

# --- Student detail schema ---
class StudentSessionOut(BaseModel):
    enrollment_id: int
    session_id: int
    class_id: int
    class_name: str
    subject: Optional[str] = None
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    enrolled_date: date
    total_sessions: Optional[int] = None
    remaining_sessions: Optional[int] = None
    price: Optional[int] = None
    payment_method: Optional[str] = None
    discount: Optional[str] = None

class StudentDetailOut(StudentOut):
    sessions: list[StudentSessionOut] = []

# --- Teacher detail schema ---
class TeacherSessionOut(BaseModel):
    session_id: int
    class_id: int
    class_name: str
    subject: Optional[str] = None
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time

class TeacherDetailOut(TeacherOut):
    sessions: list[TeacherSessionOut] = []
    availability: list[TeacherAvailabilityOut] = []

# --- Dashboard schemas ---
class AttendanceRowOut(BaseModel):
    """One row in the Student Attendance dashboard table.
    attendance_dates is an ordered list of all dates the session has
    occurred since enrollment; attended_dates is the subset where
    attended=True."""
    enrollment_id: int
    student_id: int
    student_name: str
    session_id: int
    class_id: int
    class_name: str
    subject: Optional[str]
    day_of_week: str
    start_time: time
    end_time: time
    teacher_id: Optional[int]
    teacher_name: Optional[str]
    enrolled_date: date
    price: Optional[int]
    payment_method: Optional[str]
    discount: Optional[str]
    total_sessions: Optional[int]
    remaining_sessions: Optional[int]
    # All occurrence dates from enrollment_date to today, ordered asc
    occurrence_dates: list[date]
    # Set of dates where an AttendanceRecord with attended=True exists
    attended_dates: set[date]
    # Set of dates where an AttendanceRecord with attended=False exists
    absent_dates: set[date]

    class Config:
        from_attributes = True

class TeacherHoursSlotOut(BaseModel):
    """One cell: teacher taught during this time slot on this date."""
    date: date
    start_time: time
    end_time: time
    class_name: Optional[str]
    subject: Optional[str]

class TeacherHoursRowOut(BaseModel):
    """One row in the Teacher Hours table — one teacher."""
    teacher_id: int
    teacher_name: str
    # All slots taught in the requested month, ordered by date then time
    slots: list[TeacherHoursSlotOut]
    total_hours: float  # sum of (end_time - start_time) for each slot in hours

# --- Helpers ---
def occurrence_dates_list(day_of_week, start_date: date, end_date: date) -> list[date]:
    if start_date > end_date:
        return []
    day_name = day_of_week.value if hasattr(day_of_week, "value") else day_of_week
    target = DAY_TO_WEEKDAY[day_name]
    delta = (target - start_date.weekday()) % 7
    current = start_date + timedelta(days=delta)
    dates = []
    while current <= end_date:
        dates.append(current)
        current += timedelta(days=7)
    return dates

def get_enrollment_for(db: Session, student_id: int, session_id: int) -> Optional[Enrollment]:
    return db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.session_id == session_id,
    ).first()

def count_attended_sessions(db: Session, student_id: int, session_id: int) -> int:
    """Count attendance records where the student was present.
    This is what drives remaining_sessions."""
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.attended == True,
    ).count()

def recompute_remaining(db: Session, enrollment: Enrollment):
    """Recompute remaining_sessions from total_sessions minus attended count."""
    if enrollment.total_sessions is not None:
        attended = count_attended_sessions(db, enrollment.student_id, enrollment.session_id)
        enrollment.remaining_sessions = enrollment.total_sessions - attended
    else:
        enrollment.remaining_sessions = None

# --- App ---
app = FastAPI(title="School Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Teachers ---
@app.get("/teachers", response_model=list[TeacherOut])
def get_teachers(db: Session = Depends(get_db)):
    return [build_teacher_out(t) for t in db.query(Teacher).all()]

@app.get("/teachers/{id}", response_model=TeacherOut)
def get_teacher(id: int, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return build_teacher_out(teacher)

@app.get("/teachers/{id}/detail", response_model=TeacherDetailOut)
def get_teacher_details(id: int, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    sessions = []
    for s in teacher.sessions:
        c = s.class_
        sessions.append(TeacherSessionOut(
            session_id=s.id, class_id=c.id, class_name=c.name, subject=c.subject,
            day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time,
        ))
    availability = [TeacherAvailabilityOut.model_validate(a) for a in teacher.availability]
    base = build_teacher_out(teacher)
    return TeacherDetailOut(**base.model_dump(), sessions=sessions, availability=availability)

@app.post("/teachers", response_model=TeacherOut, status_code=201)
def create_teacher(teacher: TeacherCreate, db: Session = Depends(get_db)):
    data = teacher.model_dump()
    subjects_list = data.pop("subjects")
    qualifications_list = data.pop("qualifications")
    availability_data = data.pop("availability", [])
    data["subjects"] = ", ".join(subjects_list)
    data["qualifications"] = ", ".join(qualifications_list)
    db_teacher = Teacher(**data)
    db.add(db_teacher)
    db.flush()
    for slot in availability_data:
        db.add(TeacherAvailability(teacher_id=db_teacher.id, **slot))
    db.commit()
    db.refresh(db_teacher)
    return build_teacher_out(db_teacher)

@app.put("/teachers/{id}", response_model=TeacherOut)
def update_teacher(id: int, updated: TeacherCreate, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    data = updated.model_dump()
    subjects_list = data.pop("subjects")
    qualifications_list = data.pop("qualifications")
    availability_data = data.pop("availability", [])
    data["subjects"] = ", ".join(subjects_list)
    data["qualifications"] = ", ".join(qualifications_list)
    for key, value in data.items():
        setattr(teacher, key, value)
    db.query(TeacherAvailability).filter(TeacherAvailability.teacher_id == id).delete()
    for slot in availability_data:
        db.add(TeacherAvailability(teacher_id=id, **slot))
    db.commit()
    db.refresh(teacher)
    return build_teacher_out(teacher)

@app.delete("/teachers/{id}", status_code=204)
def delete_teacher(id: int, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    db.delete(teacher)
    db.commit()

# --- Students ---
@app.get("/students", response_model=list[StudentOut])
def get_students(db: Session = Depends(get_db)):
    return db.query(Student).filter(Student.is_archived == False).all()

@app.get("/students/{id}", response_model=StudentOut)
def get_student(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id, Student.is_archived == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.get("/students/{id}/detail", response_model=StudentDetailOut)
def get_student_detail(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id, Student.is_archived == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    sessions = []
    for enrollment in student.enrollments:
        if enrollment.status != EnrollmentStatusEnum.enrolled:
            continue
        s = enrollment.session
        c = s.class_
        sessions.append(StudentSessionOut(
            enrollment_id=enrollment.id, session_id=s.id, class_id=c.id, class_name=c.name,
            subject=c.subject, day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time,
            teacher_id=s.teacher_id, teacher_name=s.teacher.name if s.teacher else None,
            enrolled_date=enrollment.enrolled_date, total_sessions=enrollment.total_sessions,
            remaining_sessions=enrollment.remaining_sessions, price=enrollment.price,
            payment_method=enrollment.payment_method, discount=enrollment.discount,
        ))
    result = StudentDetailOut.model_validate(student)
    result.sessions = sessions
    return result

@app.post("/students", response_model=StudentOut, status_code=201)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    db_student = Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

@app.put("/students/{id}", response_model=StudentOut)
def update_student(id: int, updated: StudentCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id, Student.is_archived == False).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for key, value in updated.model_dump().items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student

@app.delete("/students/{id}", status_code=204)
def archive_student(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_archived = True
    db.commit()

@app.post("/students/{id}/unarchive", response_model=StudentOut)
def unarchive_student(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.is_archived = False
    db.commit()
    db.refresh(student)
    return student

# --- Classes ---
@app.get("/classes", response_model=list[ClassOut])
def get_classes(db: Session = Depends(get_db)):
    return [build_class_out(c) for c in db.query(Class).all()]

@app.get("/classes/{id}", response_model=ClassOut)
def get_class(id: int, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    return build_class_out(c)

@app.post("/classes", response_model=ClassOut, status_code=201)
def create_class(payload: ClassCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    sessions_data = data.pop("sessions", [])
    c = Class(**data)
    db.add(c)
    db.flush()
    for sess in sessions_data:
        db.add(ClassSession(class_id=c.id, **sess))
    db.commit()
    db.refresh(c)
    return build_class_out(c)

@app.put("/classes/{id}", response_model=ClassOut)
def update_class(id: int, payload: ClassCreate, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    data = payload.model_dump()
    sessions_data = data.pop("sessions", [])
    for key, value in data.items():
        setattr(c, key, value)
    db.query(ClassSession).filter(ClassSession.class_id == id).delete()
    for sess in sessions_data:
        db.add(ClassSession(class_id=id, **sess))
    db.commit()
    db.refresh(c)
    return build_class_out(c)

@app.delete("/classes/{id}", status_code=204)
def delete_class(id: int, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(c)
    db.commit()

# --- Enrollments ---
@app.get("/enrollments", response_model=list[EnrollmentOut])
def get_enrollments(db: Session = Depends(get_db)):
    return db.query(Enrollment).all()

@app.get("/enrollments/{id}", response_model=EnrollmentOut)
def get_enrollment(id: int, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return e

@app.post("/enrollments", response_model=EnrollmentOut, status_code=201)
def create_enrollment(payload: EnrollmentCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.is_archived:
        raise HTTPException(status_code=400, detail="Cannot enroll an archived student")
    if not db.query(ClassSession).filter(ClassSession.id == payload.session_id).first():
        raise HTTPException(status_code=404, detail="Class session not found")
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == payload.student_id,
        Enrollment.session_id == payload.session_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this session")
    e = Enrollment(**payload.model_dump())
    e.remaining_sessions = e.total_sessions
    db.add(e)
    db.commit()
    db.refresh(e)
    return e

@app.put("/enrollments/{id}", response_model=EnrollmentOut)
def update_enrollment(id: int, payload: EnrollmentCreate, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    for key, value in payload.model_dump().items():
        setattr(e, key, value)
    recompute_remaining(db, e)
    db.commit()
    db.refresh(e)
    return e

@app.delete("/enrollments/{id}", status_code=204)
def delete_enrollment(id: int, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(e)
    db.commit()

# --- Session Reviews ---
@app.get("/students/{student_id}/reviews", response_model=list[SessionReviewOut])
def get_student_reviews(student_id: int, db: Session = Depends(get_db)):
    if not db.query(Student).filter(Student.id == student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    return db.query(SessionReview).filter(SessionReview.student_id == student_id).all()

@app.post("/students/{student_id}/reviews", response_model=SessionReviewOut, status_code=201)
def create_student_review(student_id: int, payload: SessionReviewCreate, db: Session = Depends(get_db)):
    if not db.query(Student).filter(Student.id == student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.query(ClassSession).filter(ClassSession.id == payload.session_id).first():
        raise HTTPException(status_code=404, detail="Class session not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    review = SessionReview(**payload.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    return review

@app.put("/reviews/{id}", response_model=SessionReviewOut)
def update_review(id: int, payload: SessionReviewUpdate, db: Session = Depends(get_db)):
    review = db.query(SessionReview).filter(SessionReview.id == id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(review, key, value)
    db.commit()
    db.refresh(review)
    return review

@app.delete("/reviews/{id}", status_code=204)
def delete_review(id: int, db: Session = Depends(get_db)):
    review = db.query(SessionReview).filter(SessionReview.id == id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()

@app.get("/teachers/{teacher_id}/reviews", response_model=list[SessionReviewOut])
def get_teacher_reviews(teacher_id: int, db: Session = Depends(get_db)):
    if not db.query(Teacher).filter(Teacher.id == teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    return db.query(SessionReview).filter(SessionReview.teacher_id == teacher_id).all()

@app.get("/reviews/{id}", response_model=SessionReviewOut)
def get_review(id: int, db: Session = Depends(get_db)):
    review = db.query(SessionReview).filter(SessionReview.id == id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review

@app.get("/reviews", response_model=list[SessionReviewOut])
def get_all_reviews(db: Session = Depends(get_db)):
    return db.query(SessionReview).all()

@app.get("/classes/{class_id}/reviews", response_model=list[ClassSessionReviewOut])
def get_class_reviews(class_id: int, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == class_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    session_ids = [s.id for s in c.sessions]
    reviews = (
        db.query(SessionReview).filter(SessionReview.session_id.in_(session_ids)).all()
        if session_ids else []
    )
    out = [
        ClassSessionReviewOut(
            id=r.id, student_id=r.student_id, student_name=r.student.name,
            session_id=r.session_id, day_of_week=r.session.day_of_week,
            teacher_id=r.teacher_id, teacher_name=r.teacher.name if r.teacher else None,
            review_date=r.review_date, session_content=r.session_content,
            review_text=r.review_text, session_result=r.session_result,
        )
        for r in reviews if not r.student.is_archived
    ]
    return sorted(out, key=lambda r: r.review_date, reverse=True)

# --- Class sessions ---
@app.post("/classes/{class_id}/sessions", response_model=ClassSessionOut, status_code=201)
def create_class_session(class_id: int, payload: ClassSessionCreate, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == class_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    s = ClassSession(class_id=class_id, **payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return ClassSessionOut(
        id=s.id, day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time,
        teacher_id=s.teacher_id, teacher_name=s.teacher.name if s.teacher else None, students=[],
    )

@app.put("/sessions/{session_id}", response_model=ClassSessionOut)
def update_class_session(session_id: int, payload: ClassSessionCreate, db: Session = Depends(get_db)):
    s = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    if s.day_of_week != payload.day_of_week:
        s.valid_from = date.today()
    s.day_of_week = payload.day_of_week
    s.start_time = payload.start_time
    s.end_time = payload.end_time
    s.teacher_id = payload.teacher_id
    db.commit()
    db.refresh(s)
    roster = [
        SessionRosterStudentOut(id=e.student.id, name=e.student.name)
        for e in s.enrollments
        if e.status == EnrollmentStatusEnum.enrolled and not e.student.is_archived
    ]
    return ClassSessionOut(
        id=s.id, day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time,
        teacher_id=s.teacher_id, teacher_name=s.teacher.name if s.teacher else None, students=roster,
    )

@app.delete("/sessions/{session_id}", status_code=204)
def delete_class_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        db.delete(s)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Can't delete this session — it has enrolled students or reviews attached. Remove those first.",
        )

# Legacy missed-session endpoint — kept for compatibility but no longer
# touches remaining_sessions (attendance records do that now).
@app.post("/students/{student_id}/sessions/{session_id}/miss", response_model=SessionReviewOut, status_code=201)
def mark_session_missed(student_id: int, session_id: int, payload: MarkMissedRequest, db: Session = Depends(get_db)):
    enrollment = get_enrollment_for(db, student_id, session_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found for this student/session")
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    review = db.query(SessionReview).filter(
        SessionReview.student_id == student_id,
        SessionReview.session_id == session_id,
        SessionReview.review_date == payload.review_date,
    ).first()
    if review:
        review.session_result = SESSION_RESULT_UNATTENDED
        review.session_content = None
        review.review_text = None
    else:
        review = SessionReview(
            student_id=student_id, session_id=session_id, teacher_id=session.teacher_id,
            review_date=payload.review_date, session_content=None, review_text=None,
            session_result=SESSION_RESULT_UNATTENDED,
        )
        db.add(review)
    db.commit()
    db.refresh(review)
    return review

# --- Attendance Records ---
@app.get("/attendance", response_model=list[AttendanceOut])
def get_attendance(
    session_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(AttendanceRecord)
    if session_id:
        q = q.filter(AttendanceRecord.session_id == session_id)
    if student_id:
        q = q.filter(AttendanceRecord.student_id == student_id)
    if date_from:
        q = q.filter(AttendanceRecord.attendance_date >= date_from)
    if date_to:
        q = q.filter(AttendanceRecord.attendance_date <= date_to)
    return q.order_by(AttendanceRecord.attendance_date).all()

@app.post("/attendance", response_model=AttendanceOut, status_code=201)
def create_attendance(payload: AttendanceCreate, db: Session = Depends(get_db)):
    if not db.query(Student).filter(Student.id == payload.student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.query(ClassSession).filter(ClassSession.id == payload.session_id).first():
        raise HTTPException(status_code=404, detail="Class session not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == payload.student_id,
        AttendanceRecord.session_id == payload.session_id,
        AttendanceRecord.attendance_date == payload.attendance_date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already recorded for this student/session/date")
    record = AttendanceRecord(**payload.model_dump())
    db.add(record)
    db.flush()
    # Update remaining_sessions based on attended flag
    enrollment = get_enrollment_for(db, payload.student_id, payload.session_id)
    recompute_remaining(db, enrollment)
    db.commit()
    db.refresh(record)
    return record

@app.put("/attendance/{id}", response_model=AttendanceOut)
def update_attendance(id: int, payload: AttendanceUpdate, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(record, key, value)
    enrollment = get_enrollment_for(db, record.student_id, record.session_id)
    recompute_remaining(db, enrollment)
    db.commit()
    db.refresh(record)
    return record

@app.delete("/attendance/{id}", status_code=204)
def delete_attendance(id: int, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    student_id = record.student_id
    session_id = record.session_id
    db.delete(record)
    db.flush()
    enrollment = get_enrollment_for(db, student_id, session_id)
    recompute_remaining(db, enrollment)
    db.commit()

# Bulk upsert: POST a list of {student_id, session_id, date, attended}
# Used by the dashboard attendance table for toggling cells.
@app.post("/attendance/bulk", response_model=list[AttendanceOut])
def bulk_upsert_attendance(records: list[AttendanceCreate], db: Session = Depends(get_db)):
    out = []
    for payload in records:
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == payload.student_id,
            AttendanceRecord.session_id == payload.session_id,
            AttendanceRecord.attendance_date == payload.attendance_date,
        ).first()
        if existing:
            existing.attended = payload.attended
            existing.note = payload.note
            if payload.teacher_id is not None:
                existing.teacher_id = payload.teacher_id
            out.append(existing)
        else:
            record = AttendanceRecord(**payload.model_dump())
            db.add(record)
            db.flush()
            out.append(record)
        enrollment = get_enrollment_for(db, payload.student_id, payload.session_id)
        recompute_remaining(db, enrollment)
    db.commit()
    for r in out:
        db.refresh(r)
    return out

# --- Dashboard endpoints ---
@app.get("/dashboard/attendance", response_model=list[AttendanceRowOut])
def dashboard_attendance(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns one row per active enrollment, with all session occurrence
    dates for the requested month (defaults to current month) plus the
    set of dates where attendance was recorded."""
    today = date.today()
    y = year or today.year
    m = month or today.month
    month_start = date(y, m, 1)
    # Last day of month
    if m == 12:
        month_end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(y, m + 1, 1) - timedelta(days=1)

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.status == EnrollmentStatusEnum.enrolled)
        .all()
    )

    rows = []
    for e in enrollments:
        student = e.student
        if student.is_archived:
            continue
        s = e.session
        c = s.class_

        # Occurrence dates within the requested month, gated by valid_from
        start = max(e.enrolled_date, month_start)
        if s.valid_from:
            start = max(start, s.valid_from)
        occurrences = occurrence_dates_list(s.day_of_week, start, min(month_end, today))

        # Fetch attendance records for this enrollment in this month
        att_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == e.student_id,
            AttendanceRecord.session_id == e.session_id,
            AttendanceRecord.attendance_date >= month_start,
            AttendanceRecord.attendance_date <= month_end,
        ).all()
        attended_dates = {r.attendance_date for r in att_records if r.attended}
        absent_dates = {r.attendance_date for r in att_records if not r.attended}

        rows.append(AttendanceRowOut(
            enrollment_id=e.id,
            student_id=student.id,
            student_name=student.name,
            session_id=s.id,
            class_id=c.id,
            class_name=c.name,
            subject=c.subject,
            day_of_week=s.day_of_week.value if hasattr(s.day_of_week, "value") else s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            teacher_id=s.teacher_id,
            teacher_name=s.teacher.name if s.teacher else None,
            enrolled_date=e.enrolled_date,
            price=e.price,
            payment_method=e.payment_method,
            discount=e.discount,
            total_sessions=e.total_sessions,
            remaining_sessions=e.remaining_sessions,
            occurrence_dates=occurrences,
            attended_dates=attended_dates,
            absent_dates=absent_dates,
        ))

    rows.sort(key=lambda r: r.student_name)
    return rows

@app.get("/dashboard/teacher-hours", response_model=list[TeacherHoursRowOut])
def dashboard_teacher_hours(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns one row per teacher that has at least one attendance
    record in the requested month.  Each slot in the row represents
    one (date, start_time, end_time) teaching block derived from
    attendance records where attended=True — i.e. sessions that
    actually ran."""
    today = date.today()
    y = year or today.year
    m = month or today.month
    month_start = date(y, m, 1)
    if m == 12:
        month_end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(y, m + 1, 1) - timedelta(days=1)

    # All attendance records in the month where someone was present
    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.attendance_date >= month_start,
            AttendanceRecord.attendance_date <= month_end,
            AttendanceRecord.attended == True,
            AttendanceRecord.teacher_id != None,
        )
        .all()
    )

    # Group by teacher → deduplicate by (date, session_id) so we count
    # each session slot once even if multiple students attended it
    from collections import defaultdict
    teacher_slots: dict[int, dict[tuple, TeacherHoursSlotOut]] = defaultdict(dict)
    teacher_names: dict[int, str] = {}

    for r in records:
        teacher = r.teacher
        if not teacher:
            continue
        teacher_names[r.teacher_id] = teacher.name
        session = r.session
        c = session.class_
        key = (r.attendance_date, r.session_id)
        if key not in teacher_slots[r.teacher_id]:
            teacher_slots[r.teacher_id][key] = TeacherHoursSlotOut(
                date=r.attendance_date,
                start_time=session.start_time,
                end_time=session.end_time,
                class_name=c.name,
                subject=c.subject,
            )

    rows = []
    for teacher_id, slots_dict in teacher_slots.items():
        slots = sorted(slots_dict.values(), key=lambda s: (s.date, s.start_time))
        total_minutes = sum(
            (s.end_time.hour * 60 + s.end_time.minute) - (s.start_time.hour * 60 + s.start_time.minute)
            for s in slots
        )
        rows.append(TeacherHoursRowOut(
            teacher_id=teacher_id,
            teacher_name=teacher_names[teacher_id],
            slots=slots,
            total_hours=round(total_minutes / 60, 2),
        ))

    rows.sort(key=lambda r: r.teacher_name)
    return rows
