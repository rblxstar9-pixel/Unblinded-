
import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#10100f',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      textAlign: 'center',
      padding: '24px'
    }}>
      <h1 style={{fontSize: '48px'}}>unblinded</h1>
      <p>চিন্তার স্বাধীন মঞ্চ</p>
      <p>ওয়েবসাইট সফলভাবে চালু হয়েছে।</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
