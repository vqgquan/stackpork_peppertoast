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
    phone = Column(String, nullable=True)
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
    enrollment_sessions = relationship("EnrollmentSession", back_populates="session", cascade="all, delete-orphan")
    session_reviews = relationship("SessionReview", back_populates="session", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    # session_id removed — sessions are now linked via enrollment_sessions join table
    enrolled_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # set when status moves to Dropped/Completed
    status = Column(Enum(EnrollmentStatusEnum), nullable=False, default=EnrollmentStatusEnum.enrolled)
    total_sessions = Column(Integer, nullable=True)
    remaining_sessions = Column(Integer, nullable=True)
    price = Column(Integer, nullable=True)
    payment_method = Column(String, nullable=True)
    discount = Column(String, nullable=True)
    student = relationship("Student", back_populates="enrollments")
    enrollment_sessions = relationship("EnrollmentSession", back_populates="enrollment", cascade="all, delete-orphan")

class EnrollmentSession(Base):
    """Join table: one enrollment can cover multiple class session slots,
    sharing a single total_sessions / remaining_sessions pool."""
    __tablename__ = "enrollment_sessions"
    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (
        UniqueConstraint("enrollment_id", "session_id", name="uq_enrollment_session"),
    )
    enrollment = relationship("Enrollment", back_populates="enrollment_sessions")
    session = relationship("ClassSession", back_populates="enrollment_sessions")

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
    attended=True  → student was present; burns one from the shared enrollment pool.
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
    phone: Optional[str] = None
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
        # Roster via enrollment_sessions join table
        seen_students = {}
        for es in s.enrollment_sessions:
            enr = es.enrollment
            exhausted = enr.remaining_sessions is not None and enr.remaining_sessions <= 0
            if enr.status == EnrollmentStatusEnum.enrolled and not enr.student.is_archived and not exhausted:
                stu = enr.student
                seen_students[stu.id] = stu.name
        roster = [SessionRosterStudentOut(id=sid, name=sname) for sid, sname in seen_students.items()]
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

# --- Enrollment schemas ---
class EnrollmentCreate(BaseModel):
    student_id: int
    session_ids: list[int]   # shared pool across all these slots
    enrolled_date: date
    status: EnrollmentStatusEnum = EnrollmentStatusEnum.enrolled
    total_sessions: Optional[int] = None
    price: Optional[int] = None
    payment_method: Optional[str] = None
    discount: Optional[str] = None

class EnrollmentEndRequest(BaseModel):
    end_date: date
    status: EnrollmentStatusEnum = EnrollmentStatusEnum.dropped

class EnrollmentAddSessionsRequest(BaseModel):
    """Buy more sessions for an active, shared-pool enrollment.
    Bumps total_sessions (creating a pack if the enrollment was previously
    open-ended) and optionally tacks on extra price for the top-up."""
    additional_sessions: int = Field(..., gt=0)
    additional_price: Optional[int] = None

class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    session_ids: list[int]
    enrolled_date: date
    end_date: Optional[date] = None
    status: EnrollmentStatusEnum
    total_sessions: Optional[int] = None
    remaining_sessions: Optional[int] = None
    price: Optional[int] = None
    payment_method: Optional[str] = None
    discount: Optional[str] = None
    class Config: from_attributes = True

def build_enrollment_out(e: Enrollment) -> EnrollmentOut:
    return EnrollmentOut(
        id=e.id,
        student_id=e.student_id,
        session_ids=[es.session_id for es in e.enrollment_sessions],
        enrolled_date=e.enrolled_date,
        end_date=e.end_date,
        status=e.status,
        total_sessions=e.total_sessions,
        remaining_sessions=e.remaining_sessions,
        price=e.price,
        payment_method=e.payment_method,
        discount=e.discount,
    )

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

class PastEnrollmentSlotOut(BaseModel):
    session_id: int
    class_id: int
    class_name: str
    subject: Optional[str] = None
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    teacher_name: Optional[str] = None

class PastEnrollmentOut(BaseModel):
    enrollment_id: int
    status: EnrollmentStatusEnum
    enrolled_date: date
    end_date: Optional[date] = None
    total_sessions: Optional[int] = None
    remaining_sessions: Optional[int] = None
    attended_sessions: int
    price: Optional[int] = None
    payment_method: Optional[str] = None
    discount: Optional[str] = None
    slots: list[PastEnrollmentSlotOut] = []

class StudentDetailOut(StudentOut):
    sessions: list[StudentSessionOut] = []
    past_enrollments: list[PastEnrollmentOut] = []

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
class ScheduleSlotOut(BaseModel):
    session_id: int
    day_of_week: str
    start_time: time
    end_time: time

class AttendanceRowOut(BaseModel):
    """One row per enrollment in the Student Attendance dashboard table.
    A single enrollment may cover multiple session slots (shared pool).
    date_session_map maps each occurrence date to its specific session_id
    so the UI knows which session to write the attendance record against."""
    enrollment_id: int
    student_id: int
    student_name: str
    # Primary session metadata (first slot chronologically) for display
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
    # All slots in this enrollment (for schedule label)
    schedules: list[ScheduleSlotOut]
    # All occurrence dates across all slots, ordered asc
    occurrence_dates: list[date]
    # date string -> session_id (which slot this date belongs to)
    date_session_map: dict[str, int]
    # Sets of dates with attendance records
    attended_dates: set[date]
    absent_dates: set[date]

    class Config:
        from_attributes = True

class TeacherHoursSlotOut(BaseModel):
    date: date
    start_time: time
    end_time: time
    class_name: Optional[str]
    subject: Optional[str]

class TeacherHoursRowOut(BaseModel):
    teacher_id: int
    teacher_name: str
    slots: list[TeacherHoursSlotOut]
    total_hours: float

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

def find_enrollment_for_attendance(db: Session, student_id: int, session_id: int) -> Optional[Enrollment]:
    """Find the active enrollment that covers this (student, session) pair via the join table."""
    links = db.query(EnrollmentSession).filter(
        EnrollmentSession.session_id == session_id,
    ).all()
    for link in links:
        enr = link.enrollment
        if enr.student_id == student_id and enr.status == EnrollmentStatusEnum.enrolled:
            return enr
    return None

def count_attended_sessions(db: Session, enrollment: Enrollment) -> int:
    """Count ALL attended records across ALL session slots in this enrollment."""
    session_ids = [es.session_id for es in enrollment.enrollment_sessions]
    if not session_ids:
        return 0
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == enrollment.student_id,
        AttendanceRecord.session_id.in_(session_ids),
        AttendanceRecord.attended == True,
    ).count()

