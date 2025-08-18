from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import mysql.connector
import boto3
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import Depends, HTTPException
from utils.jwt_utils import get_user_id_from_token  # 위에서 만든 함수 import
from fastapi.responses import StreamingResponse
import httpx
from urllib.parse import urlparse

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

ALLOWED_IMG_HOSTS = {
    "kibwa-14.s3.ap-southeast-2.amazonaws.com",
    # 필요시 다른 버킷/도메인 추가
}

# ✅ CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://plantmate.site"],  # 또는 ["http://localhost:3000"]
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
    plant_id: int
    user_id: int
    placenum: int = 0
    image_url: str
    s3_key: Optional[str] = ""   # 호환용(더이상 사용하지 않음)

class PhotoListWrapper(BaseModel):
    photos: List['SaveItem']  # 저장 시에는 s3_key 필요 없음

class SaveItem(BaseModel):
    plant_id: int
    placenum: int            # 0 = 배치해제(인벤토리로)
    s3_key: Optional[str] = None  # 들어와도 무시

# ✅ JWT 기반으로 user_id 추출하여 사용
@app.get("/api/s3photos", response_model=List[Photo])
def get_s3_photos(request: Request, user_id: int = Depends(get_user_id_from_token)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    sql = """
    WITH latest_plants AS (
      SELECT upp.user_id, upp.plant_id, MAX(upp.uploaded_at) AS last_uploaded_at
      FROM uploaded_plant_photos upp
      WHERE upp.user_id = %s
      GROUP BY upp.user_id, upp.plant_id
    )
    SELECT
      lp.plant_id,
      COALESCE(g.placenum, 0) AS placenum,
      p.pixel_image_url
    FROM latest_plants lp
    JOIN plants p
      ON p.plant_id = lp.plant_id
    LEFT JOIN garden g
      ON g.user_id = lp.user_id
     AND g.plant_id = lp.plant_id
    ORDER BY placenum DESC, lp.plant_id ASC
    """
    cursor.execute(sql, (user_id,))
    rows = cursor.fetchall()

    result = []
    for r in rows:
        url = (r.get("pixel_image_url") or "").strip()
        if not url:
            continue  # 이미지 링크 없으면 스킵

        result.append({
            "plant_id": r["plant_id"],
            "user_id": user_id,
            "placenum": r.get("placenum", 0),
            "s3_key": "",             # 호환용(더이상 사용하지 않음)
            "image_url": url          # https 링크 그대로 반환
        })

    cursor.close()
    conn.close()
    return result


@app.post("/api/save_placements")
def save_placements(
    data: PhotoListWrapper,
    request: Request,
    user_id: int = Depends(get_user_id_from_token)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 전체 삭제 후 재삽입(X)  → 들어온 항목만 정확히 반영(O)
        upsert_sql = """
        INSERT INTO garden (user_id, plant_id, placenum, s3_key)
        VALUES (%s, %s, %s, '')
        ON DUPLICATE KEY UPDATE placenum = VALUES(placenum)
        """
        delete_sql = "DELETE FROM garden WHERE user_id=%s AND plant_id=%s"

        for item in data.photos:
            if item.placenum <= 0:
                cursor.execute(delete_sql, (user_id, item.plant_id))
            else:
                cursor.execute(upsert_sql, (user_id, item.plant_id, item.placenum))

        conn.commit()
        return {"message": "Placement saved successfully"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cursor.close()
        conn.close()
