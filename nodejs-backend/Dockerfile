# Step 1: 베이스 이미지
FROM node:20.19.1

# Step 2: 작업 디렉토리 설정
WORKDIR /app

# Step 3: 서버 의존성 설치
COPY package*.json ./
RUN npm install

# Step 4: 클라이언트 코드 복사 및 빌드
COPY client ./client
RUN cd client && npm install && npm run build

# Step 5: 빌드된 React 정적 파일을 Express가 서빙할 수 있게 public 폴더에 복사
RUN mkdir -p ./public && cp -r ./client/build/* ./public/

# Step 6: 나머지 서버 소스 복사
COPY . .

# Step 7: PM2 설치
RUN npm install -g pm2

# Step 8: 포트 오픈
EXPOSE 3000

# Step 9: 서버 실행
CMD ["pm2-runtime", "app.js"]