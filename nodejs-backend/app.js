const express = require("express");
const path = require("path");
const compression = require("compression");

const app = express();
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ React 정적 파일을 '/garden' 경로에서 서빙
app.use('/garden', express.static(path.join(__dirname, 'client/build')));

// ✅ Unity WebGL 경로 그대로 유지
// app.get("/garden/unity", function (req, res) {
//     res.sendFile(path.join(__dirname, "public", "unity", "index.html"));
// });

// Unity 정적 리소스 (Build 폴더) 서빙
app.use('/garden/unity/Build', express.static(path.join(__dirname, 'client/build/unity/Build')));

// Unity HTML entry point 서빙
app.get('/garden/unity', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/unity/index.html'));
});

// ✅ React SPA fallback: /garden/* 요청에 대해 index.html 반환
app.get('/garden/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(3000, () => {
    console.log("✅ Server is running on http://localhost:3000/garden");
});
