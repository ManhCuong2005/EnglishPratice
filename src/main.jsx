import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { initializeSpeech } from './lib/learning.js';

// Tải trước danh sách giọng đọc ngay khi ứng dụng mở để lần phát đầu phản hồi nhanh hơn.
initializeSpeech();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
