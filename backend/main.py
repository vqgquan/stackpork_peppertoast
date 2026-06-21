from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, Date, Time, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional
from datetime import date, time
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
    subjects = Column(String, nullable=True)  # stored as comma-joined string, e.g. "Guitar, Piano"
    qualifications = Column(String, nullable=True)  # stored as comma-joined string of degrees
    customer_source = Column(String, nullable=True)
    sessions = relationship("ClassSession", back_populates="teacher")
    session_reviews = relationship("SessionReview", back_populates="teacher")
    availability = relationship("TeacherAvailability", back_populates="teacher", cascade="all, delete-orphan")

class TeacherAvailability(Base):
    """A teacher's general weekly teaching schedule/availability —
    distinct from `ClassSession`, which is the specific slot they're
    assigned to teach within a given class. Each slot is tagged with
    the subject taught during it (relevant when a teacher teaches
    more than one subject)."""
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
    class_ = relationship("Class", back_populates="sessions")
    teacher = relationship("Teacher", back_populates="sessions")
    enrollments = relationship("Enrollment", back_populates="session")
    session_reviews = relationship("SessionReview", back_populates="session")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("class_sessions.id"), nullable=False)
    enrolled_date = Column(Date, nullable=False)
    status = Column(Enum(EnrollmentStatusEnum), nullable=False, default=EnrollmentStatusEnum.enrolled)
    total_sessions = Column(Integer, nullable=True)
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
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    review_date = Column(Date, nullable=False)
    session_content = Column(String, nullable=True)   
    review_text = Column(String, nullable=True)         
    session_result = Column(String, nullable=True)
    student = relationship("Student", back_populates="session_reviews")
    session = relationship("ClassSession", back_populates="session_reviews")
    teacher = relationship("Teacher", back_populates="session_reviews")

Base.metadata.create_all(bind=engine)

