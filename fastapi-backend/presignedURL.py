from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import boto3
import os
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("AWS_S3_BUCKET")

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

app = FastAPI()

class Photo(BaseModel):
    pixel_id: int
    user_id: str
    image_url: str  # 최종적으로는 presigned URL이 들어감

@app.get("/api/s3photos", response_model=List[Photo])
def get_s3_photos():
    conn = mysql.connector.connect(
        host="13.208.122.37",
        user="testuser",
        password="1234",
        database="plantmate"
    )
    cursor = conn.cursor(dictionary=True)

    # 여기서 image_url은 "S3 Key" 역할 (예: common_photos/plant_01.png)
    cursor.execute("SELECT pixel_id, user_id, image_url FROM garden")
    records = cursor.fetchall()

    result = []
    for r in records:
        try:
            # presigned URL 생성: r["image_url"] → S3 Key 역할
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": r["image_url"]},
                ExpiresIn=3600
            )
            result.append({
                "pixel_id": r["pixel_id"],
                "user_id": r["user_id"],
                "image_url": url  # 이제는 실제 URL을 반환함
            })
        except Exception as e:
            print(f"Failed to generate URL: {e}")
            continue

    cursor.close()
    conn.close()
    return result
