import React from 'react';
import Header from './Header';
import "./App.css";
import UnityPlayer from './UnityPlayer'

function App() {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 🔝 고정된 Header */}
      <div style={{ flexShrink: 0 }}>
        <Header />
      </div>

      {/* 🪴 제목 (Header 아래에 노출되도록 paddingTop 줌)  */}
      <div
        style={{
          flexShrink: 0,
          textAlign: 'center',
          paddingTop: '30px', // Header 높이만큼 여백 추가
          paddingBottom: '10px',
          backgroundColor: '#D9E4E4',
        }}
      >
        <h1 style={{ margin: 0 }}>🪴PlantMate🪴</h1>

        <UnityPlayer />

      </div>

      {/* 🕹️ Unity iframe */}
      {/* <div
        style={{
          flexShrink: 0,
          height: '70vh', // 원하는 만큼 조정 (ex: 60% of viewport height)
          overflow: 'hidden',
        }}
      >
        <iframe
          src="/unity/index.html"
          title="Unity WebGL Game"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allowFullScreen
        />
      </div> */}

      {/* 🌱 설명 */}
      <div
        style={{
          flexShrink: 0,
          textAlign: 'center',
          padding: '10px 0',
          backgroundColor: '#D9E4E4',
        }}
      >
        <p style={{ fontSize: '16px', color: '#555', margin: 0 }}>
          🌱자신이 찍은 식물로 정원을 꾸며보세요!🌱
        </p>
      </div>
    </div>
  );






}

export default App;
