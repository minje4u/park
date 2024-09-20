//https://app.netlify.com/sites/parkkk
//URL:       https://parkkk.netlify.app
//Site ID:   73ef588a-2a70-4b2e-a493-12ce4eb01b80



import React, { useState } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import "./Login.css";

// API_URL 설정을 수정합니다.
const API_URL = '';

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
    console.log('API_URL:', API_URL);
    console.log('Full request URL:', `${API_URL}/login`);
    try {
      // API 요청 URL을 수정합니다.
      const response = await axios.post('/.netlify/functions/api/login', { name, password });
      if (response.data.isInitialPassword) {
        setShowChangePassword(true);
      } else {
        onLogin(response.data.name, response.data.role);
        if (response.data.role === 'admin') {
          navigate('/admin');
        } else {
          navigate(`/worker/${response.data.name}`);
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
      // API 요청 URL을 수정합니다.
      const response = await axios.post(`${API_URL}/change-password`, { name, newPassword });
      console.log('비밀번호 변경 응답:', response.data);
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
