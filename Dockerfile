# gives us the python 
FROM python:3.14-slim      


#  Creates our app folder inside container
WORKDIR /app


# copy our projects file
COPY requirements.txt .


# install python package
RUN pip install --no-cache-dir -r requirements.txt

COPY . .


# documents that fastapi uses for port 80000
EXPOSE 8000


# start fastApi
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]