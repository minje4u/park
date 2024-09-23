import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from 'axios';
import "./WorkStatistics.css";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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

const WorkStatistics = () => {
  const [workStatistics, setWorkStatistics] = useState({});
  const [datesWithData, setDatesWithData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'groupNumber', direction: 'ascending' });
  const [editingName, setEditingName] = useState(null);
  const tableRef = useRef(null);

  const fetchWorkStatistics = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("작업 통계 요청 시작");
      const response = await axios.get('/employee/work', {
        params: {
          year: selectedMonth.getFullYear(),
          month: selectedMonth.getMonth() + 1,
          groupNumber: '' // 빈 문자열로 설정하여 모든 작업자의 데이터를 가져옵니다.
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
        window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
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
        alert('데이터 삭제 중 오류가 발생했습니다.');
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
    let sortableItems = Object.entries(workStatistics).map(([groupNumber, data]) => ({
      groupNumber,
      name: data.employeeName,
      ...data,
      sum: Object.values(data.중량 || {}).reduce((acc, val) => acc + (val || 0), 0),
      pay: Math.floor(Object.values(data.중량 || {}).reduce((acc, val) => acc + (val || 0), 0) * 270)
    }));

    if (searchTerm.trim()) {
      sortableItems = sortableItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.groupNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });

    return sortableItems;
  }, [workStatistics, searchTerm, sortConfig]);

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

  const handleNameEdit = (groupNumber, newName) => {
    setEditingName(groupNumber);
    setWorkStatistics(prevStats => ({
      ...prevStats,
      [groupNumber]: {
        ...prevStats[groupNumber],
        employeeName: newName
      }
    }));
  };

  const handleNameSave = async (groupNumber) => {
    try {
      const newName = workStatistics[groupNumber].employeeName;
      const response = await axios.put(`/employee/name/${groupNumber}`, { newName });
      if (response.data.success) {
        setEditingName(null);
        // 작업자 관리 컴포넌트에 변경 사항 알림
        if (typeof window.updateEmployeeName === 'function') {
          window.updateEmployeeName(groupNumber, newName);
        }
        return true;
      } else {
        throw new Error(response.data.message || '서버에서 이름 수정을 실패했습니다.');
      }
    } catch (error) {
      console.error('이름 수정 중 오류:', error);
      alert(error.message || '이름 수정에 실패했습니다.');
      return false;
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


const exportToExcel = async () => {
  const workbook = new ExcelJS.Workbook();

  // 데이터가 있는 월만 필터링
  const monthsWithData = Array.from({ length: 12 }, (_, i) => i)
    .filter(month => {
      return Object.values(workStatistics).some(employee => 
        Object.keys(employee.중량).some(day => {
          const date = new Date(selectedMonth.getFullYear(), month, day);
          return date.getMonth() === month;
        })
      );
    });

  // 데이터가 있는 월에 대해서만 시트 생성
  monthsWithData.forEach(month => {
    const worksheet = workbook.addWorksheet(`${month + 1}월`);

    // 해당 년월 추가
    const yearMonth = `${selectedMonth.getFullYear()}년 ${month + 1}월`;
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = yearMonth;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 헤더 추가
    const headers = ['조판번호', '작업자명', ...datesWithData.map(day => `${day}일`), '중량합계', '도급'];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' }
      };
      cell.font = { color: { argb: 'FFFFFFFF' } };
    });

    // 해당 월의 데이터만 필터링
    const monthData = Object.entries(workStatistics).map(([groupNumber, data]) => {
      const filteredWeights = Object.entries(data.중량).reduce((acc, [day, weight]) => {
        const date = new Date(selectedMonth.getFullYear(), month, day);
        if (date.getMonth() === month) {
          acc[day] = weight;
        }
        return acc;
      }, {});

      return {
        groupNumber,
        name: data.employeeName,
        중량: filteredWeights,
        sum: Object.values(filteredWeights).reduce((sum, weight) => sum + weight, 0),
        pay: Object.values(filteredWeights).reduce((sum, weight) => sum + weight * 270, 0)
      };
    }).filter(item => Object.keys(item.중량).length > 0);

    // 데이터 추가
    monthData.forEach((item, index) => {
      const rowData = [
        item.groupNumber,
        item.name,
        ...datesWithData.map(day => {
          const date = new Date(selectedMonth.getFullYear(), month, day);
          return (date.getMonth() === month && item.중량[day]) ? item.중량[day].toFixed(1) : '-';
        }),
        item.sum.toFixed(1) + ' kg',
        new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(item.pay)
      ];
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: 'center', vertical: 'middle' };

      // 3줄당 배경색 반전
      if (index % 6 < 3) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
          };
        });
      }
    });

    // 총합계 행 추가
    const totalRow = worksheet.addRow(['총합계']);
    worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // 일별 총합계
    datesWithData.forEach((day, index) => {
      const date = new Date(selectedMonth.getFullYear(), month, day);
      if (date.getMonth() === month) {
        const dailyTotal = monthData.reduce((sum, item) => sum + (item.중량[day] || 0), 0);
        const dailyPay = monthData.reduce((sum, item) => sum + (item.중량[day] ? item.중량[day] * 270 : 0), 0);
        totalRow.getCell(index + 3).value = `${dailyTotal.toFixed(1)}kg\n${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(dailyPay)}`;
        totalRow.getCell(index + 3).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      }
    });

    // 월별 총합계
    const monthlyTotal = monthData.reduce((sum, item) => sum + item.sum, 0);
    const monthlyPay = monthData.reduce((sum, item) => sum + item.pay, 0);
    totalRow.getCell(datesWithData.length + 3).value = `${monthlyTotal.toFixed(1)} kg`;
    totalRow.getCell(datesWithData.length + 4).value = `${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthlyPay)}`;
    
    // 총 중량합계와 총 도급비용 셀 정중앙 정렬
    totalRow.getCell(datesWithData.length + 3).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(datesWithData.length + 4).alignment = { horizontal: 'center', vertical: 'middle' };

    // 열 너비 자동 조정
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  });

  // 현재 시간을 파일명에 포함
  const now = new Date();
  const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;

  // 파일 저장
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  saveAs(blob, `${selectedMonth.getFullYear()}년_작업내역_${timestamp}.xlsx`);
};

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
        <button onClick={exportToExcel} className="export-button">엑셀로 저장</button>
      </div>
      {isLoading ? (
        <div className="loading">데이터를 불러오는 중...</div>
      ) : Object.keys(workStatistics).length === 0 ? (
        <p>데이터가 없습니다.</p>
      ) : (
        <div className="table-container">
          <table className="admin-table" ref={tableRef}>
            <thead>
              <tr>
                <th className="id-column" onClick={() => handleSort('groupNumber')}>
                  조판번호 {sortConfig.key === 'groupNumber' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th className="name-column" onClick={() => handleSort('name')}>
                  이름 {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
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
              {sortedAndFilteredEmployees.map((item) => (
                <tr key={item.groupNumber}>
                  <td className="id-column">{item.groupNumber}</td>
                  <td className="name-column">
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
                    <td key={day} className="data-cell">
                      <div className="weight">{item.중량 && item.중량[day] ? item.중량[day].toFixed(1) : "-"}</div>
                      <div className="work-hours">{item.작업시간 && item.작업시간[day] ? item.작업시간[day] : "-"}</div>
                    </td>
                  ))}
                  <td className="sum-cell">{item.sum.toFixed(1)} kg</td>
                  <td className="pay-cell">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(item.pay)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan="2" className="total-label">일별 합계</td>
                {datesWithData.map((day) => {
                  const dailyTotal = sortedAndFilteredEmployees.reduce((sum, item) => sum + (item.중량[day] || 0), 0);
                  const dailyPay = sortedAndFilteredEmployees.reduce((sum, item) => sum + (item.중량[day] ? item.중량[day] * 270 : 0), 0);
                  return (
                    <td key={day} className="total-cell">
                      <div className="weight">{dailyTotal.toFixed(1)} kg</div>
                      <div className="pay">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(dailyPay)}</div>
                    </td>
                  );
                })}
                <td className="total-cell">
                  <div className="weight">{monthStats.totalWeight.toFixed(1)} kg</div>
                </td>
                <td className="total-cell">
                  <div className="pay">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthStats.totalPay)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WorkStatistics;