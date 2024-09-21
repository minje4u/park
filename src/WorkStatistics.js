import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from 'axios';
import "./WorkStatistics.css";  // 이 줄을 추가합니다.

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

// axios 기본 URL 설정
axios.defaults.baseURL = API_URL;

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
      const day = new Date(work.date).getUTCDate();
      formattedData[work.employeeName].중량[day] = (formattedData[work.employeeName].중량[day] || 0) + work.weight;
      formattedData[work.employeeName].작업시간[day] = work.workHours;
    }
  });
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

const WorkStatistics = () => {
  const [workStatistics, setWorkStatistics] = useState({});
  const [datesWithData, setDatesWithData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchName, setSearchName] = useState("");
  const tableRef = useRef(null);

  const fetchWorkStatistics = useCallback(async () => {
    try {
      console.log("작업 통계 요청 시작");
      const response = await axios.get('/employee/work', {
        params: {
          year: selectedMonth.getFullYear(),
          month: selectedMonth.getMonth() + 1,
          employeeName: '' // 모든 직원의 데이터를 가져오기 위해 빈 문자열 사용
        }
      });
      console.log("서버 응답 데이터:", response.data);
      const formattedData = formatWorkData(response.data);
      console.log("포맷된 데이터:", formattedData);
      setWorkStatistics(formattedData);
    } catch (error) {
      console.error("작업량 통계를 가져오는 중 오류 발생:", error.response ? error.response.data : error.message);
    }
  }, [selectedMonth]);

  useEffect(() => {
    console.log("컴포넌트 마운트 또는 selectedMonth 변경");
    fetchWorkStatistics();
  }, [selectedMonth, fetchWorkStatistics]);

  useEffect(() => {
    const dates = getDatesWithData(workStatistics);
    console.log("날짜 데이터:", dates);
    setDatesWithData(dates);
  }, [workStatistics]);

  const handleDeleteDay = useCallback(async (day) => {
    if (window.confirm(`${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth() + 1}월 ${day}일 데이터를 삭제하시겠습니까?`) &&
        window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      try {
        const dateToDelete = new Date(Date.UTC(selectedMonth.getFullYear(), selectedMonth.getMonth(), day));
        const formattedDate = dateToDelete.toISOString().split('T')[0];
        
        console.log('삭제 요청 URL:', `/employee/work/${formattedDate}`);
        const response = await axios.delete(`/employee/work/${formattedDate}`);
        console.log('서버 응답:', response.data);
        
        if (response.data.message) {
          // 삭제 성공 시 로직
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
          alert(response.data.message);
          fetchWorkStatistics();
        } else {
          alert('데이터 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('데이터 삭제 중 오류 발생:', error);
        alert('데이터 삭제 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message));
      }
    }
  }, [selectedMonth, fetchWorkStatistics]);

  const handleMonthChange = (event) => {
    const [year, month] = event.target.value.split('-');
    setSelectedMonth(new Date(year, month - 1));
  };

  const filteredEmployees = useMemo(() => {
    if (!searchName.trim()) return Object.keys(workStatistics);
    return Object.keys(workStatistics).filter(name => 
      name.toLowerCase().includes(searchName.toLowerCase())
    );
  }, [workStatistics, searchName]);

  useEffect(() => {
    const adjustFixedColumns = () => {
      const table = tableRef.current;
      if (table) {
        const firstColumn = table.querySelector('th:first-child');
        const secondColumn = table.querySelector('th:nth-child(2)');
        if (firstColumn && secondColumn) {
          const firstColumnWidth = Math.max(firstColumn.offsetWidth, 60);
          const secondColumnWidth = Math.max(secondColumn.offsetWidth, 120);
          
          document.documentElement.style.setProperty('--first-column-width', `${firstColumnWidth}px`);
          document.documentElement.style.setProperty('--second-column-width', `${secondColumnWidth}px`);
          
          // 모든 고정 열에 너비 적용
          table.querySelectorAll('.fixed-column:nth-child(1)').forEach(el => {
            el.style.width = `${firstColumnWidth}px`;
          });
          table.querySelectorAll('.fixed-column:nth-child(2)').forEach(el => {
            el.style.width = `${secondColumnWidth}px`;
          });
        }
      }
    };

    adjustFixedColumns();
    window.addEventListener('resize', adjustFixedColumns);

    return () => {
      window.removeEventListener('resize', adjustFixedColumns);
    };
  }, [workStatistics]);

  return (
    <div className="work-statistics">
      <h2 className="section-title">작업량 통계</h2>
      <div className="controls-container">
        <div className="date-picker-container">
          <input
            type="month"
            value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
            onChange={handleMonthChange}
            className="month-picker"
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
      </div>
      {Object.keys(workStatistics).length === 0 ? (
        <p>데이터가 없습니다.</p>
      ) : (
        <div className="table-container">
          <table className="admin-table" ref={tableRef}>
            <thead>
              <tr>
                <th className="id-column">ID</th>
                <th className="name-column">이름</th>
                {datesWithData.map((day) => (
                  <th key={day} className="date-column">
                    {day}일
                    <span 
                      className="delete-day" 
                      onClick={() => handleDeleteDay(day)}
                    >
                      ❌
                    </span>
                  </th>
                ))}
                <th className="sum-column">합계</th>
                <th className="pay-column">도급</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((name) => {
                const stats = workStatistics[name];
                const sum = Object.values(stats.중량 || {}).reduce((acc, val) => acc + (val || 0), 0);
                const pay = Math.floor(sum * 270);
                return (
                  <tr key={name}>
                    <td className="id-column">{stats.작업자ID}</td>
                    <td className="name-column">{name}</td>
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
  );
};

export default WorkStatistics;