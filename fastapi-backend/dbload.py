from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import mysql.connector
import boto3
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# ✅ 환경변수 로드
load_dotenv()

# ✅ S3 환경설정
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("AWS_S3_BUCKET")

# ✅ S3 클라이언트 생성
s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

# ✅ FastAPI 앱 생성
app = FastAPI()

# ✅ CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 또는 ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ DB 연결 함수
def get_db_connection():
    return mysql.connector.connect(
        host="13.208.122.37",
        user="testuser",
        password="1234",
        database="plantmate",
        charset='utf8mb4'
    )

# ✅ 모델 정의
class Photo(BaseModel):
    pixel_id: int
    user_id: str
    placenum: int = 0
    image_url: str = ""
    s3_key: str

class PhotoListWrapper(BaseModel):
    photos: List[Photo]

class PixelItem(BaseModel):
    pixel_id: int
    placenum: int

# ✅ 1. S3 이미지 presigned URL 반환
@app.get("/api/s3photos/{user_id}", response_model=List[Photo])
def get_s3_photos(user_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT pixel_id, user_id, placenum, s3_key FROM garden WHERE user_id = %s", (user_id,))
    records = cursor.fetchall()

    result = []
    for r in records:
        s3_key = r.get("s3_key")
        if not s3_key:
            print(f"❌ 건너뜀: s3_key가 비어 있음 for pixel_id={r.get('pixel_id')}")
            continue

        try:
            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": s3_key},
                ExpiresIn=3600
            )

            result.append({
                "pixel_id": r["pixel_id"],
                "user_id": str(r["user_id"]),
                "placenum": r.get("placenum", 0),
                "s3_key": s3_key,  # ✅ 원래 키도 같이 반환
                "image_url": presigned_url
            })

        except Exception as e:
            print(f"❌ URL 생성 실패 (key={s3_key}): {e}")
            continue

    cursor.close()
    conn.close()
    return result


# ✅ 2. 특정 유저의 배치 데이터 조회
@app.get("/user/{user_id}/photos", response_model=List[PixelItem])
def get_user_photos(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT pixel_id, placenum FROM garden WHERE user_id = %s", (user_id,))
    result = cursor.fetchall()

    cursor.close()
    conn.close()
    return result

# ✅ 3. 특정 유저의 특정 사진 위치 저장
@app.put("/user/{user_id}/photos/{pixel_id}")
def update_photo(user_id: int, pixel_id: int, data: PixelItem):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM garden WHERE user_id = %s AND pixel_id = %s", (user_id, pixel_id))
    exists = cursor.fetchone()

    if exists:
        cursor.execute(
            "UPDATE garden SET placenum = %s WHERE user_id = %s AND pixel_id = %s",
            (data.placenum, user_id, pixel_id)
        )
    else:
        cursor.execute(
            "INSERT INTO garden (user_id, pixel_id, placenum) VALUES (%s, %s, %s)",
            (user_id, pixel_id, data.placenum)
        )

    conn.commit()
    cursor.close()
    conn.close()
    return {"message": "Photo saved successfully."}

@app.post("/api/save_placements")
def save_placements(data: PhotoListWrapper):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        user_id = data.photos[0].user_id if data.photos else ""
        cursor.execute("DELETE FROM garden WHERE user_id = %s", (user_id,))

        for photo in data.photos:
            cursor.execute(
                "INSERT INTO garden (pixel_id, user_id, placenum, s3_key) VALUES (%s, %s, %s, %s)",
                (photo.pixel_id, photo.user_id, photo.placenum, photo.s3_key)  # 🔄 여기 수정됨!
            )

        conn.commit()
        return {"message": "Placement saved successfully"}

    except Exception as e:
        conn.rollback()
        return {"error": str(e)}

    finally:
        cursor.close()
        conn.close()
