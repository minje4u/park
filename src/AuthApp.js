import React, { useState } from 'react';
import bcrypt from 'bcryptjs';

const AuthApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 비밀번호 해시화 함수
  const hashPassword = (password) => {
    const salt = bcrypt.genSaltSync(10); // 솔트 생성
    return bcrypt.hashSync(password, salt); // 해시화된 비밀번호 반환
  };

  // 비밀번호 검증 함수
  const verifyPassword = (inputPassword, storedHashedPassword) => {
    return bcrypt.compareSync(inputPassword, storedHashedPassword); // 입력한 비밀번호와 저장된 해시값 비교
  };

  // 회원가입 처리 함수
  const handleSignUp = () => {
    const hashedPassword = hashPassword(password); // 비밀번호 해시화
    localStorage.setItem(username, JSON.stringify({ username, password: hashedPassword })); // 로컬 스토리지에 해시화된 비밀번호 저장
    alert('회원가입 성공');
    setUsername('');
    setPassword('');
  };

  // 로그인 처리 함수
  const handleLogin = () => {
    const storedUser = JSON.parse(localStorage.getItem(username)); // 로컬 스토리지에서 사용자 정보 불러오기

    if (storedUser && verifyPassword(password, storedUser.password)) {
      alert('로그인 성공');
      setIsLogin(true); // 로그인 성공 처리
      setLoginError(''); // 에러 초기화
    } else {
      setLoginError('비밀번호가 일치하지 않습니다.'); // 로그인 실패 시 메시지
      setIsLogin(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isLogin ? '로그인 성공' : '로그인 또는 회원가입'}</h2>
      <input
        type="text"
        placeholder="사용자 이름"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleSignUp}>회원가입</button>
      <button onClick={handleLogin}>로그인</button>
      {loginError && <p style={{ color: 'red' }}>{loginError}</p>} {/* 로그인 실패 시 에러 메시지 */}
    </div>
  );
};

export default AuthApp;
