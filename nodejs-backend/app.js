// 포트 띄우는 서버
var express = require("express");
const path = require('path');
const compression = require("compression");  // 🔹 추가: 압축 지원
var app = express();

// 🔹 gzip 등 압축된 파일 전송 지원 (Unity WebGL용)
app.use(compression());

// 미들웨어
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'client/build')));

// 뷰 엔진 설정 (HTML 렌더링)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html')
app.engine('html', require('ejs').renderFile);



app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔹 Unity WebGL 접속 페이지 (http://localhost:3000/unity)
app.get("/unity", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "UnityBuild", "index.html"));
});

// 라우터
const mainRouter = require('./controllers/mainController');
app.use('/', mainRouter)

app.listen(3000, function () {
    console.log("3000 Port : Server Started~")
});