from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import mysql.connector
import boto3
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi import Depends, HTTPException
from utils.jwt_utils import get_user_id_from_token
from starlette.responses import StreamingResponse

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

# ✅ 모델 정의 (기존과 동일)
class Photo(BaseModel):
    plant_id: int
    user_id: int
    placenum: int = 0
    image_url: str
    s3_key: Optional[str] = ""

class PhotoListWrapper(BaseModel):
    photos: List['SaveItem']

class SaveItem(BaseModel):
    plant_id: int
    placenum: int
    s3_key: Optional[str] = None



@app.get("/api/s3photos_for_react")
def get_s3_photos_for_react(request: Request, user_id: int = Depends(get_user_id_from_token)):
    """
    React 사이드바 전용 API입니다. DB에서 이미지 URL을 읽어와
    프록시에서 사용할 수 있는 image_key 형태로 가공하여 반환합니다.
    """
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
    JOIN plants p ON p.plant_id = lp.plant_id
    LEFT JOIN garden g ON g.user_id = lp.user_id AND g.plant_id = lp.plant_id
    ORDER BY placenum DESC, lp.plant_id ASC
    """
    cursor.execute(sql, (user_id,))
    rows = cursor.fetchall()

    result = []
    for r in rows:
        url = (r.get("pixel_image_url") or "").strip()
        if not url:
            continue
        
        # S3 전체 URL에서 객체 키(경로)만 추출하여 image_key로 만듭니다.
        image_key = ""
        try:
            path_after_host = url.split("://")[1].split("/", 1)[1]
            image_key = path_after_host
        except IndexError:
            image_key = "" # URL 형식이 이상할 경우 빈 값 처리
            
        result.append({
            "plant_id": r["plant_id"],
            "placenum": r.get("placenum", 0),
            "image_key": image_key
        })

    cursor.close()
    conn.close()
    return result

# ---------------------------------------------------------------------
# 아래 코드는 Unity에서 사용되므로 그대로 유지합니다.
# ---------------------------------------------------------------------

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
            continue
        result.append({
            "plant_id": r["plant_id"],
            "user_id": user_id,
            "placenum": r.get("placenum", 0),
            "s3_key": "",
            "image_url": url
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
        
        
# =====================================================================
# ✨✨✨✨✨✨✨✨✨✨✨✨ 최종 수정 부분 ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
# =====================================================================
@app.get("/images/{image_path:path}")
async def proxy_s3_image(image_path: str):
    """
    S3에 있는 이미지를 대신 가져와서 전달해주는 프록시 엔드포인트입니다.
    브라우저가 S3에 직접 접근하지 않아도 이미지를 볼 수 있게 해줍니다.
    """
    try:
        s3_object = s3_client.get_object(Bucket=S3_BUCKET, Key=image_path)
        
        # S3 파일의 Content-Type 메타데이터가 잘못된 경우를 대비하여,
        # Content-Type을 'image/png'로 강제 지정합니다.
        # 만약 jpg 등 다른 형식도 있다면 추가적인 로직이 필요합니다.
        return StreamingResponse(s3_object['Body'], media_type="image/png")
        
    except s3_client.exceptions.NoSuchKey:
        # S3 버킷에 해당 경로의 파일이 없을 경우 404 에러를 반환합니다.
        raise HTTPException(status_code=404, detail="Image not found on S3")
    except Exception as e:
        # 그 외의 에러(권한 문제 등)가 발생하면 500 에러를 반환합니다.
        print(f"S3 Proxy Error: {e}") # 디버깅을 위해 에러 로그 출력
        raise HTTPException(status_code=500, detail=str(e))
# =====================================================================
# ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨
# =====================================================================