# --- Teacher schemas ---
class TeacherAvailabilityCreate(BaseModel):
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    subject: Optional[str] = None  # required only when the teacher has >1 subject; see TeacherCreate validator

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
    qualifications: list[str] = []  # degrees; zero or more
    availability: list[TeacherAvailabilityCreate] = []

    @field_validator("subjects")
    @classmethod
    def validate_subjects(cls, v):
        invalid = [s for s in v if s not in ALLOWED_SUBJECTS]
        if invalid:
            raise ValueError(
                f"Invalid subject(s): {', '.join(invalid)}. Must be one of {ALLOWED_SUBJECTS}"
            )
        return v

    @model_validator(mode="after")
    def resolve_availability_subjects(self):
        """If the teacher only teaches one subject, every schedule
        slot is automatically tagged with it. If they teach more than
        one, each slot must explicitly name one of their subjects."""
        single_subject = self.subjects[0] if len(self.subjects) == 1 else None
        for slot in self.availability:
            if single_subject is not None:
                slot.subject = single_subject
            elif not slot.subject:
                raise ValueError(
                    "Each schedule slot must specify a subject when the teacher has multiple subjects."
                )
            elif slot.subject not in self.subjects:
                raise ValueError(
                    f"Schedule subject '{slot.subject}' is not one of this teacher's selected subjects."
                )
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
    """Builds TeacherOut manually so the comma-joined `subjects` and
    `qualifications` columns can be exposed to the API as lists."""
    return TeacherOut(
        id=t.id,
        name=t.name,
        phone=t.phone,
        gender=t.gender,
        email=t.email,
        address=t.address,
        date_of_birth=t.date_of_birth,
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
    class Config: from_attributes = True

class SessionReviewCreate(BaseModel):
    student_id: int
    session_id: int
    teacher_id: int
    review_date: date
    session_content: Optional[str] = None   # NEW
    review_text: Optional[str] = None
    session_result: Optional[str] = None

class SessionReviewOut(SessionReviewCreate):
    id: int
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
            if e.status == EnrollmentStatusEnum.enrolled
        ]
        sessions.append(ClassSessionOut(
            id=s.id,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time,
            teacher_id=s.teacher_id,
            teacher_name=s.teacher.name if s.teacher else None,
            students=roster,
        ))
    return ClassOut(
        id=c.id,
        name=c.name,
        description=c.description,
        subject=c.subject,
        start_date=c.start_date,
        end_date=c.end_date,
        status=c.status,
        sessions=sessions,
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

# --- App ---
app = FastAPI(title="School Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Teachers
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
            session_id=s.id,
            class_id=c.id,
            class_name=c.name,
            subject=c.subject,
            day_of_week=s.day_of_week,
            start_time=s.start_time,
            end_time=s.end_time
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
    db.flush()  # assigns db_teacher.id before commit so we can attach availability rows
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

# Students
@app.get("/students", response_model=list[StudentOut])
def get_students(db: Session = Depends(get_db)):
    return db.query(Student).all()

@app.get("/students/{id}", response_model=StudentOut)
def get_student(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@app.get("/students/{id}/detail", response_model=StudentDetailOut)
def get_student_detail(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    sessions = []
    for enrollment in student.enrollments:
        if enrollment.status != EnrollmentStatusEnum.enrolled:
            continue
        s = enrollment.session
        c = s.class_
        sessions.append(StudentSessionOut(
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
            price=enrollment.price,
            payment_method=enrollment.payment_method,
            discount=enrollment.discount,
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
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for key, value in updated.model_dump().items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student

@app.delete("/students/{id}", status_code=204)
def delete_student(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()

# Classes
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
    db.flush()  # assigns c.id before commit so we can attach sessions
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

# Enrollments
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
    if not db.query(Student).filter(Student.id == payload.student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.query(ClassSession).filter(ClassSession.id == payload.session_id).first():
        raise HTTPException(status_code=404, detail="Class session not found")
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == payload.student_id,
        Enrollment.session_id == payload.session_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this session")
    e = Enrollment(**payload.model_dump())
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

# Session reviews
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
    if not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")
    review = SessionReview(**payload.model_dump())
    db.add(review)
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
        db.query(SessionReview)
        .filter(SessionReview.session_id.in_(session_ids))
        .all()
        if session_ids else []
    )

    out = [
        ClassSessionReviewOut(
            id=r.id,
            student_id=r.student_id,
            student_name=r.student.name,
            session_id=r.session_id,
            day_of_week=r.session.day_of_week,
            teacher_id=r.teacher_id,
            teacher_name=r.teacher.name if r.teacher else None,
            review_date=r.review_date,
            session_content=r.session_content,
            review_text=r.review_text,
            session_result=r.session_result,
        )
        for r in reviews
    ]
    return sorted(out, key=lambda r: r.review_date, reverse=True)

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
        id=s.id,
        day_of_week=s.day_of_week,
        start_time=s.start_time,
        end_time=s.end_time,
        teacher_id=s.teacher_id,
        teacher_name=s.teacher.name if s.teacher else None,
        students=[],
    )

@app.put("/sessions/{session_id}", response_model=ClassSessionOut)
def update_class_session(session_id: int, payload: ClassSessionCreate, db: Session = Depends(get_db)):
    s = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.teacher_id is not None and not db.query(Teacher).filter(Teacher.id == payload.teacher_id).first():
        raise HTTPException(status_code=404, detail="Teacher not found")

    s.day_of_week = payload.day_of_week
    s.start_time = payload.start_time
    s.end_time = payload.end_time
    s.teacher_id = payload.teacher_id
    db.commit()
    db.refresh(s)

    roster = [
        SessionRosterStudentOut(id=e.student.id, name=e.student.name)
        for e in s.enrollments
        if e.status == EnrollmentStatusEnum.enrolled
    ]
    return ClassSessionOut(
        id=s.id,
        day_of_week=s.day_of_week,
        start_time=s.start_time,
        end_time=s.end_time,
        teacher_id=s.teacher_id,
        teacher_name=s.teacher.name if s.teacher else None,
        students=roster,
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