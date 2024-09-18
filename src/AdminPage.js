import React, { useState, useEffect, useMemo } from "react";
import WorkRegistration from "./WorkRegistration";
import EmployeeManagement from "./EmployeeManagement";
import "./AdminPage.css"; 
import axios from 'axios';

axios.defaults.baseURL = '/.netlify/functions/api';
axios.defaults.withCredentials = true;

const formatWorkData = (data) => {
  const formattedData = {};
  data.forEach(work => {
    if (work.weight > 0) {  // 중량이 0보다 큰 경우만 처리
      if (!formattedData[work.employeeName]) {
        formattedData[work.employeeName] = {
          작업자ID: work.employeeId,
          중량: {},
          작업시간: {}
        };
      }
      if (work.date) {
        const day = new Date(work.date).getDate();
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

  const fetchWorkStatistics = async () => {
    try {
      const response = await axios.get('/api/employee/work', {
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
      console.error("작업량 통계를 가져오는 중 오류 발생:", error);
    }
  };

  useEffect(() => {
    fetchWorkStatistics();
  }, [selectedDate]);

  useEffect(() => {
    const dates = getDatesWithData(workStatistics);
    console.log("날짜 데이터:", dates);
    setDatesWithData(dates);
  }, [workStatistics]);

  const handleConfirm = async (date, data) => {
    try {
      await axios.post('/api/employee/work', { date, workData: data });
      await fetchWorkStatistics();
      alert("작업이 등록되었습니다.");
    } catch (error) {
      console.error("작업 데이터 저장 중 오류 발생:", error);
      alert("작업 등록 중 오류가 발생했습니다.");
    }
  };

  const calculateSumAndPay = useMemo(() => (weights) => {
    const sum = Object.values(weights).reduce((acc, val) => acc + (val || 0), 0);
    const pay = Math.floor(sum * 270);
    return {
      sum,
      pay: new Intl.NumberFormat('ko-KR').format(pay) + "원",
    };
  }, []);

  const handleDeleteDay = async (day) => {
    if (window.confirm(`${day}일 데이터를 삭제하시겠습니까?`) &&
        window.confirm("정말로 삭제하시겠습니까?")) {
      try {
        const dateToDelete = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        const response = await axios.delete(`/api/employee/work/${dateToDelete.toISOString()}`);
        console.log(response.data.message);
        
        // 로컬 상태 업데이트
        const updatedStatistics = { ...workStatistics };
        Object.entries(updatedStatistics).forEach(([employeeName, stats]) => {
          if (stats.중량[day]) {
            delete stats.중량[day];
            delete stats.작업시간[day];
          }
          
          // 작업자의 모든 날짜 데이터가 없으면 해당 작업자 제거
          if (Object.keys(stats.중량).length === 0) {
            delete updatedStatistics[employeeName];
          }
        });
        setWorkStatistics(updatedStatistics);
        
        // 날짜 목록 업데이트
        const remainingDates = Object.values(updatedStatistics).flatMap(stats => Object.keys(stats.중량));
        const uniqueRemainingDates = [...new Set(remainingDates)].map(Number).sort((a, b) => a - b);
        setDatesWithData(uniqueRemainingDates);

        alert(`${day}일 데이터가 삭제되었습니다.`);
      } catch (error) {
        console.error('데이터 삭제 중 오류 발생:', error);
        alert('데이터 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleNoticeSubmit = async (e) => {
    e.preventDefault();
    console.log('공지사항 등록 시도:', { title: noticeTitle, content: noticeContent }); // 로그 추가
    try {
      const response = await axios.post('/api/notices', {
        title: noticeTitle,
        content: noticeContent
      });
      console.log('공지사항 등록 성공:', response.data); // 로그 추가
      alert('공지사항이 등록되었습니다.');
      setNoticeTitle('');
      setNoticeContent('');
      fetchNotices(); // 공지사항 목록 새로고침
    } catch (error) {
      console.error('공지사항 등록 중 오류:', error); // 로그 추가
      alert('공지사항 등록에 실패했습니다.');
    }
  };

  const handleDeleteNotice = async (id) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        await axios.delete(`/api/notices/${id}`);
        alert("공지사항이 삭제되었습니다.");
        fetchNotices(); // 공지사항 목록 새로고침
      } catch (error) {
        console.error('공지사항 삭제 중 오류:', error);
        alert('공지사항 삭제에 실패했습니다.');
      }
    }
  };

  const handleEditNotice = (notice) => {
    setNoticeTitle(notice.title);
    setNoticeContent(notice.content);
    setEditingNoticeId(notice._id);
  };

  const handleUpdateNotice = async () => {
    try {
      await axios.put(`/api/notices/${editingNoticeId}`, {
        title: noticeTitle,
        content: noticeContent
      });
      alert("공지사항이 수정되었습니다.");
      setNoticeTitle('');
      setNoticeContent('');
      setEditingNoticeId(null);
      fetchNotices(); // 공지사항 목록 새로고침
    } catch (error) {
      console.error('공지사항 수정 중 오류:', error);
      alert('공지사항 수정에 실패했습니다.');
    }
  };

  const fetchNotices = async () => {
    try {
      const response = await axios.get('/api/notices');
      setNotices(response.data);
    } catch (error) {
      console.error('공지사항 조회 중 오류:', error);
    }
  };

  useEffect(() => {
    fetchWorkStatistics();
    fetchNotices(); // 공지사항 가져오기
  }, [selectedDate]);

  const handleResetDatabase = async () => {
    if (window.confirm("데이터베이스의 모든 데이터를 초기화하시겠습니까?")) {
      try {
        const response = await axios.delete('/api/reset-database');
        console.log("서버 응답:", response.data);
        await fetchWorkStatistics(); // 데이터베이스 초기화 후 통계 다시 가져오기
        alert(response.data.message || "데이터베이스가 초기화되었습니다.");
      } catch (error) {
        console.error("데이터베이스 초기화 중 오류 발생:", error);
        if (error.response) {
          console.error("서버 응답:", error.response.data);
          console.error("응답 상태:", error.response.status);
          alert(`데이터베이스 초기화 중 오류가 발생했습니다: ${error.response.data.error || error.response.statusText}`);
        } else if (error.request) {
          console.error("서버로부터 응답이 없습니다.");
          alert("서버와의 통신 중 오류가 발생했습니다.");
        } else {
          console.error("요청 설정 중 오류:", error.message);
          alert(`요청 중 오류가 발생했습니다: ${error.message}`);
        }
      }
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!searchName.trim()) return Object.keys(workStatistics);
    return Object.keys(workStatistics).filter(name => 
      name.toLowerCase().includes(searchName.toLowerCase())
    );
  }, [workStatistics, searchName]);

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
            handleResetDatabase();
            setMenuOpen(false);
          }}
        >
          데이터베이스 초기화
        </button>
      </div>

      <div className="admin-content">
        {activeTab === "작업등록" && <WorkRegistration onConfirm={handleConfirm} />}
        {activeTab === "작업량통계" && (
          <div>
            <h2 className="admin-section-title">작업량 통계</h2>
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
                          <button onClick={() => handleDeleteDay(day)} className="delete-button">X</button>
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
