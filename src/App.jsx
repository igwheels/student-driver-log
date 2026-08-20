import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import Login from './pages/Login';
import Students from './pages/Students';
import AddStudent from './pages/AddStudent';
import Dashboard from './pages/Dashboard';
import DriveTimer from './pages/DriveTimer';
import LogDrive from './pages/LogDrive';
import Account from './pages/Account';
import ManageStudents from './pages/ManageStudents';
import ShareButton from './components/ShareButton';

const TITLES = {
  '/students': 'Student Drivers',
  '/add-student': 'Add Student Driver',
  '/account': 'Account',
  '/manage-students': 'Manage Students',
};

function RequireAuth({ children }) {
  const { user, hydrated, authChecked } = useApp();
  if (!hydrated || !authChecked) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = location.pathname === '/';
  const isTimer = location.pathname.startsWith('/drive-timer');
  const showTopbar = !isLogin && !isTimer;
  const isDashboard = location.pathname.startsWith('/dashboard');
  const title = TITLES[location.pathname] ||
    (isDashboard ? 'Dashboard'
    : location.pathname.startsWith('/log-drive') ? 'Log a Drive' : 'Student Driver Log');

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  const handleAccount = () => {
    setMenuOpen(false);
    navigate('/account');
  };

  const handleManageStudents = () => {
    setMenuOpen(false);
    navigate('/manage-students');
  };

  return (
    <div className="app-shell">
      {showTopbar && (
        <div className="topbar">
          {location.pathname !== '/students' && (
            <button className="back" onClick={() => navigate(-1)}>‹ Back</button>
          )}
          <button
            className="logo-btn"
            onClick={() => navigate('/students')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            title="Go to home"
          >
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Student Driver Log" />
          </button>
          <span className="title">{title}</span>
          <div style={{ flex: 1 }} />
          <ShareButton title={title} />
          <div className="menu-wrapper">
            <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)} title="Menu">
              ☰
            </button>
            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="menu-dropdown">
                  <button onClick={handleAccount}>Account</button>
                  <button onClick={handleManageStudents}>Manage students</button>
                  <button onClick={handleLogout}>Log out</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/students" element={<RequireAuth><Students /></RequireAuth>} />
        <Route path="/add-student" element={<RequireAuth><AddStudent /></RequireAuth>} />
        <Route path="/dashboard/:studentId" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/drive-timer/:studentId" element={<RequireAuth><DriveTimer /></RequireAuth>} />
        <Route path="/log-drive/:studentId" element={<RequireAuth><LogDrive /></RequireAuth>} />
        <Route path="/log-drive/:studentId/:logId" element={<RequireAuth><LogDrive /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="/manage-students" element={<RequireAuth><ManageStudents /></RequireAuth>} />
      </Routes>
    </div>
  );
}
