import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Generator } from './generator/Generator.tsx';
import { AdminPage } from './admin/AdminPage.tsx';
import { BUILD_ID } from './build-id';
import './styles/app.less';
import ReactDOM from 'react-dom/client';
import { createContext } from 'react';

export const LanguageContext = createContext(null);
document.documentElement.dataset.build = BUILD_ID;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Generator />} />
      <Route path="/live" element={<Generator />} />
      <Route path="/streamers" element={<Generator />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
