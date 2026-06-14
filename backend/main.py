from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, Date, Time, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr
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
    facebook = Column(String, nullable=True)
    citizenship = Column(String, nullable=True)
    passport_number = Column(String, unique=True, nullable=True)
    customer_source = Column(String, nullable=True)
    classes = relationship("Class", back_populates="teacher")

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    facebook = Column(String, nullable=True)
    citizenship = Column(String, nullable=True)
    passport_number = Column(String, unique=True, nullable=True)
    customer_source = Column(String, nullable=True)
    enrollments = relationship("Enrollment", back_populates="student")

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(Enum(ClassStatusEnum), nullable=False, default=ClassStatusEnum.active)
    teacher = relationship("Teacher", back_populates="classes")
    enrollments = relationship("Enrollment", back_populates="class_")
    schedules = relationship("ClassSchedule", back_populates="class_", cascade="all, delete-orphan")

class ClassSchedule(Base):
    __tablename__ = "class_schedules"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    day_of_week = Column(Enum(DayOfWeekEnum), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    class_ = relationship("Class", back_populates="schedules")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    enrolled_date = Column(Date, nullable=False)
    status = Column(Enum(EnrollmentStatusEnum), nullable=False, default=EnrollmentStatusEnum.enrolled)
    student = relationship("Student", back_populates="enrollments")
    class_ = relationship("Class", back_populates="enrollments")

Base.metadata.create_all(bind=engine)

# --- Schemas ---
class TeacherCreate(BaseModel):
    name: str
    phone: str
    gender: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    facebook: Optional[str] = None
    citizenship: Optional[str] = None
    passport_number: Optional[str] = None
    customer_source: Optional[str] = None

class TeacherOut(TeacherCreate):
    id: int
    class Config: from_attributes = True

class StudentCreate(BaseModel):
    name: str
    phone: str
    gender: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    facebook: Optional[str] = None
    citizenship: Optional[str] = None
    passport_number: Optional[str] = None
    customer_source: Optional[str] = None

class StudentOut(StudentCreate):
    id: int
    class Config: from_attributes = True

# --- Class schedule schemas ---
class ClassScheduleCreate(BaseModel):
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time

class ClassScheduleOut(ClassScheduleCreate):
    id: int
    class Config: from_attributes = True

class ClassCreate(BaseModel):
    name: str
    description: Optional[str] = None
    teacher_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ClassStatusEnum = ClassStatusEnum.active
    schedules: list[ClassScheduleCreate] = []

class ClassOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    teacher_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ClassStatusEnum
    schedules: list[ClassScheduleOut] = []
    class Config: from_attributes = True

class EnrollmentCreate(BaseModel):
    student_id: int
    class_id: int
    enrolled_date: date
    status: EnrollmentStatusEnum = EnrollmentStatusEnum.enrolled

class EnrollmentOut(EnrollmentCreate):
    id: int
    class Config: from_attributes = True

# --- Student detail / schedule schemas ---
class StudentScheduleEntryOut(BaseModel):
    class_id: int
    class_name: str
    day_of_week: DayOfWeekEnum
    start_time: time
    end_time: time
    teacher_name: Optional[str] = None

class StudentDetailOut(StudentOut):
    schedule: list[StudentScheduleEntryOut] = []
    classes: list[ClassOut] = []

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
    return db.query(Teacher).all()

@app.get("/teachers/{id}", response_model=TeacherOut)
def get_teacher(id: int, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return teacher

@app.post("/teachers", response_model=TeacherOut, status_code=201)
def create_teacher(teacher: TeacherCreate, db: Session = Depends(get_db)):
    db_teacher = Teacher(**teacher.model_dump())
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

@app.put("/teachers/{id}", response_model=TeacherOut)
def update_teacher(id: int, updated: TeacherCreate, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(Teacher.id == id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    for key, value in updated.model_dump().items():
        setattr(teacher, key, value)
    db.commit()
    db.refresh(teacher)
    return teacher

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

    schedule: list[StudentScheduleEntryOut] = []
    classes: list[Class] = []

    for enrollment in student.enrollments:
        if enrollment.status != EnrollmentStatusEnum.enrolled:
            continue
        c = enrollment.class_
        classes.append(c)
        teacher_name = c.teacher.name if c.teacher else None
        for sched in c.schedules:
            schedule.append(StudentScheduleEntryOut(
                class_id=c.id,
                class_name=c.name,
                day_of_week=sched.day_of_week,
                start_time=sched.start_time,
                end_time=sched.end_time,
                teacher_name=teacher_name,
            ))

    result = StudentDetailOut.model_validate(student)
    result.schedule = schedule
    result.classes = [ClassOut.model_validate(c) for c in classes]
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
    return db.query(Class).all()

@app.get("/classes/{id}", response_model=ClassOut)
def get_class(id: int, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    return c

@app.post("/classes", response_model=ClassOut, status_code=201)
def create_class(payload: ClassCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    schedules_data = data.pop("schedules", [])
    c = Class(**data)
    db.add(c)
    db.flush()  # assigns c.id before commit so we can attach schedules
    for sched in schedules_data:
        db.add(ClassSchedule(class_id=c.id, **sched))
    db.commit()
    db.refresh(c)
    return c

@app.put("/classes/{id}", response_model=ClassOut)
def update_class(id: int, payload: ClassCreate, db: Session = Depends(get_db)):
    c = db.query(Class).filter(Class.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Class not found")
    data = payload.model_dump()
    schedules_data = data.pop("schedules", [])
    for key, value in data.items():
        setattr(c, key, value)
    # Replace all existing schedule rows with the new set
    db.query(ClassSchedule).filter(ClassSchedule.class_id == id).delete()
    for sched in schedules_data:
        db.add(ClassSchedule(class_id=id, **sched))
    db.commit()
    db.refresh(c)
    return c

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
    # Validate student and class exist
    if not db.query(Student).filter(Student.id == payload.student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.query(Class).filter(Class.id == payload.class_id).first():
        raise HTTPException(status_code=404, detail="Class not found")
    # Prevent duplicate enrollment
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == payload.student_id,
        Enrollment.class_id == payload.class_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this class")
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
