from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from database import students, users
from models import Student
from user_models import UserCreate,UserLogin
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM
    ,ACCESS_TOKEN_EXPIRE_MINUTES
)
from jose import jwt, JWTError
from bson import ObjectId
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="Student Management API")

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme)):

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        username = payload.get("sub")
        role = payload.get("role")

        if username is None or role is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        return {
            "username": username,
            "role": role
        }

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )



def require_admin(current_user: dict = Depends(get_current_user)):

    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user







@app.post("/register")
def register_user(user: UserCreate):

    # Check if username already exists
    existing_user = users.find_one({
        "username": user.username
    })

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    # Check if email already exists
    existing_email = users.find_one({
        "email": user.email
    })

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    # Hash password
    hashed_password = hash_password(user.password)

    # Create user document
    user_data = {
        "username": user.username,
        "email": user.email,
        "password": hashed_password,
        "role": user.role
    }

    # Save user in MongoDB
    result = users.insert_one(user_data)

    return {
        "message": "User registered successfully",
        "user_id": str(result.inserted_id),
        "username": user.username,
        "role": user.role
    }


# this is the login part of JWT .........

@app.post("/login")
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends()
):

    # Find user in MongoDB
    existing_user = users.find_one({
        "username": form_data.username
    })

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Verify password
    if not verify_password(
        form_data.password,
        existing_user["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    # Create JWT token
    token = create_access_token({
        "sub": existing_user["username"],
        "role": existing_user["role"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in" : ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }





# Convert MongoDB document into JSON-friendly format
def student_response(student):
    return {
        "id": str(student["_id"]),
        "name": student["name"],
        "email": student["email"],
        "age": student["age"],
        "course": student["course"]
    }


# Home
@app.get("/")
def home():
    return {
        "message": "Student Management API is running"
    }


# CREATE student
@app.post("/students", status_code=201)
def create_student(student: Student, current_user: dict = Depends(require_admin)):

    existing_student = students.find_one({
        "email": student.email
    })

    if existing_student:
        raise HTTPException(
            status_code=400,
            detail="Student with this email already exists"
        )

    student_data = student.model_dump()

    result = students.insert_one(student_data)

    new_student = students.find_one({
        "_id": result.inserted_id
    })

    return student_response(new_student)


# GET all students
@app.get("/students")
def get_students(current_user: dict = Depends(get_current_user)):

    all_students = students.find()

    return [
        student_response(student)
        for student in all_students
    ]


# GET student by ID
@app.get("/students/{student_id}")
def get_student(student_id: str,current_user: dict = Depends(require_admin)):

    if not ObjectId.is_valid(student_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID"
        )

    student = students.find_one({
        "_id": ObjectId(student_id)
    })

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student_response(student)


# UPDATE student
@app.put("/students/{student_id}")
def update_student(student_id: str, student: Student,current_user: dict = Depends(require_admin)):

    if not ObjectId.is_valid(student_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID"
        )

    existing_student = students.find_one({
        "_id": ObjectId(student_id)
    })

    if not existing_student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    duplicate_email = students.find_one({
        "email": student.email,
        "_id": {"$ne": ObjectId(student_id)}
    })

    if duplicate_email:
        raise HTTPException(
            status_code=400,
            detail="Email already belongs to another student"
        )

    students.update_one(
        {"_id": ObjectId(student_id)},
        {
            "$set": student.model_dump()
        }
    )

    updated_student = students.find_one({
        "_id": ObjectId(student_id)
    })

    return student_response(updated_student)


# DELETE student
@app.delete("/students/{student_id}")
def delete_student(student_id: str,current_user: dict = Depends(require_admin)):

    if not ObjectId.is_valid(student_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID"
        )

    result = students.delete_one({
        "_id": ObjectId(student_id)
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return {
        "message": "Student deleted successfully"
    }