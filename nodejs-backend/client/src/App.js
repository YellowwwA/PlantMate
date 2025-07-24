import React from 'react';
import Header from './Header';
import "./App.css";

function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', paddingTop: '80px' }}>
      <Header />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ textAlign: 'center' }}>🪴PlantMate🪴</h1>

        {/* ✅ 화면 크기에 따라 자동 조절 */}
        <div style={{ border: '1px solid #ccc', height: 'calc(100vh - 250px)', marginBottom: '20px', overflow: 'hidden' }}>
          <iframe
            src="/unity/index.html"
            title="Unity WebGL Game"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
            allowFullScreen
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: '16px', color: '#555' }}>
          🌱자신이 찍은 식물로 정원을 꾸며보세요!🌱
        </p>
      </div>
    </div>
  );
}

export default App;