def recompute_remaining(db: Session, enrollment: Optional[Enrollment]):
    """Recompute remaining_sessions = total_sessions minus attended count
    across all slots in the enrollment."""
    if enrollment is None:
        return
    if enrollment.total_sessions is not None:
        attended = count_attended_sessions(db, enrollment)
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
    sessions_out = []
    for enrollment in student.enrollments:
        if enrollment.status != EnrollmentStatusEnum.enrolled:
            continue
        for es in enrollment.enrollment_sessions:
            s = es.session
            c = s.class_
            sessions_out.append(StudentSessionOut(
                enrollment_id=enrollment.id,
                session_id=s.id,
                class_id=c.id,
                class_name=c.name,
                subject=c.subject,
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                teacher_id=s.teacher_id,
                teacher_name=s.teacher.name if s.teacher else None,
                enrolled_date=enrollment.enrolled_date,
                total_sessions=enrollment.total_sessions,
                remaining_sessions=enrollment.remaining_sessions,
                price=enrollment.price,
                payment_method=enrollment.payment_method,
                discount=enrollment.discount,
            ))
    past_out = []
    for enrollment in student.enrollments:
        if enrollment.status == EnrollmentStatusEnum.enrolled:
            continue
        slots = []
        sorted_es = sorted(
            enrollment.enrollment_sessions,
            key=lambda es: (
                _DAY_ORDER.index(es.session.day_of_week.value if hasattr(es.session.day_of_week, "value") else es.session.day_of_week),
                es.session.start_time,
            ),
        )
        for es in sorted_es:
            s = es.session
            c = s.class_
            slots.append(PastEnrollmentSlotOut(
                session_id=s.id,
                class_id=c.id,
                class_name=c.name,
                subject=c.subject,
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                teacher_name=s.teacher.name if s.teacher else None,
            ))
        if enrollment.total_sessions is not None and enrollment.remaining_sessions is not None:
            attended = enrollment.total_sessions - enrollment.remaining_sessions
        else:
            attended = count_attended_sessions(db, enrollment)
        past_out.append(PastEnrollmentOut(
            enrollment_id=enrollment.id,
            status=enrollment.status,
            enrolled_date=enrollment.enrolled_date,
            end_date=enrollment.end_date,
            total_sessions=enrollment.total_sessions,
            remaining_sessions=enrollment.remaining_sessions,
            attended_sessions=attended,
            price=enrollment.price,
            payment_method=enrollment.payment_method,
            discount=enrollment.discount,
            slots=slots,
        ))
    past_out.sort(key=lambda p: p.end_date or p.enrolled_date, reverse=True)

    result = StudentDetailOut.model_validate(student)
    result.sessions = sessions_out
    result.past_enrollments = past_out
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
    return [build_enrollment_out(e) for e in db.query(Enrollment).all()]

