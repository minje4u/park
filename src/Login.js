import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import "./Login.css";

const Login = ({ onLogin }) => {
  const [groupNumber, setGroupNumber] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedGroupNumber = localStorage.getItem('savedGroupNumber');
    const savedPassword = localStorage.getItem('savedPassword');
    if (savedGroupNumber && savedPassword) {
      setGroupNumber(savedGroupNumber);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const response = await axios.post('/login', { groupNumber, password });
      if (response.data.isInitialPassword) {
        setShowChangePassword(true);
      } else {
        if (rememberMe) {
          localStorage.setItem('savedGroupNumber', groupNumber);
          localStorage.setItem('savedPassword', password);
        } else {
          localStorage.removeItem('savedGroupNumber');
          localStorage.removeItem('savedPassword');
        }
        onLogin(response.data.name, response.data.role, response.data.groupNumber);
        if (response.data.role === 'admin') {
          navigate('/admin');
        } else {
          navigate(`/worker/${response.data.groupNumber}`);
        }
      }
    } catch (error) {
      console.error('로그인 중 오류 발생:', error);
      setErrorMessage(error.response?.data?.error || "로그인에 실패했습니다.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      const response = await axios.post('/change-password', { groupNumber, newPassword });
      console.log('비밀번호 변경 응답:', response.data);
      if (response.data.message === "비밀번호가 성공적으로 변경되었습니다.") {
        setErrorMessage("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.");
        console.log('비밀번호 변경 성공');

        // 로그인 상태 초기화
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userRole');
        localStorage.removeItem('username');
        localStorage.removeItem('groupNumber');
        
        // 비밀번호 변경 성공 후, 로그인 화면으로 리다이렉트
        setShowChangePassword(false);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");

        // 2초 후 페이지 새로고침
        setTimeout(() => {
          console.log('페이지 새로고침');
          window.location.reload();
        }, 2000);
      } else {
        setErrorMessage(response.data.message || "비밀번호 변경에 실패했습니다.");
        console.log('비밀번호 변경 실패:', response.data.message);
      }
    } catch (error) {
      console.error('비밀번호 변경 중 오류 발생:', error);
      setErrorMessage(error.response?.data?.error || "비밀번호 변경에 실패했습니다.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{showChangePassword ? "비밀번호 변경" : "로그인"}</h2>
        {showChangePassword ? (
          <form onSubmit={handlePasswordChange}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              required
            />
            <button type="submit">비밀번호 변경</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={groupNumber}
              onChange={(e) => setGroupNumber(e.target.value)}
              placeholder="조-ID"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
            />
            <div className="remember-me-container">
              <label className="remember-me">
                <span>자동 로그인</span>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    if (!e.target.checked) {
                      setGroupNumber("");
                      setPassword("");
                      localStorage.removeItem('savedGroupNumber');
                      localStorage.removeItem('savedPassword');
                    }
                  }}
                />
              </label>
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <button type="submit">로그인</button>
          </form>
        )}
        {errorMessage && <p className="confirmation-message">{errorMessage}</p>}
      </div>
    </div>
  );
};

export default Login;
