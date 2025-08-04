import jwt
from fastapi import HTTPException, status
import os
from dotenv import load_dotenv
from fastapi import Header

# ✅ 환경변수 로드
load_dotenv()

# ✅ S3 환경설정
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

def get_user_id_from_token(Authorization: str = Header(...)) -> int:
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization 헤더가 올바르지 않습니다.")

    token = Authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
