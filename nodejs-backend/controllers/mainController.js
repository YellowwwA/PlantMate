const express = require("express");
const router = express.Router();
const axios = require("axios");

// 메인 페이지 렌더링
router.get("/", (req, res) => {
    res.render("index");
});



module.exports = router;