import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import RequireAuth from './components/RequireAuth';
import RequireMember from './components/RequireMember';
import AdminLogin from './pages/AdminLogin';
import AdminPosts from './pages/AdminPosts';
import AdminSeries from './pages/AdminSeries';
import AdminSeriesForm from './pages/AdminSeriesForm';
import AdminUsers from './pages/AdminUsers';
import AdminExams from './pages/AdminExams';
import AdminExamForm from './pages/AdminExamForm';
import AdminAttempts from './pages/AdminAttempts';
import AdminAttemptDetail from './pages/AdminAttemptDetail';
import PostDetail from './pages/PostDetail';
import SeriesList from './pages/SeriesList';
import SeriesDetail from './pages/SeriesDetail';
import MemberLogin from './pages/MemberLogin';
import MemberExams from './pages/MemberExams';
import MemberExamTake from './pages/MemberExamTake';
import MemberAttemptResult from './pages/MemberAttemptResult';
import MemberHistory from './pages/MemberHistory';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/posts/:slug" element={<PostDetail />} />
        <Route path="/series" element={<SeriesList />} />
        <Route path="/series/:slug" element={<SeriesDetail />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/member/login" element={<MemberLogin />} />
        <Route element={<RequireAuth />}>
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/series" element={<AdminSeries />} />
          <Route path="/admin/series/new" element={<AdminSeriesForm />} />
          <Route path="/admin/series/:id/edit" element={<AdminSeriesForm />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/exams/new" element={<AdminExamForm />} />
          <Route path="/admin/exams/:id/edit" element={<AdminExamForm />} />
          <Route path="/admin/attempts" element={<AdminAttempts />} />
          <Route path="/admin/attempts/:id" element={<AdminAttemptDetail />} />
        </Route>
        <Route element={<RequireMember />}>
          <Route path="/member/exams" element={<MemberExams />} />
          <Route path="/member/exams/:id" element={<MemberExamTake />} />
          <Route path="/member/attempts/:attemptId" element={<MemberAttemptResult />} />
          <Route path="/member/history" element={<MemberHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
