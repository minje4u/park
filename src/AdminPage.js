import React, { useState, useEffect, useMemo, useCallback } from "react";
import WorkRegistration from "./WorkRegistration";
import EmployeeManagement from "./EmployeeManagement";
import "./AdminPage.css"; 
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL === 'production' 
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

const formatWorkData = (data) => {
  const formattedData = {};
  data.forEach(work => {
    if (work.weight > 0) {
      if (!formattedData[work.employeeName]) {
        formattedData[work.employeeName] = {
          작업자ID: work.employeeId,
          중량: {},
          작업시간: {}
        };
      }
      if (work.date) {
        const localDate = new Date(work.date);
        const day = localDate.getUTCDate(); // UTC 날짜 사용
        formattedData[work.employeeName].중량[day] = (formattedData[work.employeeName].중량[day] || 0) + work.weight;
        formattedData[work.employeeName].작업시간[day] = work.workHours;
      }
    }
  });
  console.log("formatWorkData 결과:", formattedData);
  return formattedData;
};

const getDatesWithData = (workStatistics) => {
  const allDates = new Set();
  Object.values(workStatistics).forEach((stats) => {
    Object.keys(stats.중량).forEach((day) => {
      if (stats.중량[day] > 0) {
        allDates.add(parseInt(day));
      }
    });
  });
  return [...allDates].sort((a, b) => a - b);
};

