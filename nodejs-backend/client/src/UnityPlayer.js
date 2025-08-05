import React, { useEffect, useState } from 'react';

const UnityPlayer = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let unityInstance = null;
        let loginBuffer = null;

        window.addEventListener("message", (event) => {
            if (event.data.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                loginBuffer = { user_id, token };
                trySendToUnity();
            }
        });

        function trySendToUnity() {
            if (unityInstance && loginBuffer) {
                unityInstance.SendMessage(
                    "GameManager",
                    "ReceiveUserInfo",
                    JSON.stringify(loginBuffer)
                );
                loginBuffer = null;
            } else {
                setTimeout(trySendToUnity, 500);
            }
        }

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
                        setIsLoading(false);
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
        <div
            style={{
                height: "65vh",
                width: "calc(65vh * (16 / 9))", // 16:9 비율 유지
                margin: "40px auto",
                padding: "20px",
                borderRadius: "16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                backgroundColor: "#fff",
                position: "relative",
            }}
        >
            {/* 🔄 로딩 오버레이 */}
            {isLoading && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#ffffffee",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        color: "#5e865f",
                        borderRadius: "16px",
                    }}
                >
                    ⏳ Unity 로딩 중...
                </div>
            )}

            {/* 🎮 Unity Canvas */}
            <canvas
                id="unity-canvas"
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    borderRadius: "12px",
                }}
            ></canvas>
        </div>
    );
};

export default UnityPlayer;
