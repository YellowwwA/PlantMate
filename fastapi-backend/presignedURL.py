from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import mysql.connector
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

# 환경 변수로부터 S3 정보 로드
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("AWS_S3_BUCKET")

# boto3 클라이언트 설정
s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

app = FastAPI()

# 공통 모델 정의
class Photo(BaseModel):
    pixel_id: int
    user_id: str
    placenum: int = 0  # 기본값 0 → /s3photos에서도 사용
    image_url: str = ""  # /save_placements에는 안 씀

class PhotoListWrapper(BaseModel):
    photos: List[Photo]

# ✅ GET: 이미지 URL 불러오기
@app.get("/api/s3photos", response_model=List[Photo])
def get_s3_photos():
    conn = mysql.connector.connect(
        host="13.208.122.37",  # 또는 localhost
        user="testuser",
        password="1234",
        database="plantmate"
    )
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT pixel_id, user_id, image_url FROM garden")
    records = cursor.fetchall()

    result = []
    for r in records:
        try:
            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": r["image_url"]},
                ExpiresIn=3600
            )
            result.append({
                "pixel_id": r["pixel_id"],
                "user_id": r["user_id"],
                "image_url": presigned_url,
                "placenum": 0  # GET은 인벤토리용이라 placenum=0으로 설정
            })
        except Exception as e:
            print(f"Failed to generate URL: {e}")
            continue

    cursor.close()
    conn.close()
    return result

# ✅ POST: 배치 저장
@app.post("/api/save_placements")
def save_placements(data: PhotoListWrapper):
    conn = mysql.connector.connect(
        host="13.208.122.37",  # 실제 환경에 따라 조정
        user="testuser",
        password="1234",
        database="plantmate"
    )
    cursor = conn.cursor()

    try:
        user_id = data.photos[0].user_id if data.photos else ""
        cursor.execute("DELETE FROM garden WHERE user_id = %s", (user_id,))

        for photo in data.photos:
            cursor.execute(
                "INSERT INTO garden (pixel_id, user_id, placenum) VALUES (%s, %s, %s)",
                (photo.pixel_id, photo.user_id, photo.placenum)
            )

        conn.commit()
        return {"message": "Placement saved successfully"}

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

    finally:
        cursor.close()
        conn.close()
