import React, { useState, useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import Login from "./Login";
import AdminPage from "./AdminPage";
import WorkerPage from "./WorkerPage";
import PasswordChangePage from './PasswordChangePage';
import EmployeeManagement from "./EmployeeManagement";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const storedLoginStatus = localStorage.getItem('isLoggedIn');
    const storedRole = localStorage.getItem('userRole');
    const storedUsername = localStorage.getItem('username');
    if (storedLoginStatus === 'true' && storedRole && storedUsername) {
      setIsLoggedIn(true);
      setRole(storedRole);
      setUsername(storedUsername);
    }
  }, []);

  const handleLogin = (name, userRole) => {
    setIsLoggedIn(true);
    setRole(userRole);
    setUsername(name);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', userRole);
    localStorage.setItem('username', name);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setRole("");
    setUsername("");
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/password-change" element={
          isLoggedIn ? <PasswordChangePage /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin" element={
          isLoggedIn && role === "admin" ? <AdminPage username={username} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/worker/:username" element={
          isLoggedIn && role === "worker" ? <WorkerPage onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/employees" element={
          isLoggedIn && role === "admin" ? <EmployeeManagement /> : <Navigate to="/login" replace />
        } />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;