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
import AdminUserDetail from './pages/AdminUserDetail';
import AdminAccessGroups from './pages/AdminAccessGroups';
import AdminAccessRequests from './pages/AdminAccessRequests';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminExams from './pages/AdminExams';
import AdminExamForm from './pages/AdminExamForm';
import AdminAttempts from './pages/AdminAttempts';
import AdminAttemptDetail from './pages/AdminAttemptDetail';
import AdminAbout from './pages/AdminAbout';
import AdminBooks from './pages/AdminBooks';
import AdminBookForm from './pages/AdminBookForm';
import PostDetail from './pages/PostDetail';
import SeriesList from './pages/SeriesList';
import SeriesDetail from './pages/SeriesDetail';
import AboutPage from './pages/AboutPage';
import LibraryPage from './pages/LibraryPage';
import BookDetailPage from './pages/BookDetailPage';
import BookReaderPage from './pages/BookReaderPage';
import MyHighlightsPage from './pages/MyHighlightsPage';
import MemberLogin from './pages/MemberLogin';
import MemberRegister from './pages/MemberRegister';
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
        <Route path="/about" element={<AboutPage />} />
        <Route path="/library" element={<LibraryPage />} />
        {/* Must come before /library/:slug — a static segment ranks higher in
            React Router's matcher regardless of declaration order, but kept
            here first anyway for readability. */}
        <Route path="/library/highlights" element={<MyHighlightsPage />} />
        <Route path="/library/:slug" element={<BookDetailPage />} />
        <Route path="/library/:slug/read" element={<BookReaderPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/member/login" element={<MemberLogin />} />
        <Route path="/member/register" element={<MemberRegister />} />
        <Route element={<RequireAuth />}>
          <Route path="/admin/posts" element={<AdminPosts />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/access-groups" element={<AdminAccessGroups />} />
          <Route path="/admin/access-requests" element={<AdminAccessRequests />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
          <Route path="/admin/series" element={<AdminSeries />} />
          <Route path="/admin/series/new" element={<AdminSeriesForm />} />
          <Route path="/admin/series/:id/edit" element={<AdminSeriesForm />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/exams/new" element={<AdminExamForm />} />
          <Route path="/admin/exams/:id/edit" element={<AdminExamForm />} />
          <Route path="/admin/attempts" element={<AdminAttempts />} />
          <Route path="/admin/attempts/:id" element={<AdminAttemptDetail />} />
          <Route path="/admin/about" element={<AdminAbout />} />
          <Route path="/admin/books" element={<AdminBooks />} />
          <Route path="/admin/books/new" element={<AdminBookForm />} />
          <Route path="/admin/books/:id/edit" element={<AdminBookForm />} />
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
