from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import mysql.connector
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 또는 ["http://localhost:3000"]처럼 React 서버 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ⚙️ DB 연결 함수
def get_db_connection():
    return mysql.connector.connect(
        host="13.208.122.37",         # EC2라면 퍼블릭 IP or 도메인
        user="testuser",                 # 또는 testuser
        password="1234",
        database="plantmate"     # 실제 사용 중인 DB 이름
    )

# 🧱 응답 모델
class PixelItem(BaseModel):
    pixel_id: int
    placenum: int

# 🛠️ API: 유저별 사진 + 위치 조회
@app.get("/user/{user_id}/photos", response_model=List[PixelItem])
def get_user_photos(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    query = """
    SELECT pixel_id, placenum
    FROM garden
    WHERE user_id = %s
    """
    cursor.execute(query, (user_id,))
    result = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return result

# ✅ PUT API: 유저의 특정 사진의 위치 정보 업데이트 or 삽입
@app.put("/user/{user_id}/photos/{pixel_id}")
def update_photo(user_id: int, pixel_id: int, data: PixelItem):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 🔍 해당 유저+픽셀ID 존재 여부 확인
    cursor.execute("SELECT * FROM garden WHERE user_id = %s AND pixel_id = %s", (user_id, pixel_id))
    exists = cursor.fetchone()

    if exists:
        # 👉 이미 존재 → placenum 업데이트
        cursor.execute(
            "UPDATE garden SET placenum = %s WHERE user_id = %s AND pixel_id = %s",
            (data.placenum, user_id, pixel_id)
        )
    else:
        # 👉 존재하지 않으면 새로 추가
        cursor.execute(
            "INSERT INTO garden (user_id, pixel_id, placenum) VALUES (%s, %s, %s)",
            (user_id, pixel_id, data.placenum)
        )

    conn.commit()
    cursor.close()
    conn.close()

    return {"message": "Photo saved successfully."}