import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import "./WorkerPage.css";

const WorkerPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [workerData, setWorkerData] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [fortune, setFortune] = useState('');
  const [fortuneClicked, setFortuneClicked] = useState(false);

  useEffect(() => {
    fetchWorkerData();
    fetchNotices();
    checkFortuneStatus();
    setCurrentMonth(getCurrentMonth());
  }, [username]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  };

  const fetchWorkerData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/.netlify/functions/api/worker/${encodeURIComponent(username)}`);
      const data = response.data;
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = data.find(item => item.날짜 === today);
      setTodayData(todayEntry || null);
      setWorkerData(data.filter(item => item.날짜 !== today));
    } catch (error) {
      console.error('작업자 데이터 조회 중 오류 발생:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotices = async () => {
    try {
      const response = await axios.get('/.netlify/functions/api/notices');
      setNotices(response.data);
    } catch (error) {
      console.error('공지사항 조회 중 오류 발생:', error);
    }
  };

  const checkFortuneStatus = async () => {
    try {
      const response = await axios.get(`/.netlify/functions/api/fortune-status/${username}`);
      setFortuneClicked(response.data.clicked);
      if (response.data.fortune) {
        setFortune(response.data.fortune);
      }
    } catch (error) {
      console.error('운세 상태 확인 중 오류 발생:', error);
    }
  };

  const getFortuneOfTheDay = async () => {
    if (!fortuneClicked) {
      try {
        const response = await axios.post(`/.netlify/functions/api/get-fortune/${username}`);
        setFortune(response.data.fortune);
        setFortuneClicked(true);
      } catch (error) {
        console.error('운세 가져오기 중 오류 발생:', error);
      }
    }
  };

  const handleRefresh = () => {
    fetchWorkerData();
    fetchNotices();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const sumKg = workerData.reduce((sum, item) => sum + item.중량, 0) + (todayData?.중량 || 0);
  const totalPay = workerData.reduce((sum, item) => sum + item.도급비, 0) + (todayData?.도급비 || 0);

  const openNoticeModal = (notice) => {
    setSelectedNotice(notice);
  };

  const closeNoticeModal = () => {
    setSelectedNotice(null);
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('ko-KR', options);
  };

  return (
    <div className="worker-container">
      <div className="worker-header">
        <h1>{username}님의 작업 현황</h1>
        <h2 className="current-month">{currentMonth}</h2>
      </div>
      
      <div className="notice-board">
        <h3>공지사항</h3>
        <div className="notice-buttons">
          {notices.map((notice) => (
            <button
              key={notice._id}
              className="notice-button"
              onClick={() => openNoticeModal(notice)}
            >
              <span className="notice-icon">📢</span>
              {notice.title}
            </button>
          ))}
        </div>
      </div>

      <div className="fortune-section">
        <button 
          onClick={getFortuneOfTheDay} 
          disabled={fortuneClicked}
          className={`fortune-button ${fortuneClicked ? 'clicked' : ''}`}
        >
          {fortuneClicked ? '오늘의 운세' : '오늘의 운세 보기'}
        </button>
        {fortune && <p className="fortune-text">{fortune}</p>}
      </div>

      <div className="today-data">
        <div className="today-header">
          <h3>오늘의 작업</h3>
          <span className="today-date">{formatDate(new Date())}</span>
        </div>
        {todayData ? (
          <div className="today-stats">
            <div className="stat-item">
              <span className="stat-label">중량</span>
              <span className="stat-value">{todayData.중량.toFixed(2)} Kg</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">작업시간</span>
              <span className="stat-value">{todayData.작업시간}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">도급비</span>
              <span className="stat-value">{formatCurrency(todayData.도급비)}</span>
            </div>
          </div>
        ) : (
          <p className="no-data-message">오늘의 작업 데이터가 아직 없습니다.</p>
        )}
      </div>

      <div className="worker-stats">
        <div className="stat-card">
          <h3>총 작업량</h3>
          <p>{sumKg.toFixed(2)} Kg</p>
        </div>
        <div className="stat-card">
          <h3>총 도급비</h3>
          <p>{formatCurrency(totalPay)}</p>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>작업 상세 내역</h2>
          <button className="refresh-button" onClick={handleRefresh} disabled={isLoading}>
            <span className="material-icons">refresh</span>
            {isLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        <table className="worker-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>중량(Kg)</th>
              <th>작업시간</th>
              <th>도급비용</th>
            </tr>
          </thead>
          <tbody>
            {workerData.map((item, index) => (
              <tr key={item.날짜} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{item.날짜}</td>
                <td>{item.중량.toFixed(2)}</td>
                <td>{item.작업시간}</td>
                <td>{formatCurrency(item.도급비)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedNotice && (
        <div className="modal-overlay" onClick={closeNoticeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedNotice.title}</h3>
            <p>{selectedNotice.content}</p>
            <small>{new Date(selectedNotice.createdAt).toLocaleString()}</small>
            <button onClick={closeNoticeModal}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerPage;
