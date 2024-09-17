import React, { useState } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import "./Login.css";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Login = ({ onLogin }) => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  // useEffect 부분을 제거합니다.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const response = await axios.post(`${API_URL}/api/login`, { name, password });
      console.log('Login response:', response.data);
      
      if (password === '0000') {
        console.log('Initial password detected, showing password change form');
        setShowChangePassword(true);
      } else {
        console.log('Normal login, proceeding to main page');
        onLogin(response.data.name, response.data.role);
        if (response.data.role === 'admin') {
          navigate('/admin');
        } else {
          navigate(`/worker/${response.data.name}`);
        }
      }
    } catch (error) {
      console.error('로그인 중 오류 발생:', error);
      if (error.response) {
        // 서버 응답이 있는 경우
        setErrorMessage(error.response.data.error || "로그인에 실패했습니다.");
      } else if (error.request) {
        // 요청이 전송되었지만 응답을 받지 못한 경우
        setErrorMessage("서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.");
      } else {
        // 요청 설정 중 오류가 발생한 경우
        setErrorMessage("로그인 요청 중 오류가 발생했습니다.");
      }
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/change-password`, { name, newPassword });
      if (response.data.message === "비밀번호가 성공적으로 변경되었습니다.") {
        alert("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.");
        setShowChangePassword(false);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        navigate('/login');
      }
    } catch (error) {
      console.error('비밀번호 변경 중 오류 발생:', error);
      if (error.response) {
        setErrorMessage(error.response.data.error || "비밀번호 변경에 실패했습니다.");
      } else if (error.request) {
        setErrorMessage("서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.");
      } else {
        setErrorMessage("비밀번호 변경 요청 중 오류가 발생했습니다.");
      }
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
            />
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
            <button type="submit">로그인</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