@app.get("/enrollments/{id}", response_model=EnrollmentOut)
def get_enrollment(id: int, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return build_enrollment_out(e)

@app.post("/enrollments", response_model=EnrollmentOut, status_code=201)
def create_enrollment(payload: EnrollmentCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.is_archived:
        raise HTTPException(status_code=400, detail="Cannot enroll an archived student")
    if not payload.session_ids:
        raise HTTPException(status_code=400, detail="At least one session_id is required")
    for sid in payload.session_ids:
        if not db.query(ClassSession).filter(ClassSession.id == sid).first():
            raise HTTPException(status_code=404, detail=f"Class session {sid} not found")
    # Check no existing active enrollment already covers any of these sessions for this student
    for sid in payload.session_ids:
        conflict = (
            db.query(EnrollmentSession)
            .join(Enrollment)
            .filter(
                Enrollment.student_id == payload.student_id,
                EnrollmentSession.session_id == sid,
                Enrollment.status == EnrollmentStatusEnum.enrolled,
            )
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail=f"Student already enrolled in session {sid}")
    e = Enrollment(
        student_id=payload.student_id,
        enrolled_date=payload.enrolled_date,
        status=payload.status,
        total_sessions=payload.total_sessions,
        remaining_sessions=payload.total_sessions,  # starts at full pool
        price=payload.price,
        payment_method=payload.payment_method,
        discount=payload.discount,
    )
    db.add(e)
    db.flush()
    for sid in payload.session_ids:
        db.add(EnrollmentSession(enrollment_id=e.id, session_id=sid))
    db.commit()
    db.refresh(e)
    return build_enrollment_out(e)

@app.put("/enrollments/{id}", response_model=EnrollmentOut)
def update_enrollment(id: int, payload: EnrollmentCreate, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    e.enrolled_date = payload.enrolled_date
    e.status = payload.status
    e.total_sessions = payload.total_sessions
    e.price = payload.price
    e.payment_method = payload.payment_method
    e.discount = payload.discount
    # Replace session links
    db.query(EnrollmentSession).filter(EnrollmentSession.enrollment_id == id).delete()
    for sid in payload.session_ids:
        db.add(EnrollmentSession(enrollment_id=id, session_id=sid))
    db.flush()
    recompute_remaining(db, e)
    db.commit()
    db.refresh(e)
    return build_enrollment_out(e)

@app.delete("/enrollments/{id}", status_code=204)
def delete_enrollment(id: int, db: Session = Depends(get_db)):
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(e)
    db.commit()

@app.post("/enrollments/{id}/end", response_model=EnrollmentOut)
def end_enrollment(id: int, payload: EnrollmentEndRequest, db: Session = Depends(get_db)):
    """Soft-end an enrollment (e.g. student exits early on their own).
    Keeps the enrollment row, its reviews and attendance history intact —
    just marks it Dropped/Completed with an end_date so it moves out of the
    active roster and into the student's past-enrollments list."""
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status != EnrollmentStatusEnum.enrolled:
        raise HTTPException(status_code=400, detail="Enrollment is already ended")
    if payload.end_date < e.enrolled_date:
        raise HTTPException(status_code=400, detail="End date can't be before the enrollment date")
    e.status = payload.status
    e.end_date = payload.end_date
    db.commit()
    db.refresh(e)
    return build_enrollment_out(e)

@app.post("/enrollments/{id}/reactivate", response_model=EnrollmentOut)
def reactivate_enrollment(id: int, db: Session = Depends(get_db)):
    """Undo an accidental end — puts the enrollment back on the active roster."""
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status == EnrollmentStatusEnum.enrolled:
        raise HTTPException(status_code=400, detail="Enrollment is already active")
    e.status = EnrollmentStatusEnum.enrolled
    e.end_date = None
    db.commit()
    db.refresh(e)
    return build_enrollment_out(e)

@app.post("/enrollments/{id}/add-sessions", response_model=EnrollmentOut)
def add_sessions_to_enrollment(id: int, payload: EnrollmentAddSessionsRequest, db: Session = Depends(get_db)):
    """Buy more sessions for an active enrollment's shared pool. Bumps
    total_sessions (starting a pack if it was previously open-ended) and
    recomputes remaining_sessions from the existing attendance history.
    Optionally adds to the recorded price for the top-up."""
    e = db.query(Enrollment).filter(Enrollment.id == id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if e.status != EnrollmentStatusEnum.enrolled:
        raise HTTPException(status_code=400, detail="Can't add sessions to an enrollment that has already ended")
    e.total_sessions = (e.total_sessions or 0) + payload.additional_sessions
    if payload.additional_price is not None:
        e.price = (e.price or 0) + payload.additional_price
    db.flush()
    recompute_remaining(db, e)
    db.commit()
    db.refresh(e)
    return build_enrollment_out(e)

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
    seen_students = {}
    for es in s.enrollment_sessions:
        enr = es.enrollment
        exhausted = enr.remaining_sessions is not None and enr.remaining_sessions <= 0
        if enr.status == EnrollmentStatusEnum.enrolled and not enr.student.is_archived and not exhausted:
            stu = enr.student
            seen_students[stu.id] = stu.name
    roster = [SessionRosterStudentOut(id=sid, name=sname) for sid, sname in seen_students.items()]
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
            detail="Can't delete this session — it has enrolled students, reviews, or attendance records attached. Remove those first.",
        )

# Legacy missed-session endpoint — kept for compatibility.
@app.post("/students/{student_id}/sessions/{session_id}/miss", response_model=SessionReviewOut, status_code=201)
def mark_session_missed(student_id: int, session_id: int, payload: MarkMissedRequest, db: Session = Depends(get_db)):
    enrollment = find_enrollment_for_attendance(db, student_id, session_id)
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

@app.get("/attendance/record", response_model=Optional[AttendanceOut])
def get_attendance_record(
    student_id: int = Query(...),
    session_id: int = Query(...),
    attendance_date: date = Query(...),
    db: Session = Depends(get_db),
):
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.session_id == session_id,
        AttendanceRecord.attendance_date == attendance_date,
    ).first()

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
    enrollment = find_enrollment_for_attendance(db, payload.student_id, payload.session_id)
    recompute_remaining(db, enrollment)
    db.commit()
    db.refresh(record)
    return record

# Bulk upsert — must be declared BEFORE /attendance/{id}
@app.post("/attendance/bulk", response_model=list[AttendanceOut])
def bulk_upsert_attendance(records: list[AttendanceCreate], db: Session = Depends(get_db)):
    out = []
    affected_enrollments = {}  # enrollment_id -> enrollment obj, to recompute once per enrollment
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
        enrollment = find_enrollment_for_attendance(db, payload.student_id, payload.session_id)
        if enrollment and enrollment.id not in affected_enrollments:
            affected_enrollments[enrollment.id] = enrollment
    for enrollment in affected_enrollments.values():
        recompute_remaining(db, enrollment)
    db.commit()
    for r in out:
        db.refresh(r)
    return out

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
    enrollment = find_enrollment_for_attendance(db, record.student_id, record.session_id)
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
    enrollment = find_enrollment_for_attendance(db, student_id, session_id)
    recompute_remaining(db, enrollment)
    db.commit()

# --- Dashboard endpoints ---
_DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

@app.get("/dashboard/attendance", response_model=list[AttendanceRowOut])
def dashboard_attendance(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns one row per active enrollment. Each enrollment may cover
    multiple session slots; occurrence dates are merged across all slots
    and date_session_map tells the UI which session_id to use per date."""
    today = date.today()
    y = year or today.year
    m = month or today.month
    month_start = date(y, m, 1)
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
        if not e.enrollment_sessions:
            continue

        # Collect occurrence dates across all slots in this enrollment
        occurrence_date_set = set()
        date_session_map: dict[str, int] = {}

        for es in e.enrollment_sessions:
            s = es.session
            start = max(e.enrolled_date, month_start)
            if s.valid_from:
                start = max(start, s.valid_from)
            for d in occurrence_dates_list(s.day_of_week, start, month_end):
                occurrence_date_set.add(d)
                date_session_map[str(d)] = s.id

        if not occurrence_date_set:
            continue

        # Sort slots by day-of-week then start_time for display
        sorted_es = sorted(
            e.enrollment_sessions,
            key=lambda x: (
                _DAY_ORDER.index(x.session.day_of_week.value if hasattr(x.session.day_of_week, "value") else x.session.day_of_week),
                x.session.start_time,
            )
        )
        primary_s = sorted_es[0].session
        c = primary_s.class_

        schedules = [
            ScheduleSlotOut(
                session_id=es.session_id,
                day_of_week=es.session.day_of_week.value if hasattr(es.session.day_of_week, "value") else es.session.day_of_week,
                start_time=es.session.start_time,
                end_time=es.session.end_time,
            )
            for es in sorted_es
        ]

        # Attendance records for this enrollment across all its slots this month
        all_session_ids = [es.session_id for es in e.enrollment_sessions]
        att_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == e.student_id,
            AttendanceRecord.session_id.in_(all_session_ids),
            AttendanceRecord.attendance_date >= month_start,
            AttendanceRecord.attendance_date <= month_end,
        ).all()
        attended_dates = {r.attendance_date for r in att_records if r.attended}
        absent_dates   = {r.attendance_date for r in att_records if not r.attended}

        rows.append(AttendanceRowOut(
            enrollment_id=e.id,
            student_id=student.id,
            student_name=student.name,
            session_id=primary_s.id,
            class_id=c.id,
            class_name=c.name,
            subject=c.subject,
            day_of_week=primary_s.day_of_week.value if hasattr(primary_s.day_of_week, "value") else primary_s.day_of_week,
            start_time=primary_s.start_time,
            end_time=primary_s.end_time,
            teacher_id=primary_s.teacher_id,
            teacher_name=primary_s.teacher.name if primary_s.teacher else None,
            enrolled_date=e.enrolled_date,
            price=e.price,
            payment_method=e.payment_method,
            discount=e.discount,
            total_sessions=e.total_sessions,
            remaining_sessions=e.remaining_sessions,
            schedules=schedules,
            occurrence_dates=sorted(occurrence_date_set),
            date_session_map=date_session_map,
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
    today = date.today()
    y = year or today.year
    m = month or today.month
    month_start = date(y, m, 1)
    if m == 12:
        month_end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(y, m + 1, 1) - timedelta(days=1)

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
