import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from 'axios';
import "./WorkerPage.css";

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 요청 중 오류:', error);
    if (error.response) {
      console.error('오류 응답:', error.response.data);
    }
    return Promise.reject(error);
  }
);

const WorkerPage = ({ monthStats }) => {
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
  const [notification, setNotification] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [fortune, setFortune] = useState('');
  const [luckyScore, setLuckyScore] = useState(0);
  const [accumulatedScore, setAccumulatedScore] = useState(0);
  const [showLuckyShop, setShowLuckyShop] = useState(false);
  const [luckyShopItems, setLuckyShopItems] = useState([]);
  const [canViewFortune, setCanViewFortune] = useState(true);
  const [lastFortuneDate, setLastFortuneDate] = useState(null);
  const [lastMonthSummary, setLastMonthSummary] = useState(null);
  const [isLoadingLastMonth, setIsLoadingLastMonth] = useState(false);

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
      alert(`새로운 ${notification.type === 'notice' ? '공지사���' : '작업자료'}가 등록되었습니다.`);
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

  const fetchFortune = useCallback(async () => {
    try {
      const response = await axios.get(`/fortunelogs/${groupNumber}`);
      if (response.data) {
        setFortune(response.data.content);
        setLuckyScore(response.data.luckyScore);
        setAccumulatedScore(response.data.accumulatedScore);
        setLastFortuneDate(response.data.lastViewDate);
        // 여기서 운세 내용을 설정하지 않습니다.
      } else {
        setFortune('');
        setLuckyScore(0);
        setLastFortuneDate(null);
      }
    } catch (error) {
      console.error('운세 조회 중 오류:', error);
      setFortune('');
      setLuckyScore(0);
      setLastFortuneDate(null);
    }
  }, [groupNumber]);

  useEffect(() => {
    fetchFortune();
  }, [fetchFortune]);

  useEffect(() => {
    const checkFortuneAvailability = () => {
      if (lastFortuneDate) {
        const lastDate = new Date(lastFortuneDate);
        const today = new Date();
        
        // 날짜만 비교 (시간 제외)
        if (lastDate.toDateString() !== today.toDateString()) {
          setCanViewFortune(true);
        } else {
          setCanViewFortune(false);
        }
      } else {
        setCanViewFortune(true);
      }
    };

    checkFortuneAvailability();
  }, [lastFortuneDate]);

  useEffect(() => {
    const storedLastFortuneDate = localStorage.getItem('lastFortuneDate');
    if (storedLastFortuneDate) {
      setLastFortuneDate(storedLastFortuneDate);
    }
  }, []);

  const handleFortuneRefresh = async () => {
    if (!canViewFortune) {
      alert('오늘은 이미 운세를 확인하셨습니다. 내일 다시 시도해주세요.');
      return;
    }

    setCanViewFortune(false); // 버튼을 비활성화하여 연타 방지

    try {
      const response = await axios.post('/fortunelogs/use', { groupNumber });
      if (response.data && response.data.content) {
        setFortune(response.data.content);
        setLuckyScore(response.data.luckyScore);
        setAccumulatedScore(response.data.accumulatedScore);
        const now = new Date().toISOString();
        setLastFortuneDate(now);
        localStorage.setItem('lastFortuneDate', now);
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('운세 새로고침 중 오류:', error);
      alert('운세를 가져오는데 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setCanViewFortune(true); // 오류 발생 시 버튼을 다시 활성화
    }
  };

  useEffect(() => {
    const fetchFortuneAvailability = async () => {
      try {
        const response = await axios.get(`/fortunelogs/availability/${groupNumber}`);
        setCanViewFortune(response.data.canViewFortune);
      } catch (error) {
        console.error('운세 확인 가능 여부 조회 중 오류:', error);
      }
    };

    fetchFortuneAvailability();
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

  const fetchLastMonthSummary = useCallback(async () => {
    setIsLoadingLastMonth(true);
    try {
      const response = await axios.get(`/last-month-summary/${groupNumber}`);
      setLastMonthSummary(response.data);
      // 총 중량에 270을 곱하여 도급비용 계산
      if (response.data && response.data.totalWeight) {
        response.data.totalPayment = response.data.totalWeight * 270; // 도급비 합계 설정
      }
    } catch (error) {
      console.error('지난달 요약 데이터 조회 중 오류:', error);
      setLastMonthSummary(null);
    } finally {
      setIsLoadingLastMonth(false);
    }
  }, [groupNumber]);

  const openLastMonthModal = () => {
    setShowLastMonthModal(true);
    fetchLastMonthSummary();
  };

  const closeLastMonthModal = () => {
    setShowLastMonthModal(false);
  };

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

  const handleLuckyShopOpen = () => {
    setShowLuckyShop(true);
    fetchLuckyShopItems();
  };

  const handleLuckyShopClose = () => {
    setShowLuckyShop(false);
  };

  const fetchLuckyShopItems = async () => {
    try {
      const response = await axios.get('/lucky-shop-items');
      setLuckyShopItems(response.data);
    } catch (error) {
      console.error('상품 목록 조회 중 오류:', error);
    }
  };

  const handlePurchase = async (itemId) => {
    try {
      const response = await axios.post(`/lucky-shop-purchase/${itemId}`, { groupNumber });
      setAccumulatedScore(response.data.newScore);
      alert('구매가 완료되었습니다.');
      fetchLuckyShopItems(); // 구매 후 상품 목록 새로고침
    } catch (error) {
      alert(error.response?.data?.error || '구매 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    const checkOnline = () => {
      if (navigator.onLine) {
        console.log('온라인 상태입니다.');
      } else {
        console.log('오프라인 상태입니다.');
        alert('인터넷 연결을 확인해 주세요.');
      }
    };

    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);

    return () => {
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
    };
  }, []);

  useEffect(() => {
    // 예시: 마지막 운세 확인 날짜를 가져오는 API 호출
    const fetchLastFortuneDate = async () => {
      try {
        const response = await axios.get('/api/last-fortune-date');
        setLastFortuneDate(response.data.date);
      } catch (error) {
        console.error('마지막 운세 날짜 조회 실패:', error);
      }
    };

    fetchLastFortuneDate();
  }, []);

  const today = new Date();
  const cutoffDate = new Date(today.getFullYear(), today.getMonth(), 11); // 이번달 11일

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
        {today <= cutoffDate ? ( // 오늘이 11일 이하일 경우에만 총계 표시
          <>
            <div className="stat-card">
              <span className="stat-label">총 작업량</span>
              <span className="stat-value">{sumKg.toFixed(2)} Kg</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">총 도급비용</span>
              <span className="stat-value">{formatCurrency(totalPay)}</span>
            </div>
          </>
        ) : (
          <p>총계 데이터는 11일까지만 표시됩니다.</p> // 11일 이후 메시지
        )}
      </div>

      <div className="fortune-section">
        <div className="fortune-header">
          <h5>오늘도 화이팅!</h5>
          <div className="fortune-buttons">
            {accumulatedScore >= 100 && (
              <button onClick={handleLuckyShopOpen} className="lucky-shop-button">
                행운상점
              </button>
            )}
            {canViewFortune && (
              <button onClick={handleFortuneRefresh} className="fortune-button">
                오늘의 한마디
              </button>
            )}
          </div>
        </div>
        {fortune && (
          <div className="fortune-content">
            <div className="fortune-card">
              <div className="fortune-scores">
                <span className="score-item">행운 {luckyScore}</span>
                <span className="score-item">누적 {accumulatedScore}</span>
              </div>
              <p className="fortune-text">{fortune}</p>
            </div>
          </div>
        )}
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
            {isLoadingLastMonth ? (
              <p>데이터를 불러오는 중...</p>
            ) : lastMonthSummary ? (
              <>
                <p>총 중량: {lastMonthSummary.totalWeight.toFixed(2)} Kg</p>
                <p>총 도급비용: {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(lastMonthSummary.totalPayment)}</p> {/* 계산된 도급비용 사용 */}
              </>
            ) : (
              <p>지난달 데이터가 없습니다.</p>
            )}
            <button onClick={closeLastMonthModal}>닫기</button>
          </div>
        </div>
      )}

      {selectedNotice && (
        <div className="modal-overlay" onClick={closeNoticeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{selectedNotice.title}</h3>
            <p className="modal-content-text">{selectedNotice.content}</p>
            <small className="modal-date">{new Date(selectedNotice.dateTime).toLocaleString()}</small>
            <button className="modal-close-button" onClick={closeNoticeModal}>닫기</button>
          </div>
        </div>
      )}

      {showLuckyShop && (
        <div className="lucky-shop-modal">
          <div className="lucky-shop-content">
            <h2>행운 상점</h2>
            <p className="current-points">현재 보유 점수: <span>{accumulatedScore}</span></p>
            <div className="lucky-shop-items">
              {luckyShopItems.map((item) => (
                <div key={item._id} className="lucky-shop-item">
                  <h3>
                    {item.name.split('//').map((part, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <><br /></>}
                        {part}
                      </React.Fragment>
                    ))}
                  </h3>
                  <p className="item-points">{item.points} 포인트</p>
                  <button 
                    onClick={() => handlePurchase(item._id)}
                    disabled={accumulatedScore < item.points}
                    className={accumulatedScore < item.points ? 'disabled' : ''}
                  >
                    {accumulatedScore < item.points ? '포인트 부족' : '구매하기'}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={handleLuckyShopClose} className="close-button">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerPage;