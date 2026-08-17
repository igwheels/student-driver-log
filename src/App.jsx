import React from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Login from './pages/Login';
import Students from './pages/Students';
import AddStudent from './pages/AddStudent';
import Dashboard from './pages/Dashboard';
import DriveTimer from './pages/DriveTimer';
import LogDrive from './pages/LogDrive';

const TITLES = {
  '/students': 'Student Drivers',
  '/add-student': 'Add Student Driver',
};

function RequireAuth({ children }) {
  const { user, hydrated } = useApp();
  if (!hydrated) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === '/';
  const isTimer = location.pathname.startsWith('/drive-timer');
  const showTopbar = !isLogin && !isTimer;
  const title = TITLES[location.pathname] ||
    (location.pathname.startsWith('/dashboard') ? 'Dashboard'
    : location.pathname.startsWith('/log-drive') ? 'Log a Drive' : 'Student Driver Log');

  return (
    <div className="app-shell">
      {showTopbar && (
        <div className="topbar">
          {location.pathname !== '/students' && (
            <button className="back" onClick={() => navigate(-1)}>‹ Back</button>
          )}
          <img src="/logo.png" alt="" />
          <span className="title">{title}</span>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
        <Route path="/add-student" element={<RequireAuth><AddStudent /></RequireAuth>} />
        <Route path="/dashboard/:studentId" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/drive-timer/:studentId" element={<RequireAuth><DriveTimer /></RequireAuth>} />
        <Route path="/log-drive/:studentId" element={<RequireAuth><LogDrive /></RequireAuth>} />
      </Routes>
    </div>
  );
}
