# Step 1 : Base Images
FROM python:3.9

# Step 2 : Package Install
RUN apt -y update; apt -y upgrade; apt -y install vim git net-tools

# Step 3 : Specify a Working directory
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p ./faiss

CMD ["uvicorn", "dbload:app", "--host", "0.0.0.0", "--port", "8000"]