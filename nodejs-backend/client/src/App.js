import React from 'react';

function App() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>🪴PlantMate🪴</h1>

      <div style={{ border: '1px solid #ccc', height: '600px', marginBottom: '20px' }}>
        <iframe
          src="/unity/index.html"
          title="Unity WebGL Game"
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
        />
      </div>

      <p style={{ textAlign: 'center', fontSize: '16px', color: '#555' }}>
        🌱자신이 찍은 식물로 정원을 꾸며보세요!🌱
      </p>
    </div>
  );
}

export default App;