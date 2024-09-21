import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from 'axios';
import "./WorkerPage.css";

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const WorkerPage = () => {
  const { username } = useParams();
  const [workerData, setWorkerData] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showLastMonthModal, setShowLastMonthModal] = useState(false);
  const [lastMonthData, setLastMonthData] = useState(null);

  const fetchWorkerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/employee/work?employeeName=${encodeURIComponent(username)}`);
      console.log('서버 응답:', response.data);
      const data = response.data;
      
      if (Array.isArray(data) && data.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = data.find(item => new Date(item.date).toISOString().split('T')[0] === today);
        setTodayData(todayEntry || null);
        setWorkerData(data.filter(item => new Date(item.date).toISOString().split('T')[0] !== today));
      } else {
        setTodayData(null);
        setWorkerData([]);
      }
    } catch (error) {
      console.error('작업자 데이터 조회 중 오류 발생:', error);
      if (error.response) {
        console.error('서버 응답:', error.response.data);
      } else if (error.request) {
        console.error('서버 응답 없음');
      } else {
        console.error('요청 설정 중 오류:', error.message);
      }
      setWorkerData([]);
      setTodayData(null);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  const fetchLastMonthData = useCallback(async () => {
    try {
      const response = await axios.get(`/employee/lastmonth?employeeName=${encodeURIComponent(username)}`);
      setLastMonthData(response.data);
    } catch (error) {
      console.error('지난달 데이터 조회 중 오류 발생:', error);
      setLastMonthData(null);
    }
  }, [username]);

  useEffect(() => {
    fetchWorkerData();
    fetchNotices();
    setCurrentMonth(getCurrentMonth());
  }, [fetchWorkerData]);

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  };

  const fetchNotices = async () => {
    try {
      const response = await axios.get('/notices');
      setNotices(response.data);
    } catch (error) {
      console.error('공지사항 조회 중 오류 발생:', error);
    }
  };

  const handleRefresh = () => {
    fetchWorkerData();
    fetchNotices();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const sumKg = workerData.reduce((sum, item) => sum + item.weight, 0) + (todayData?.weight || 0);
  const totalPay = workerData.reduce((sum, item) => sum + item.payment, 0) + (todayData?.payment || 0);

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

  const openLastMonthModal = () => {
    fetchLastMonthData();
    setShowLastMonthModal(true);
  };

  const closeLastMonthModal = () => {
    setShowLastMonthModal(false);
  };

  const renderLastMonthData = () => {
    const now = new Date();
    if (now.getDate() >= 11 && now.getHours() >= 0) {
      return <p>데이터가 없습니다.</p>;
    }
    if (lastMonthData) {
      return (
        <>
          <p>총 작업량: {lastMonthData.totalWeight.toFixed(2)} Kg</p>
          <p>총 도급비: {formatCurrency(lastMonthData.totalPayment)}</p>
        </>
      );
    }
    return <p>데이터를 불러오는 중...</p>;
  };

  return (
    <div className="worker-container">
      <div className="worker-header">
        <div className="worker-header-content">
          <h1>{username}<span className="header-small">님의</span></h1>
          <h2>{currentMonth} 작업현황</h2>
        </div>
      </div>
      
      <div className="notice-board">
        <div className="notice-header">
          <h3>공지사항</h3>
        </div>
        <div className="notice-content">
          {notices.length > 0 ? (
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
          ) : (
            <p className="no-notice-message">현재 등록된 공지사항이 없습니다.</p>
          )}
        </div>
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
              <span className="stat-value">{todayData.weight.toFixed(2)} Kg</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">작업시간</span>
              <span className="stat-value">{todayData.workHours}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">도급비</span>
              <span className="stat-value">{formatCurrency(todayData.payment)}</span>
            </div>
          </div>
        ) : (
          <p className="no-data-message">오늘의 작업 데이터가 아직 없습니다.</p>
        )}
      </div>

      <div className="table-container">
        <div className="table-header">
          <h2>이번달 작업내역</h2>
          <button className="refresh-button" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        <div className="table-responsive">
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
                <tr key={item.date} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                  <td>{new Date(item.date).toLocaleDateString()}</td>
                  <td>{item.weight.toFixed(2)}</td>
                  <td>{item.workHours}</td>
                  <td>{formatCurrency(item.payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="worker-stats">
        <div className="stat-card">
          <span className="stat-label">총 작업량</span>
          <span className="stat-value">{sumKg.toFixed(2)} Kg</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">총 도급비</span>
          <span className="stat-value">{formatCurrency(totalPay)}</span>
        </div>
      </div>

      <div className="info-box">
        <h3><span className="info-icon">ℹ️</span> 안내사항</h3>
        <ol>
          <li>공지사항 확인을 생활화 합시다.</li>
          <li>작업내역은 매달 1일~말일까지 보여지며, 매월 10일경에 초기화 됩니다.</li>
        </ol>
      </div>

      <button className="last-month-button" onClick={openLastMonthModal}>
        지난달 도급비용 확인
      </button>

      {showLastMonthModal && (
        <div className="modal-overlay" onClick={closeLastMonthModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>지난달 도급비용</h3>
            {renderLastMonthData()}
            <button onClick={closeLastMonthModal}>닫기</button>
          </div>
        </div>
      )}

      {selectedNotice && (
        <div className="modal-overlay" onClick={closeNoticeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedNotice.title}</h3>
            <p>{selectedNotice.content}</p>
            <small>{new Date(selectedNotice.dateTime).toLocaleString()}</small>
            <button onClick={closeNoticeModal}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerPage;
