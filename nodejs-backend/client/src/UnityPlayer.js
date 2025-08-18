import React, { useEffect, useRef, useState } from 'react';

const UnityPlayer = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [photos, setPhotos] = useState([]);
    const [isPhotosLoading, setIsPhotosLoading] = useState(false);
    const [photosError, setPhotosError] = useState("");

    const unityInstanceRef = useRef(null);
    const tokenRef = useRef(null);
    const fetchedOnceRef = useRef(false);
    const loginBufferRef = useRef(null); // ✅ Unity로 보낼 로그인 버퍼

    useEffect(() => {
        let unityInstance = null;

        /* =======================
           401/502 에러 처리 로직 (그대로)
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
                if (res) {
                    if (res.status === 401) trigger401AndRedirect();
                    else if (res.status === 502) trigger502Popup();
                }
                return res;
            };
        }

        // XHR 훅킹
        const OriginalXHR = window.XMLHttpRequest;
        let XHROverrideApplied = false;
        if (OriginalXHR) {
            function XHRProxy() {
                const xhr = new OriginalXHR();
                xhr.addEventListener('load', function () {
                    if (this.status === 401) trigger401AndRedirect();
                    else if (this.status === 502) trigger502Popup();
                });
                return xhr;
            }
            XHRProxy.prototype = OriginalXHR.prototype;
            window.XMLHttpRequest = XHRProxy;
            XHROverrideApplied = true;
        }

        // console.error 훅킹
        const originalConsoleError = console.error;
        console.error = function (...args) {
            const text = args.map(a => (typeof a === 'string' ? a : a?.message ?? JSON.stringify(a))).join(' ');
            if (has401(text)) trigger401AndRedirect();
            else if (has502(text)) trigger502Popup();
            return originalConsoleError.apply(console, args);
        };

        // 전역 에러
        const onWindowError = (e) => {
            const msg = e?.message || '';
            if (has401(msg)) trigger401AndRedirect();
            else if (has502(msg)) trigger502Popup();
        };
        const onUnhandledRejection = (e) => {
            const msg = String(e?.reason ?? '');
            if (has401(msg)) trigger401AndRedirect();
            else if (has502(msg)) trigger502Popup();
        };
        window.addEventListener('error', onWindowError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);

        /* =======================
           사진 API 호출 (토큰 필요)
        ======================= */
        async function fetchPhotosWithToken(jwt) {
            setIsPhotosLoading(true);
            setPhotosError("");
            try {
                const res = await fetch("/unity/api/s3photos", {
                    headers: { "Authorization": `Bearer ${jwt}` }
                });
                if (!res.ok) {
                    setPhotosError(`새로고침 실패 (${res.status})`);
                    setPhotos([]);
                    return;
                }
                const data = await res.json();
                setPhotos(Array.isArray(data) ? data : []);
            } catch {
                setPhotosError("사진 목록 요청 중 오류가 발생했습니다.");
                setPhotos([]);
            } finally {
                setIsPhotosLoading(false);
                fetchedOnceRef.current = true;
            }
        }

        function tryFetchPhotos() {
            // ❗ 토큰 없으면 호출하지 않음 (만료 팝업 방지)
            if (fetchedOnceRef.current) return;
            const local = localStorage.getItem("token");
            const jwt = tokenRef.current || local;
            if (jwt) fetchPhotosWithToken(jwt);
        }

        /* =======================
           부모창 → LOGIN_INFO 수신 (✅ 추가/복구)
           - tokenRef/로컬스토리지 저장
           - Unity에 전달(ReceiveUserInfo)
           - 사진 요청 트리거
        ======================= */
        const onMessage = (event) => {
            if (event.data?.type === "LOGIN_INFO") {
                const { user_id, token } = event.data;
                tokenRef.current = token;
                try { localStorage.setItem("token", token); } catch { }
                loginBufferRef.current = { user_id, token };
                trySendToUnity();      // Unity로 로그인 정보 전달
                tryFetchPhotos();      // ✅ 토큰 수신 시점에 사진 요청
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
                setTimeout(trySendToUnity, 300);
            }
        }

        // 최초에는 localStorage 토큰이 있으면 사용
        tryFetchPhotos();

        /* =======================
           Unity 로더 스크립트 삽입 (그대로)
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
                        unityInstance = instance;
                        unityInstanceRef.current = instance;
                        setIsLoading(false);
                        // 토큰이 이미 도착해 있었다면 Unity에 재전달 시도
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
            try { document.body.removeChild(script); } catch { }
            window.removeEventListener("message", onMessage);
            window.removeEventListener('error', onWindowError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            if (typeof originalFetch === 'function') window.fetch = originalFetch;
            if (XHROverrideApplied) window.XMLHttpRequest = OriginalXHR;
            console.error = originalConsoleError;
        };
    }, []);

    return (
        <div style={{ margin: "15px auto" }}>
            {/* ✅ 유니티만 가운데 정렬되는 래퍼 */}
            <div
                style={{
                    position: "relative",
                    height: "65vh",
                    width: "calc(65vh * (16 / 9))", // 유니티 16:9 비율 (반응형)
                    margin: "0 auto",               // ✅ 유니티 래퍼만 가운데 정렬
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
            >
                {/* 🔄 로딩 오버레이 */}
                {isLoading && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#ffffffee",
                            borderRadius: "16px",
                            zIndex: 10,
                            color: "#5e865f",
                            fontSize: "18px",
                        }}
                    >
                        ⏳ Unity 로딩 중...
                    </div>
                )}

                {/* 🎮 Unity Canvas */}
                <canvas
                    id="unity-canvas"
                    style={{ width: "100%", height: "100%", borderRadius: "16px", display: "block" }}
                ></canvas>

                {/* 🖼️ 우측 패널: 유니티 오른쪽에 '붙여놓기' */}
                <aside
                    style={{
                        position: "absolute",
                        top: 0,
                        left: "calc(100% + 20px)",           // 유니티 우측으로 20px 간격
                        height: "100%",                       // 유니티와 동일 높이
                        width: "clamp(150px, 15vw, 300px)",   // ✅ 반응형 폭(오타 수정: 최대 300px)
                        background: "#fff",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        padding: "10px",
                        overflowY: "auto",
                    }}
                >
                    <h3 style={{ fontSize: "15px", margin: "0 0 10px", color: "#2f3634" }}>내 식물 이미지</h3>

                    {isPhotosLoading && <div style={{ fontSize: 13, color: "#5e865f" }}>불러오는 중…</div>}
                    {!!photosError && <div style={{ fontSize: 12, color: "#b00020" }}>{photosError}</div>}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)", // 한 줄에 2개
                            gap: "8px",
                        }}
                    >
                        {photos.map((p, i) => (
                            <div
                                key={`${p.plant_id}-${i}`}
                                style={{
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    background: "#f9fafb",
                                }}
                            >
                                <img
                                    src={p.image_url}
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
