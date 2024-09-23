import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from 'axios';
import "./WorkerPage.css";

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const WorkerPage = () => {
  const { groupNumber } = useParams();
  const formattedGroupNumber = groupNumber ? groupNumber.toString() : undefined;
  const [workerName, setWorkerName] = useState('');
  const [workerData, setWorkerData] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [currentMonth, setCurrentMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showLastMonthModal, setShowLastMonthModal] = useState(false);
  const [lastMonthData, setLastMonthData] = useState(null);
  const [notification, setNotification] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    const eventSource = new EventSource('https://parkpa.netlify.app/.netlify/functions/api/events');
    eventSource.onmessage = (event) => {
      const eventData = JSON.parse(event.data);
      console.log('Received event data:', eventData);
      setNotification(eventData);
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (notification) {
      alert(`새로운 ${notification.type === 'notice' ? '공지사항' : '작업자료'}가 등록되었습니다.`);
    }
  }, [notification]);

  const fetchWorkerName = useCallback(async () => {
    try {
      const response = await axios.get(`/employee/${formattedGroupNumber}`);
      setWorkerName(response.data.name);
    } catch (error) {
      console.error('Error fetching worker name:', error);
    }
  }, [formattedGroupNumber]);

  const fetchWorkerData = useCallback(async () => {
    setIsLoading(true);
    console.log('Fetching worker data, groupNumber:', groupNumber);
    try {
      if (!groupNumber) {
        throw new Error('Group number is undefined');
      }
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const response = await axios.get('/employee/work', {
        params: {
          year,
          month,
          groupNumber
        }
      });
      console.log('Worker data:', response.data);
      setWorkerData(response.data);
      const todayWork = response.data.find(work => new Date(work.date).toDateString() === now.toDateString());
      setTodayData(todayWork || null);
    } catch (error) {
      console.error('Error fetching worker data:', error);
      setWorkerData([]);
      setTodayData(null);
    } finally {
      setIsLoading(false);
    }
  }, [groupNumber]);

  const fetchLastMonthData = useCallback(async () => {
    try {
      const response = await axios.get(`/employee/lastmonth?groupNumber=${encodeURIComponent(groupNumber)}`);
      setLastMonthData(response.data);
    } catch (error) {
      console.error('지난달 데이터 조회 중 오류 발생:', error);
      setLastMonthData(null);
    }
  }, [groupNumber]);

  useEffect(() => {
    if (formattedGroupNumber) {
      fetchWorkerName();
      fetchWorkerData();
    }
    fetchNotices();
    setCurrentMonth(getCurrentMonth());
  }, [fetchWorkerData, formattedGroupNumber, fetchWorkerName]);

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

  const sumKg = workerData.reduce((sum, item) => sum + item.weight, 0);
  const totalPay = workerData.reduce((sum, item) => sum + item.payment, 0);

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

  // 캡처 방지 코드 추가
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const publicVapidKey = process.env.REACT_APP_PUBLIC_VAPID_KEY;

    if (!publicVapidKey) {
      console.error('VAPID 키가 설정되지 않았습니다.');
      return;
    }

    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const subscribeUser = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
          console.log('Service Worker registration successful:', registration);

          await navigator.serviceWorker.ready;

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
          });
          console.log('Push subscription successful:', subscription);
          await axios.post('/subscribe', subscription);
        } catch (error) {
          console.error('Service Worker 또는 Push 구독 오류:', error);
        }
      } else {
        console.error('Service Worker 또는 Push 알림이 이 브라우저에서 지원되지 않습니다.');
      }
    };

    subscribeUser();
  }, []);

  const sortedData = useMemo(() => {
    let sortableItems = [...workerData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [workerData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="worker-container">
      <div className="worker-header">
        <div className="worker-header-content">
          <h1>{workerName}<span className="header-small">님의</span></h1>
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
                <th onClick={() => requestSort('date')}>
                  날짜 {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => requestSort('weight')}>
                  중량(Kg) {sortConfig.key === 'weight' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => requestSort('payment')}>
                  도급비용 {sortConfig.key === 'payment' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr key={`${item.date}-${index}`} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                  <td>{new Date(item.date).toLocaleDateString()}</td>
                  <td>{item.weight.toFixed(2)}</td>
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
