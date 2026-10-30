from pydantic import BaseModel, EmailStr


class Student(BaseModel):
    name: str
    email: EmailStr
    age: int
    course: str