const AdminPage = ({ username }) => {
  const [activeTab, setActiveTab] = useState("작업등록");
  const [menuOpen, setMenuOpen] = useState(false);
  const [workStatistics, setWorkStatistics] = useState({});
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [datesWithData, setDatesWithData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchName, setSearchName] = useState("");

  const fetchWorkStatistics = useCallback(async () => {
    try {
      console.log("작업 통계 요청 시작");
      const response = await axios.get('/employee/work', {
        params: {
          year: selectedDate.getFullYear(),
          month: selectedDate.getMonth() + 1
        }
      });
      console.log("서버 응답 데이터:", response.data);
      const formattedData = formatWorkData(response.data);
      console.log("포맷된 데이터:", formattedData);
      setWorkStatistics(formattedData);
    } catch (error) {
      console.error("작업량 통계를 가져오는 중 오류 발생:", error.response ? error.response.data : error.message);
    }
  }, [selectedDate]);

  const fetchNotices = useCallback(async () => {
    try {
      const response = await axios.get('/notices');
      setNotices(response.data);
    } catch (error) {
      console.error('공지사항 조회 중 오류:', error.response ? error.response.data : error.message);
    }
  }, []);

  useEffect(() => {
    console.log("컴포넌트 마운트 또는 selectedDate 변경");
    fetchWorkStatistics();
    fetchNotices();
  }, [selectedDate, fetchWorkStatistics, fetchNotices]);

  useEffect(() => {
    const dates = getDatesWithData(workStatistics);
    console.log("날짜 데이터:", dates);
    setDatesWithData(dates);
  }, [workStatistics]);

  const handleDeleteDay = useCallback(async (day) => {
    if (window.confirm(`${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${day}일 데이터를 삭제하시겠습니까?`) &&
        window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      try {
        const dateToDelete = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        const formattedDate = dateToDelete.toISOString().split('T')[0];
        
        console.log('삭제 요청 URL:', `${API_URL}/employee/work/${formattedDate}`);
        const response = await axios.delete(`${API_URL}/employee/work/${formattedDate}`);
        console.log('서버 응답:', response.data);
        
        if (response.data.message) {
          // 로컬 상태 업데이트
          setWorkStatistics(prevStats => {
            const updatedStats = { ...prevStats };
            Object.keys(updatedStats).forEach(employeeName => {
              if (updatedStats[employeeName].중량[day]) {
                delete updatedStats[employeeName].중량[day];
                delete updatedStats[employeeName].작업시간[day];
              }
              if (Object.keys(updatedStats[employeeName].중량).length === 0) {
                delete updatedStats[employeeName];
              }
            });
            return updatedStats;
          });
          
          setDatesWithData(prevDates => prevDates.filter(d => d !== day));
          alert(`${day}일 데이터가 삭제되었습니다.`);
          // 데이터 삭제 후 통계 다시 불러오기
          fetchWorkStatistics();
        } else {
          alert('데이터 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('데이터 삭제 중 오류 발생:', error);
        alert('데이터 삭제 중 오류가 발생했습니다.');
      }
    }
  }, [selectedDate, fetchWorkStatistics]);

  const handleNoticeSubmit = useCallback(async (e) => {
    e.preventDefault();
    console.log('공지사항 등록 시도:', { title: noticeTitle, content: noticeContent }); // 로그 추가
    try {
      const response = await axios.post('/notices', {
        title: noticeTitle,
        content: noticeContent
      });
      console.log('공지사항 등록 성공:', response.data); // 로그 추가
      alert('공지사항이 등록되었습니다.');
      setNoticeTitle('');
      setNoticeContent('');
      fetchNotices(); // 공지사항 목록 새로고침
    } catch (error) {
      console.error('공지사항 등록 중 오류:', error.response ? error.response.data : error.message); // 로그 추가
      alert('공지사항 등록에 실패했습니다.');
    }
  }, [noticeTitle, noticeContent, fetchNotices]);

  const handleDeleteNotice = useCallback(async (id) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        await axios.delete(`/notices/${id}`);
        alert("공지사항이 삭제되었습니다.");
        fetchNotices(); // 공지사항 목록 새로고침
      } catch (error) {
        console.error('공지사항 삭제 중 오류:', error.response ? error.response.data : error.message);
        alert('공지사항 삭제에 실패했습니다.');
      }
    }
  }, [fetchNotices]);

  const handleEditNotice = useCallback((notice) => {
    setNoticeTitle(notice.title);
    setNoticeContent(notice.content);
    setEditingNoticeId(notice._id);
  }, []);

  const handleUpdateNotice = useCallback(async () => {
    try {
      await axios.put(`/notices/${editingNoticeId}`, {
        title: noticeTitle,
        content: noticeContent
      });
      alert("공지사항이 수정되었습니다.");
      setNoticeTitle('');
      setNoticeContent('');
      setEditingNoticeId(null);
      fetchNotices(); // 공지사항 목록 새로고침
    } catch (error) {
      console.error('공지사항 수정 중 오류:', error.response ? error.response.data : error.message);
      alert('공지사항 수정에 실패했습니다.');
    }
  }, [editingNoticeId, noticeTitle, noticeContent, fetchNotices]);

  const resetDatabase = useCallback(async () => {
    if (window.confirm("정말로 데이터베이스를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      try {
        const response = await axios.post(`${API_URL}/reset-database`);
        console.log(response.data.message);
        alert('데이터베이스가 초기화되었습니다. 페이지를 새로고침합니다.');
        window.location.reload();
      } catch (error) {
        console.error('데이터베이스 초기화 중 오류 발생:', error);
        alert('데이터베이스 초기화에 실패했습니다.');
      }
    }
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!searchName.trim()) return Object.keys(workStatistics);
    return Object.keys(workStatistics).filter(name => 
      name.toLowerCase().includes(searchName.toLowerCase())
    );
  }, [workStatistics, searchName]);

  const handleWorkRegistration = useCallback(async (date, workData) => {
    try {
      const response = await axios.post('/employee/work/bulk', { date, workData });
      console.log('작업 일괄 저장 응답:', response.data);
      alert("작업이 성공적으로 저장되었습니다.");
      fetchWorkStatistics();
    } catch (error) {
      console.error('작업 데이터 일괄 저장 중 오류 발생:', error.response ? error.response.data : error.message);
      alert("작업 저장에 실패했습니다.");
    }
  }, [fetchWorkStatistics]);

  const handleDateChange = (event) => {
    setSelectedDate(new Date(event.target.value));
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{username} 관리자님, 환영합니다!</h1>
        <div className="menu-icon" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="material-icons">menu</span>
        </div>
      </div>

      <div className={`admin-tabs ${menuOpen ? 'open' : ''}`}>
        <button
          className={`admin-tab-button ${activeTab === "작업등록" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업등록");
            setMenuOpen(false);
          }}
        >
          작업등록
        </button>
        <button
          className={`admin-tab-button ${activeTab === "작업량통계" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업량통계");
            setMenuOpen(false);
          }}
        >
          작업량통계
        </button>
        <button
          className={`admin-tab-button ${activeTab === "작업자관리" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업자관리");
            setMenuOpen(false);
          }}
        >
          작업자관리
        </button>
        <button
          className={`admin-tab-button ${activeTab === "공지사항" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("공지사항");
            setMenuOpen(false);
          }}
        >
          공지사항
        </button>
        <button
          className="reset-button"
          onClick={() => {
            resetDatabase();
            setMenuOpen(false);
          }}
        >
          데이터베이스 초기화
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "작업등록" && (
          <WorkRegistration onConfirm={handleWorkRegistration} />
        )}
        {activeTab === "작업량통계" && (
          <div>
            <h2 className="admin-section-title">작업량 통계</h2>
            <div className="date-picker">
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={handleDateChange}
              />
            </div>
            <div className="search-container">
              <input
                type="text"
                placeholder="이름으로 검색"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="search-input"
              />
            </div>
            {Object.keys(workStatistics).length === 0 ? (
              <p>데이터가 없습니다.</p>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="fixed-column">ID</th>
                      <th className="fixed-column">이름</th>
                      {datesWithData.map((day) => (
                        <th key={day} className="date-column">
                          {day}
                          <span 
                            className="delete-day" 
                            onClick={() => handleDeleteDay(day)}
                          >
                            ❌
                          </span>
                        </th>
                      ))}
                      <th>합계</th>
                      <th>도급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((name) => {
                      const stats = workStatistics[name];
                      const sum = Object.values(stats.중량 || {}).reduce((acc, val) => acc + (val || 0), 0);
                      const pay = Math.floor(sum * 270);
                      return (
                        <tr key={name}>
                          <td className="fixed-column">{stats.작업자ID}</td>
                          <td className="fixed-column">{name}</td>
                          {datesWithData.map((day) => (
                            <td key={day} className="data-cell">
                              <div className="weight">{stats.중량 && stats.중량[day] ? stats.중량[day].toFixed(1) : "-"}</div>
                              <div className="work-hours">{stats.작업시간 && stats.작업시간[day] ? stats.작업시간[day] : "-"}</div>
                            </td>
                          ))}
                          <td className="sum-cell">{sum.toFixed(1)}</td>
                          <td className="pay-cell">{new Intl.NumberFormat('ko-KR').format(pay)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {activeTab === "작업자관리" && <EmployeeManagement />}
        {activeTab === "공지사항" && (
          <div className="notice-section">
            <h2 className="section-title">공지사항 게시판</h2>

            <div className="notice-form">
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="공지 제목"
                className="notice-input"
              />
              <textarea
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                placeholder="공지 내용을 입력하세요"
                className="notice-textarea"
              />
              <button 
                onClick={editingNoticeId ? handleUpdateNotice : handleNoticeSubmit} 
                className="notice-button"
              >
                {editingNoticeId ? "공지 수정" : "공지 등록"}
              </button>
            </div>

            <div className="notice-list">
              {notices.length === 0 ? (
                <p className="no-notice">등록된 공지사항이 없습니다.</p>
              ) : (
                notices.map((notice) => (
                  <div key={notice._id} className="notice-item">
                    <small className="notice-date">{new Date(notice.dateTime).toLocaleString()}</small>
                    <h3 className="notice-title">{notice.title}</h3>
                    <p className="notice-content">{notice.content}</p>
                    <div className="notice-actions">
                      <button
                        onClick={() => handleEditNotice(notice)}
                        className="notice-icon-button"
                        title="수정"
                      >
                        <span className="material-icons">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteNotice(notice._id)}
                        className="notice-icon-button"
                        title="삭제"
                      >
                        <span className="material-icons">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
