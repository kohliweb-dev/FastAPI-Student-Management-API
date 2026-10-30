import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Get MongoDB credentials
username = os.getenv("MONGO_USERNAME")
password = os.getenv("MONGO_PASSWORD")

# Connect to MongoDB
client = MongoClient(
    f"mongodb://{username}:{password}@mongodb:27017/"
)

# Select database
db = client["task11_fastapi"]

# Select collections
students = db["students"]
users = db["users"]

print("MongoDB connected successfully!")