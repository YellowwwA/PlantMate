const express = require("express");
const path = require("path");
const compression = require("compression");

const app = express();
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// React build 폴더 서빙
app.use(express.static(path.join(__dirname, "client/build")));

// Unity WebGL 경로
app.get("/unity", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "unity", "index.html"));
});

// React 라우팅 fallback
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

app.listen(3000, () => {
    console.log("✅ Server is running on http://localhost:3000");
});
