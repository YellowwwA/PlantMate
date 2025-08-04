import React, { useEffect } from 'react';

const UnityPlayer = () => {
    useEffect(() => {
        let unityInstance = null;
        let loginBuffer = null;

        // ✅ Unity에서 로그인 메시지 받을 준비
        window.addEventListener("message", (event) => {
            console.log("📥 메시지 수신됨:", event);

            if (event.data.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                console.log("📩 받은 로그인 데이터:", user_id, token);

                loginBuffer = { user_id, token };
                trySendToUnity();
            }
        });

        // 🔄 유니티 준비되었는지 확인 후 메시지 전송
        function trySendToUnity() {
            if (unityInstance && loginBuffer) {
                console.log("🚀 유니티에 로그인 데이터 전송");
                unityInstance.SendMessage(
                    "GameManager",
                    "ReceiveUserInfo",
                    JSON.stringify(loginBuffer)
                );
                loginBuffer = null;
            } else {
                console.log("⏳ 유니티 인스턴스 준비 대기 중...");
                setTimeout(trySendToUnity, 500);
            }
        }

        // ✅ 유니티 런타임 스크립트 로드 (🔁 /garden prefix 포함)
        const script = document.createElement("script");
        script.src = "/garden/unity/Build/unity.loader.js";
        script.async = true;

        script.onload = () => {
            const config = {
                dataUrl: "/garden/unity/Build/unity.data",
                frameworkUrl: "/garden/unity/Build/unity.framework.js",
                codeUrl: "/garden/unity/Build/unity.wasm",
            };

            const canvas = document.querySelector("#unity-canvas");

            if (canvas && window.createUnityInstance) {
                window
                    .createUnityInstance(canvas, config)
                    .then((instance) => {
                        unityInstance = instance;
                        console.log("✅ Unity 인스턴스 생성 완료");
                        trySendToUnity();
                    })
                    .catch((err) => {
                        console.error("❌ Unity 인스턴스 생성 실패:", err);
                    });
            } else {
                console.error("❌ createUnityInstance가 없음 (스크립트 로드 실패)");
            }
        };

        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    return (
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: "20px" }}>
            <div
                style={{
                    height: "70vh",
                    width: "calc(70vh * (16 / 9))", // 16:9 비율
                    border: "1px solid #ccc",
                    margin: "0 auto",
                }}
            >
                <canvas
                    id="unity-canvas"
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                    }}
                ></canvas>
            </div>
        </div>
    );
};

export default UnityPlayer;
