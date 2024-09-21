import React, { useState, useEffect, useCallback } from "react";
import WorkRegistration from "./WorkRegistration";
import EmployeeManagement from "./EmployeeManagement";
import WorkStatistics from "./WorkStatistics";
import "./AdminPage.css"; 
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

const AdminPage = ({ username }) => {
  const [activeTab, setActiveTab] = useState("작업등록");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState(null);

  const fetchNotices = useCallback(async () => {
    try {
      const response = await axios.get('/notices');
      setNotices(response.data);
    } catch (error) {
      console.error('공지사항 조회 중 오류:', error.response ? error.response.data : error.message);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleNoticeSubmit = useCallback(async (e) => {
    e.preventDefault();
    console.log('공지사항 등록 시도:', { title: noticeTitle, content: noticeContent });
    try {
      const response = await axios.post('/notices', {
        title: noticeTitle,
        content: noticeContent
      });
      console.log('공지사항 등록 성공:', response.data);
      alert('공지사항이 등록되었습니다.');
      setNoticeTitle('');
      setNoticeContent('');
      fetchNotices();
    } catch (error) {
      console.error('공지사항 등록 중 오류:', error.response ? error.response.data : error.message);
      alert('공지사항 등록에 실패했습니다.');
    }
  }, [noticeTitle, noticeContent, fetchNotices]);

  const handleDeleteNotice = useCallback(async (id) => {
    if (window.confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      try {
        const response = await axios.delete(`/notices/${id}`);
        console.log('공지사항 삭제 성공:', response.data);
        alert("공지사항이 삭제되었습니다.");
        fetchNotices();
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
      const response = await axios.put(`/notices/${editingNoticeId}`, {
        title: noticeTitle,
        content: noticeContent
      });
      console.log('공지사항 수정 성공:', response.data);
      alert("공지사항이 수정되었습니다.");
      setNoticeTitle('');
      setNoticeContent('');
      setEditingNoticeId(null);
      fetchNotices();
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
        console.error('데이터베이스 초기화 중 오류:', error);
        alert('데이터베이스 초기화에 실패했습니다.');
      }
    }
  }, []);

  const handleWorkRegistration = useCallback(async (date, workData) => {
    try {
      const response = await axios.post('/employee/work', { date, workData });
      console.log('작업 등록 성공:', response.data);
      alert('작업이 성공적으로 등록되었습니다.');
    } catch (error) {
      console.error('작업 등록 중 오류:', error.response ? error.response.data : error.message);
      alert('작업 등록에 실패했습니다.');
    }
  }, []);

  const toggleMenu = () => {
    setMenuOpen(prevState => !prevState);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>{username} 관리자님, 환영합니다!</h1>
        <div className="menu-icon" onClick={toggleMenu}>
          <span className="material-icons">
            {menuOpen ? 'close' : 'menu'}
          </span>
        </div>
      </div>

      <div className={`admin-tabs ${menuOpen ? 'open' : ''}`}>
        <button
          className={`admin-tab-button ${activeTab === "작업등록" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업등록");
            closeMenu();
          }}
        >
          작업등록
        </button>
        <button
          className={`admin-tab-button ${activeTab === "작업량통계" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업량통계");
            closeMenu();
          }}
        >
          작업량통계
        </button>
        <button
          className={`admin-tab-button ${activeTab === "작업자관리" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("작업자관리");
            closeMenu();
          }}
        >
          작업자관리
        </button>
        <button
          className={`admin-tab-button ${activeTab === "공지사항" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("공지사항");
            closeMenu();
          }}
        >
          공지사항
        </button>
        <button
          className="reset-button"
          onClick={() => {
            resetDatabase();
            closeMenu();
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
          <WorkStatistics />
        )}
        {activeTab === "작업자관리" && (
          <EmployeeManagement />
        )}
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