import React, { useEffect } from 'react';

const UnityPlayer = () => {
    useEffect(() => {
        let unityInstance = null;
        let loginBuffer = null; // 🔹 메시지 임시 저장소

        // ✅ 1. 메시지 리스너 등록 (Unity 인스턴스 준비 전에도 수신 가능)
        window.addEventListener("message", (event) => {
            console.log("📥 메시지 수신됨:", event);

            if (event.data.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                console.log("📩 받은 로그인 데이터:", user_id, token);

                loginBuffer = { user_id, token }; // 🔹 버퍼에 저장
                trySendToUnity(); // 🔹 유니티가 준비되었는지 체크 후 전송
            }
        });

        // 🔄 반복적으로 Unity 인스턴스 상태 확인 후 전송
        function trySendToUnity() {
            if (unityInstance && loginBuffer) {
                console.log("🚀 유니티에 로그인 데이터 전송");
                unityInstance.SendMessage(
                    "GameManager",
                    "ReceiveUserInfo",
                    JSON.stringify(loginBuffer)
                );
                loginBuffer = null; // ✅ 전송 후 버퍼 초기화
            } else {
                console.log("⏳ 유니티 인스턴스 준비 대기 중...");
                setTimeout(trySendToUnity, 500); // 🔁 재시도
            }
        }

        // ✅ 2. 유니티 런타임 스크립트 로드
        const script = document.createElement("script");
        script.src = "/unity/Build/unity.loader.js";
        script.async = true;

        script.onload = () => {

            const config = {
                dataUrl: "/unity/Build/unity.data",
                frameworkUrl: "/unity/Build/unity.framework.js",
                codeUrl: "/unity/Build/unity.wasm",
            };

            const canvas = document.querySelector("#unity-canvas");

            if (canvas && window.createUnityInstance) {
                window
                    .createUnityInstance(canvas, config)
                    .then((instance) => {
                        unityInstance = instance;
                        console.log("✅ Unity 인스턴스 생성 완료");
                        trySendToUnity(); // 🔹 Unity 준비 후 버퍼 확인
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

    // return <canvas id="unity-canvas" style={{ width: "70vw", height: "70vh" }}></canvas>;
    return (
        <div style={{ maxWidth: "100%", margin: "0 auto", padding: "20px" }}>
            <div
                style={{
                    height: "70vh",
                    width: "calc(70vh * (16 / 9))", // 16:9 비율 맞춘 가로
                    border: "1px solid #ccc",
                    margin: "0 auto", // 가운데 정렬
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
