
import React from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, configured } from './supabase';
import './style.css';

function App() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#10100f',
      color: '#f5f0e8',
      padding: '40px 20px',
      fontFamily: 'sans-serif',
      textAlign: 'center'
    }}>
      <h1 style={{fontSize: '42px'}}>unblinded</h1>
      <p>চিন্তার স্বাধীন মঞ্চ</p>
      <p>ধর্ম, দর্শন, ইতিহাস ও মানবচিন্তার মুক্ত আলোচনা।</p>
      <p style={{color: '#aaa', marginTop: '30px'}}>
        {configured
          ? 'সার্ভারের সাথে সংযোগ প্রস্তুত।'
          : 'Supabase সংযোগের জন্য সেটিংস প্রয়োজন।'}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
