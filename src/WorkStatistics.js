import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from 'axios';
import "./WorkStatistics.css";
import { exportToExcel } from './ExcelExport';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const ExportModal = ({ isOpen, onClose, onExport, availableYears }) => {
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || new Date().getFullYear());

  const handleExport = () => {
    onExport(selectedYear);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="엑셀 내보내기"
      className="export-modal"
      overlayClassName="export-modal-overlay"
    >
      <h2>엑셀 내보내기</h2>
      <div className="form-group">
        <label>년도 선택:</label>
        <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
      </div>
      <div className="modal-actions">
        <button onClick={handleExport}>저장</button>
        <button onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
};

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const formatWorkData = (data) => {
  const formattedData = {};
  data.forEach((work) => {
    if (work.weight > 0) {
      if (!formattedData[work.groupNumber]) {
        formattedData[work.groupNumber] = {
          employeeName: work.employeeName,
          employeeId: work.employeeId,
          중량: {},
          작업시간: {}
        };
      }
      const day = new Date(work.date).getUTCDate();
      if (!formattedData[work.groupNumber].중량[day]) {
        formattedData[work.groupNumber].중량[day] = work.weight;
        formattedData[work.groupNumber].작업시간[day] = work.workHours;
      } else {
        // 중복된 데이터가 있을 경우, 더 큰 값을 사용
        formattedData[work.groupNumber].중량[day] = Math.max(formattedData[work.groupNumber].중량[day], work.weight);
        formattedData[work.groupNumber].작업시간[day] = Math.max(formattedData[work.groupNumber].작업시간[day], work.workHours);
      }
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

const getAvailableYears = (years) => {
  if (!Array.isArray(years)) {
    console.error('Invalid years data:', years);
    return [];
  }
  return years.map(year => parseInt(year))
              .filter(year => !isNaN(year))
              .sort((a, b) => b - a);
};

const WorkStatistics = () => {
  const [employees, setEmployees] = useState([]); // employees 상태 추가
  const [editingName, setEditingName] = useState(null);
  const [workStatistics, setWorkStatistics] = useState({});
  const tableRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [datesWithData, setDatesWithData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'groupNumber', direction: 'ascending' });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setStartY(e.pageY - tableContainerRef.current.offsetTop);
    setScrollLeft(tableContainerRef.current.scrollLeft);
    setScrollTop(tableContainerRef.current.scrollTop);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const y = e.pageY - tableContainerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeft - walkX;
    tableContainerRef.current.scrollTop = scrollTop - walkY;
  };

  const fetchWorkStatistics = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("작업 통계 요청 시작");
      const response = await axios.get('/employee/work', {
        params: {
          year: selectedMonth.getFullYear(),
          month: selectedMonth.getMonth() + 1,
          groupNumber: '' // 빈 문자열로 설정하여 모든 작업자의 데이터를 져옵니다.
        }
      });
      console.log("서버 응답 데이터:", response.data);
      const formattedData = formatWorkData(response.data);
      console.log("포맷된 데이터:", formattedData);
      setWorkStatistics(formattedData);
    } catch (error) {
      console.error("작업량 통계를 가져오는 중 오류 발생:", error.response ? error.response.data : error.message);
    } finally {
      setIsLoading(false);
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
        window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없니다.")) {
      try {
        const dateToDelete = new Date(Date.UTC(selectedMonth.getFullYear(), selectedMonth.getMonth(), day));
        const formattedDate = dateToDelete.toISOString().split('T')[0];
        
        console.log('삭제 요청 URL:', `/employee/work/${formattedDate}`);
        const response = await axios.delete(`/employee/work/${formattedDate}`);
        console.log('서버 응답:', response.data);
        
        if (response.data.message) {
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
          alert('데이터가 성공적으로 삭제되었습니다.');
        } else {
          alert('데이터 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('데이터 삭제 중 오류 발생:', error);
        alert('데이터 삭 중 오류가 발생했습니다.');
      }
    }
  }, [selectedMonth]);

  const handleMonthChange = (event) => {
    const [year, month] = event.target.value.split('-');
    setSelectedMonth(new Date(year, month - 1));
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const todayStats = useMemo(() => {
    const today = new Date().getUTCDate();
    let totalWeight = 0;
    let totalPay = 0;

    Object.values(workStatistics).forEach(employee => {
      totalWeight += employee.중량[today] || 0;
      totalPay += (employee.중량[today] || 0) * 270;
    });

    return { totalWeight, totalPay };
  }, [workStatistics]);

  const monthStats = useMemo(() => {
    let totalWeight = 0;
    let totalPay = 0;

    Object.values(workStatistics).forEach(employee => {
      Object.values(employee.중량).forEach(weight => {
        totalWeight += weight;
        totalPay += weight * 270;
      });
    });

    return { totalWeight, totalPay };
  }, [workStatistics]);

  const sortedAndFilteredEmployees = useMemo(() => {
    return Object.entries(workStatistics).map(([groupNumber, data]) => ({
      groupNumber,
      name: employees.find(emp => emp.groupNumber === groupNumber)?.name || data.employeeName,
      ...data,
      sum: Object.values(data.중량 || {}).reduce((acc, val) => acc + (val || 0), 0),
      pay: Math.floor(Object.values(data.중량 || {}).reduce((acc, val) => acc + (val || 0), 0) * 270)
    })).filter(employee => 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      employee.groupNumber.toLowerCase().includes(searchTerm.toLowerCase()) // 조판번호로 검색 추가
    ).sort((a, b) => {
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'ascending' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      } else if (sortConfig.key === 'sum') {
        return sortConfig.direction === 'ascending' 
          ? a.sum - b.sum 
          : b.sum - a.sum;
      } else if (sortConfig.key === 'pay') {
        return sortConfig.direction === 'ascending' 
          ? a.pay - b.pay 
          : b.pay - a.pay;
      } else if (sortConfig.key === 'groupNumber') {
        return sortConfig.direction === 'ascending' 
          ? a.groupNumber.localeCompare(b.groupNumber) 
          : b.groupNumber.localeCompare(a.groupNumber);
      }
      return 0; // 기본값
    });
  }, [workStatistics, employees, searchTerm, sortConfig]);

  useEffect(() => {
    const adjustFixedColumns = () => {
      const table = tableRef.current;
      if (table) {
        const firstColumn = table.querySelector('th:first-child');
        const secondColumn = table.querySelector('th:nth-child(2)');
        if (firstColumn && secondColumn) {
          const firstColumnWidth = firstColumn.offsetWidth;
          const secondColumnWidth = secondColumn.offsetWidth;
          
          document.documentElement.style.setProperty('--first-column-width', `${firstColumnWidth}px`);
          document.documentElement.style.setProperty('--second-column-width', `${secondColumnWidth}px`);
          
          table.style.setProperty('--first-column-width', `${firstColumnWidth}px`);
          table.style.setProperty('--second-column-width', `${secondColumnWidth}px`);
        }
      }
    };

    adjustFixedColumns();
    window.addEventListener('resize', adjustFixedColumns);

    return () => {
      window.removeEventListener('resize', adjustFixedColumns);
    };
  }, [workStatistics]);

  const handleNameEdit = (groupNumber, newName) => {
    // 이름 수정 로직
    const updatedEmployees = employees.map(emp => 
      emp.groupNumber === groupNumber ? { ...emp, name: newName } : emp
    );
    setEmployees(updatedEmployees);
  };

  const handleNameSave = async (groupNumber) => {
    try {
      const employee = employees.find(emp => emp.groupNumber === groupNumber);
      const response = await axios.put(`/employee/name/${groupNumber}`, { newName: employee.name });
      if (response.data.success) {
        // 이름 수정 후 employees 상태 업데이트
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.groupNumber === groupNumber ? { ...emp, name: employee.name } : emp
          )
        );
        setEditingName(null);
      } else {
        // 실패 처리
      }
    } catch (error) {
      console.error('이름 저장 중 오류 발생:', error);
    }
  };

  const handleNameInputKeyPress = async (event, groupNumber) => {
    if (event.key === 'Enter') {
      const success = await handleNameSave(groupNumber);
      if (success) {
        alert('이름이 성공적으로 수정되었습니다.');
      }
    }
  };

  const handleNameDoubleClick = (groupNumber) => {
    setEditingName(groupNumber);
  };

  useEffect(() => {
    const adjustColumnWidths = () => {
      const dateColumns = document.querySelectorAll('.admin-table .date-column');
      dateColumns.forEach(column => {
        column.style.width = '50px';
        column.style.minWidth = '50px';
        column.style.maxWidth = '50px';
      });
    };

    adjustColumnWidths();
    window.addEventListener('resize', adjustColumnWidths);

    return () => {
      window.removeEventListener('resize', adjustColumnWidths);
    };
  }, [workStatistics]);

  const handleExportModalOpen = () => setIsExportModalOpen(true);
  const handleExportModalClose = () => setIsExportModalOpen(false);

  const handleExport = async (selectedYear) => {
    try {
      console.log('Requesting data for year:', selectedYear);
      const response = await axios.get('/employee/work/all', {
        params: { year: selectedYear }
      });
      const allData = response.data;
      console.log('All data received:', JSON.stringify(allData, null, 2));
      
      // 데이터 유효성 검사 및 처리
      if (!allData || typeof allData !== 'object') {
        throw new Error('서버에서 유효하지 않은 데이터 형식을 받았습니다.');
      }
      
      const processedData = {};
      let hasData = false;
      
      for (const [yearMonth, monthData] of Object.entries(allData)) {
        if (Array.isArray(monthData) && monthData.length > 0) {
          processedData[yearMonth] = monthData;
          hasData = true;
        }
      }
      
      if (!hasData) {
        throw new Error('선택한 연도의 데이터가 없습니다.');
      }
      
      // 여기서 datesWithData를 생성합니다. 전체 연도의 데이터를 기반으로 합니다.
      const allDatesWithData = new Set();
      Object.values(processedData).forEach(monthData => {
        monthData.forEach(work => {
          const day = new Date(work.date).getUTCDate();
          allDatesWithData.add(day);
        });
      });
      const sortedDatesWithData = Array.from(allDatesWithData).sort((a, b) => a - b);
      
      await exportToExcel(processedData, new Date(selectedYear, 0, 1), sortedDatesWithData, `${selectedYear}년_데이터`);
      alert('엑셀 파일이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('엑셀 파일 저장 중 오류 발생:', error);
      alert(`엑셀 파일 저장에 실패했습니다: ${error.message}`);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const response = await axios.get('/employee/work/years');
        const years = response.data;
        console.log('Available years from server:', years);
        const processedYears = getAvailableYears(years);
        console.log('Processed available years:', processedYears);
        setAvailableYears(processedYears);
      } catch (error) {
        console.error('연도 데이터를 가져오는 중 오류 발생:', error);
        setAvailableYears([]);
      }
    };
  
    fetchAllData();
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await axios.get('/employees'); // 직원 데이터 가져오기
      setEmployees(response.data);
    } catch (error) {
      console.error('직원 정보를 가져오는 데 실패했습니다:', error);
    }
  }, []);

  useEffect(() => {
    fetchEmployees(); // 컴포넌트 마운트 시 직원 ��이터 가져오기
  }, [fetchEmployees]);

  return (
    <div className="work-statistics">
      <h2 className="section-title">작업량 통계</h2>
      <div className="stats-summary">
        <div className="stats-card today">
          <h3>오늘 총계</h3>
          <div className="stats-content">
            <div className="stats-item">
              <span className="stats-label">총 중량</span>
              <span className="stats-value">{Math.round(todayStats.totalWeight)} kg</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">총 도급비용</span>
              <span className="stats-value">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(todayStats.totalPay)}</span>
            </div>
          </div>
        </div>
        <div className="stats-card month">
          <h3>이번달 총계</h3>
          <div className="stats-content">
            <div className="stats-item">
              <span className="stats-label">총 중량</span>
              <span className="stats-value">{Math.round(monthStats.totalWeight)} kg</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">총 도급비용</span>
              <span className="stats-value">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthStats.totalPay)}</span>
            </div>
          </div>
        </div>
      </div>
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
            placeholder="이름 또는 조판번호로 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button onClick={handleExportModalOpen} className="export-button">엑셀로 저장</button>
      </div>
      {isLoading ? (
        <div className="loading">데이터를 불러오는 중...</div>
      ) : Object.keys(workStatistics).length === 0 ? (
        <p>데이터가 없습니다.</p>
      ) : (
        <div className="table-container" ref={tableContainerRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
          <table className="admin-table" ref={tableRef}>
            <thead>
              <tr>
                <th 
                  className={`fixed-column id-column ${sortConfig.key === 'groupNumber' ? `sort-${sortConfig.direction}` : ''}`} 
                  onClick={() => handleSort('groupNumber')}
                >
                  조판
                </th>
                <th 
                  className={`fixed-column name-column ${sortConfig.key === 'name' ? `sort-${sortConfig.direction}` : ''}`} 
                  onClick={() => handleSort('name')}
                >
                  이름
                </th>
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
                <th className="sum-column" onClick={() => handleSort('sum')}>
                  중량합계 {sortConfig.key === 'sum' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th className="pay-column" onClick={() => handleSort('pay')}>
                  도급 {sortConfig.key === 'pay' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredEmployees.map((item, index) => (
                <tr key={item.groupNumber} className={index % 4 < 2 ? 'even-row' : 'odd-row'}>
                  <td className="fixed-column id-column">{item.groupNumber}</td>
                  <td className="fixed-column name-column">
                    {editingName === item.groupNumber ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleNameEdit(item.groupNumber, e.target.value)}
                        onKeyPress={(e) => handleNameInputKeyPress(e, item.groupNumber)}
                        onBlur={() => handleNameSave(item.groupNumber)}
                        autoFocus
                      />
                    ) : (
                      <span onDoubleClick={() => handleNameDoubleClick(item.groupNumber)}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  {datesWithData.map((day) => (
                    <td key={day} className="date-column data-cell">
                      <div className="weight">{item.중량 && item.중량[day] ? item.중량[day].toFixed(2) : "-"}</div>
                      <div className="work-hours">{item.작업시간 && item.작업시간[day] ? item.작업시간[day] : "-"}</div>
                    </td>
                  ))}
                  <td className="sum-cell">{item.sum.toFixed(2)} kg</td>
                  <td className="pay-cell">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(item.pay)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="fixed-column id-column"></td>
                <td className="fixed-column name-column">합계</td>
                {datesWithData.map((day) => {
                  const dailyTotal = sortedAndFilteredEmployees.reduce((sum, item) => sum + (item.중량[day] || 0), 0);
                  const dailyPay = sortedAndFilteredEmployees.reduce((sum, item) => sum + (item.중량[day] ? item.중량[day] * 270 : 0), 0);
                  return (
                    <td key={day} className="date-column total-cell">
                      <div className="weight">{dailyTotal.toFixed(2)} kg</div>
                      <div className="pay">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(dailyPay)}</div>
                    </td>
                  );
                })}
                <td className="sum-cell total-cell">
                  <div className="weight">{monthStats.totalWeight.toFixed(2)} kg</div>
                </td>
                <td className="pay-cell total-cell">
                  <div className="pay">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthStats.totalPay)}</div>
                </td>
              </tr>
            </tbody>
            <tfoot>
              {/* 기존 tfoot 내용 유지 */}
            </tfoot>
          </table>
        </div>
      )}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={handleExportModalClose}
        onExport={handleExport}
        availableYears={availableYears}
      />
    </div>
  );
};

export default WorkStatistics;