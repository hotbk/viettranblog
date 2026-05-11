import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import RequireAuth from './components/RequireAuth';
import AdminLogin from './pages/AdminLogin';
import AdminPosts from './pages/AdminPosts';
import AdminUsers from './pages/AdminUsers';
import PostDetail from './pages/PostDetail';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/posts/:slug" element={<PostDetail />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<RequireAuth />}>
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
