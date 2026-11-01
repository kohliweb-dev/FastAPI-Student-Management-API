
from fastapi.testclient import TestClient
from main import app

# Create a test client for our FastAPI application
client = TestClient(app)


# Test 1: Check the home page
def test_home():

    response = client.get("/")

    assert response.status_code == 200

    assert response.json() == {
        "message": "Student Management API is running"
    }


# Test 2: Check that students API requires login
def test_get_students_without_login():

    response = client.get("/students")

    assert response.status_code == 401


# Test 3: Check that invalid access is rejected
def test_get_student_without_login():

    response = client.get(
        "/students/507f1f77bcf86cd799439011"
    )

    assert response.status_code == 401
