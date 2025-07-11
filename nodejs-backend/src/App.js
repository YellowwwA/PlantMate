import React from 'react';

function App() {
    return (
        <div style={{ textAlign: 'center', maxWidth: 900, margin: 'auto', padding: 20 }}>
            <h1>Game</h1>

            <div style={{ border: '1px solid #ddd', height: '600px', marginBottom: 20 }}>
                <iframe
                    src="/public/unity/index.html"
                    title="Unity WebGL Game"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allowFullScreen
                />
            </div>

            <p>여기에 게임 설명이 들어갑니다.</p>
        </div>
    );
}

export default App;
