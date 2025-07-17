from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import mysql.connector

app = FastAPI()

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