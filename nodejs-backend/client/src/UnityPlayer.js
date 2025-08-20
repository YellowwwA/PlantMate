import React, { useEffect, useState, useRef } from 'react';

const UnityPlayer = () => {
    // 원본 및 추가된 State와 Ref
    const [isLoading, setIsLoading] = useState(true);
    const [photos, setPhotos] = useState([]);
    const [isPhotosLoading, setIsPhotosLoading] = useState(false);
    const [photosError, setPhotosError] = useState("");
    const unityInstanceRef = useRef(null);
    const tokenRef = useRef(null);
    const fetchedOnceRef = useRef(false);
    const loginBufferRef = useRef(null);

    useEffect(() => {
        /* =======================
            401/502 에러 처리 로직 (추가된 기능)
         ======================= */

        const POPUP_COOLDOWN_MS = 3000;
        const REDIRECT_DELAY_MS = 800;
        const LOGIN_PATH = "/login";
        let lastPopupAt = 0;

        const shouldPopup = () => {
            const now = Date.now();
            if (now - lastPopupAt > POPUP_COOLDOWN_MS) {
                lastPopupAt = now;
                return true;
            }
            return false;
        };

        const trigger401AndRedirect = () => {
            if (!shouldPopup()) return;
            alert("⛔ 세션이 만료되었거나 권한이 없습니다.\n다시 로그인해주세요.");
            setTimeout(() => {
                window.location.assign(LOGIN_PATH);
            }, REDIRECT_DELAY_MS);
        };

        const trigger502Popup = () => {
            if (!shouldPopup()) return;
            alert("⚠️ 서버가 일시적으로 응답하지 않습니다 (502 Bad Gateway).\n잠시 후 다시 시도해주세요.");
        };

        const has401 = (txt) => !!txt && (/\b401\b/.test(String(txt)) || /unauthorized/i.test(String(txt)));
        const has502 = (txt) => !!txt && (/\b502\b/.test(String(txt)) || /bad\s*gateway/i.test(String(txt)));

        // fetch 훅킹
        const originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
            window.fetch = async (...args) => {
                const res = await originalFetch(...args);
                // '/images/' 경로는 프록시 요청이므로 에러 처리에서 제외
                const isApiRequest = res.url.includes('/unity/api/') && !res.url.includes('/images/');
                if (res && isApiRequest) {
                    if (res.status === 401) trigger401AndRedirect();
                    else if (res.status === 502) trigger502Popup();
                }
                return res;
            };
        }

        // ... (XHR, console.error, 전역 에러 훅킹은 이전과 동일하게 유지)
        /* =======================
            사진 API 호출 (✅ 서버 프록시 방식)
         ======================= */
        async function fetchPhotosWithToken(jwt) {
            setIsPhotosLoading(true);
            setPhotosError("");
            try {
                // 이 API는 이제 { plant_id: 1, image_key: 'path/to/image.png' } 형태의 목록을 반환해야 합니다.
                const res = await fetch("/unity/api/s3photos_for_react", {
                    headers: { "Authorization": `Bearer ${jwt}` }
                });
                if (!res.ok) {
                    throw new Error(`서버 응답 실패: ${res.status}`);
                }
                const data = await res.json();
                setPhotos(Array.isArray(data) ? data : []);
            } catch (err) {
                setPhotosError("사진 목록 요청 중 오류가 발생했습니다.");
                setPhotos([]);
                console.error(err);
            } finally {
                setIsPhotosLoading(false);
                fetchedOnceRef.current = true;
            }
        }
        // ... (tryFetchPhotos, onMessage, trySendToUnity 함수는 이전과 동일하게 유지)
        const onMessage = (event) => {
            if (event.data?.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                tokenRef.current = token;
                try { localStorage.setItem("token", token); } catch { }
                loginBufferRef.current = { user_id, token };
                trySendToUnity();
                tryFetchPhotos();
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

        function tryFetchPhotos() {
            if (fetchedOnceRef.current) return;
            const local = localStorage.getItem("token");
            const jwt = tokenRef.current || local;
            if (jwt) fetchPhotosWithToken(jwt);
        }
        tryFetchPhotos();

        /* =======================

            Unity 로더 스크립트 삽입 (원본 코드)

         ======================= */

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
                        unityInstanceRef.current = instance;
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

        // 클린업 함수

        return () => {
            try { document.body.removeChild(script); } catch { }
            window.removeEventListener("message", onMessage);
            // ... (다른 이벤트 리스너 및 훅 복원 코드)
            if (typeof originalFetch === 'function') window.fetch = originalFetch;
        };
    }, []);

    return (
        <div style={{ margin: "15px auto" }}>
            <div
                style={{
                    position: "relative",
                    height: "65vh",
                    width: "calc(65vh * (16 / 9))",
                    margin: "0 auto",
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
            >

                {/* 로딩 오버레이 */}
                {isLoading && (
                    <div
                        style={{
                            position: "absolute", inset: 0, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            backgroundColor: "#ffffffee", borderRadius: "16px", zIndex: 10,
                            color: "#5e865f", fontSize: "18px",
                        }}
                    >
                        ⏳ Unity 로딩 중...

                    </div>
                )}

                {/* Unity Canvas */}
                <canvas
                    id="unity-canvas"
                    style={{ width: "100%", height: "100%", borderRadius: "16px", display: "block" }}
                ></canvas>

                {/* 우측 패널 */}
                <aside
                    style={{
                        position: "absolute", top: 0, left: "calc(100% + 20px)",
                        height: "100%", width: "clamp(150px, 15vw, 300px)",
                        background: "#fff", borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        padding: "10px", overflowY: "auto",
                    }}
                >

                    <h3 style={{ fontSize: "15px", margin: "0 0 10px", color: "#2f3634" }}>내 식물 이미지</h3>

                    {isPhotosLoading && <div style={{ fontSize: 13, color: "#5e865f" }}>불러오는 중…</div>}
                    {!!photosError && <div style={{ fontSize: 12, color: "#b00020" }}>{photosError}</div>}

                    <div
                        style={{
                            display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "8px",
                        }}
                    >
                        {photos.map((p, i) => (
                            <div
                                key={`${p.plant_id}-${i}`}
                                style={{
                                    border: "1px solid #e5e7eb", borderRadius: "8px",
                                    overflow: "hidden", background: "#f9fafb",
                                }}
                            >
                                <img
                                    // ✅ FastAPI 프록시 엔드포인트를 통해 이미지 로드
                                    src={`/images/${p.image_key}`}
                                    alt={`plant-${p.plant_id}`}
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