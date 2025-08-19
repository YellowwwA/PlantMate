import React, { useEffect, useState, useRef } from 'react';

const UnityPlayer = () => {
    // 1. 필요한 모든 state와 ref를 선언합니다.
    const [isLoading, setIsLoading] = useState(true);
    const [photos, setPhotos] = useState([]);
    const [isPhotosLoading, setIsPhotosLoading] = useState(false);
    const [photosError, setPhotosError] = useState("");

    const unityInstanceRef = useRef(null);
    const loginBufferRef = useRef(null);

    useEffect(() => {
        /* =================================================================
         * 2. React 전용 401/502 에러 처리 로직
         * ================================================================= */
        const originalFetch = window.fetch;

        const trigger401AndRedirect = () => { /* ... 세션 만료 알림 로직 ... */ };
        const trigger502Popup = () => { /* ... 서버 에러 알림 로직 ... */ };

        // fetch를 재정의하여 모든 요청을 감시
        window.fetch = async (...args) => {
            const request = args[0];
            const options = args[1] || {};

            // ✅ 핵심: 'X-Requested-From' 헤더가 'React'일 때만 에러를 처리합니다.
            const isReactApiRequest = options.headers && options.headers['X-Requested-From'] === 'React';

            const response = await originalFetch(request, options);

            if (isReactApiRequest && (response.status === 401 || response.status === 502)) {
                if (response.status === 401) trigger401AndRedirect();
                if (response.status === 502) trigger502Popup();
                // 에러가 발생한 요청에 대한 응답을 그대로 반환하여 다음 처리를 막지 않음
                return response;
            }

            // Unity 요청 등 다른 모든 요청은 그대로 통과시킵니다.
            return response;
        };

        /* =================================================================
         * 3. 사진 API 호출 (직접 접근 방식)
         * ================================================================= */
        async function fetchPhotosWithToken(token) {
            setIsPhotosLoading(true);
            setPhotosError("");
            try {
                // ✅ 1. (선택) Unity에서 404 에러를 해결한 URL과 동일한지 확인하세요.
                // 필요하다면 "/api/s3photos" 등으로 수정해야 할 수 있습니다.
                const res = await fetch("/unity/api/s3photos", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "X-Requested-From": "React"
                    }
                });
                if (!res.ok) throw new Error(`서버 응답 실패: ${res.status}`);

                const data = await res.json();

                // ▼▼▼▼▼ 이 부분이 핵심 수정사항입니다 ▼▼▼▼▼
                // ✅ 2. data 객체 안의 photos 배열에 접근하도록 수정합니다.
                // 기존 코드: setPhotos(Array.isArray(data) ? data : []);
                setPhotos(data && Array.isArray(data.photos) ? data.photos : []);

            } catch (err) {
                setPhotosError("사진 목록 요청 중 오류가 발생했습니다.");
                setPhotos([]);
                console.error(err);
            } finally {
                setIsPhotosLoading(false);
            }
        }

        /* =================================================================
         * 4. Unity 연동 및 스크립트 로딩 (원본 코드 기반)
         * ================================================================= */
        const onMessage = (event) => {
            if (event.data?.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                loginBufferRef.current = { user_id, token };
                trySendToUnity();
                if (token) {
                    fetchPhotosWithToken(token); // 토큰 수신 시 사진 로드
                }
            }
        };
        window.addEventListener("message", onMessage);

        function trySendToUnity() {
            if (unityInstanceRef.current && loginBufferRef.current) {
                unityInstanceRef.current.SendMessage(
                    "GameManager",
                    "ReceiveUserInfo",
                    JSON.stringify(loginBufferRef.current)
                );
                loginBufferRef.current = null;
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
                window.createUnityInstance(canvas, config)
                    .then((instance) => {
                        unityInstanceRef.current = instance;
                        setIsLoading(false);
                        trySendToUnity();
                    })
                    .catch((err) => console.error("❌ Unity 인스턴스 생성 실패:", err));
            }
        };
        document.body.appendChild(script);

        // 클린업 함수: 컴포넌트가 사라질 때 원래 fetch로 복원하고 리스너 제거
        return () => {
            window.fetch = originalFetch;
            window.removeEventListener("message", onMessage);
            try { document.body.removeChild(script); } catch { }
        };
    }, []);

    // 5. JSX 렌더링
    return (
        <div style={{ margin: "15px auto" }}>
            <div style={{ position: "relative", height: "65vh", width: "calc(65vh * (16 / 9))", margin: "0 auto", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                {isLoading && (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffffee", borderRadius: "16px", zIndex: 10, color: "#5e865f", fontSize: "18px" }}> ⏳ Unity 로딩 중... </div>)}
                <canvas id="unity-canvas" style={{ width: "100%", height: "100%", borderRadius: "16px", display: "block" }}></canvas>

                <aside style={{ position: "absolute", top: 0, left: "calc(100% + 20px)", height: "100%", width: "clamp(150px, 15vw, 300px)", background: "#fff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "10px", overflowY: "auto" }}>
                    <h3 style={{ fontSize: "15px", margin: "0 0 10px", color: "#2f3634" }}>내 식물 이미지</h3>
                    {isPhotosLoading && <div style={{ fontSize: 13, color: "#5e865f" }}>불러오는 중…</div>}
                    {photosError && <div style={{ fontSize: 12, color: "#b00020" }}>{photosError}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                        {photos.map((p, i) => (
                            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", background: "#f9fafb" }}>
                                <img
                                    src={p.image_url} // ✅ 직접 접근 방식 사용
                                    alt={`plant-${i}`}
                                    style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default UnityPlayer;