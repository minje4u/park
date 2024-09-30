import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";
import PointHistoryModal from './PointHistoryModal'; // 이 컴포넌트는 나중에 만들 예정입니다.

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [accumulatedScores, setAccumulatedScores] = useState({});
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newGroupNumber, setNewGroupNumber] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [editingName, setEditingName] = useState(null);
  const [showAccessLogs, setShowAccessLogs] = useState(false);
  const [selectedEmployeeAccessLogs, setSelectedEmployeeAccessLogs] = useState([]);
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedEmployeePurchases, setSelectedEmployeePurchases] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [showPointHistoryModal, setShowPointHistoryModal] = useState(false);
  const [selectedEmployeeForPointHistory, setSelectedEmployeeForPointHistory] = useState(null);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/employees');
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      } else {
        console.error('Fetched data is not an array:', response.data);
        setEmployees([]);
      }
    } catch (error) {
      console.error('직원 정보를 가져오는 데 실패했습니다:', error.response ? error.response.data : error.message);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAccumulatedScores = useCallback(async () => {
    try {
      const response = await axios.get('/accumulated-scores');
      console.log('Fetched accumulated scores:', response.data); // 로깅 추가
      setAccumulatedScores(response.data);
    } catch (error) {
      console.error('누적 점수를 가져오는 데 실패했습니다:', error.response ? error.response.data : error.message);
    }
  }, []);

  const fetchPurchaseHistory = useCallback(async () => {
    try {
      const response = await axios.get('/lucky-shop-purchases');
      console.log('서버에서 받은 구매 내역:', response.data);
      const history = response.data.reduce((acc, purchase) => {
        if (!acc[purchase.groupNumber]) {
          acc[purchase.groupNumber] = [];
        }
        acc[purchase.groupNumber].push(purchase);
        return acc;
      }, {});
      console.log('정리된 구매 내역:', history);
      setPurchaseHistory(history);
    } catch (error) {
      console.error('구매 내역 조회 중 오류:', error);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchAccumulatedScores();
    fetchPurchaseHistory();
  }, [fetchEmployees, fetchAccumulatedScores, fetchPurchaseHistory]);

  const addEmployee = async () => {
    if (newEmployeeName === "" || newGroupNumber === "") {
      alert("이름과 조판번호를 입력하세요.");
      return;
    }

    try {
      await axios.post('/employees', {
        name: newEmployeeName,
        groupNumber: newGroupNumber,
        role: newEmployeeRole,
        password: "0000",
        isInitialPassword: true
      });
      alert("작업자가 추가되었습니다. 초기 비밀번호는 0000입니다.");
      fetchEmployees();
      setNewEmployeeName("");
      setNewGroupNumber("");
      setNewEmployeeRole("worker");
    } catch (error) {
      console.error('작업자 추가 중 오류 발생:', error);
      if (error.response) {
        alert(error.response.data.error || '작업자 추가에 실패했습니다.');
      } else {
        alert('서버와의 통신 중 오류가 발생했습니다.');
      }
    }
  };

  const handleDeleteEmployee = async (groupNumber, employeeName) => {
    // 첫 번째 확인
    if (!window.confirm(`${employeeName} 작업자를 삭제하시겠습니까?`)) {
      return;
    }
    
    // 두 번째 확인
    if (!window.confirm("정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }
    
    // 세 번째 확인: 이름 입력
    const inputName = window.prompt(`${employeeName} 작업자를 삭제하려면 이름을 정확히 입력하세요:`);
    
    if (inputName !== employeeName) {
      alert("입력한 이름이 일치하지 않습니다. 삭제가 취소되었습니다.");
      return;
    }

    try {
      await axios.delete(`/employees/${groupNumber}`);
      alert(`${employeeName} 작업자가 성공적으로 삭제되었습니다.`);
      fetchEmployees();
    } catch (error) {
      console.error('작업자 삭제 중 오류 발생:', error);
      alert('작업자 삭제에 실패했습니다.');
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleNameDoubleClick = (groupNumber) => {
    setEditingName(groupNumber);
  };

  const handleNameEdit = (groupNumber, newName) => {
    setEmployees(prevEmployees => 
      prevEmployees.map(emp => 
        emp.groupNumber === groupNumber ? {...emp, name: newName} : emp
      )
    );
  };

  const handleNameSave = async (groupNumber) => {
    try {
      const employee = employees.find(emp => emp.groupNumber === groupNumber);
      const response = await axios.put(`/employee/name/${groupNumber}`, { newName: employee.name });
      if (response.data.success) {
        setEditingName(null);
        // 성공 메시지를 여기서 표시하지 않습니다.
      } else {
        throw new Error(response.data.message || '서버에서 이름 수정을 실패했습니다.');
      }
    } catch (error) {
      console.error('이름 수정 중 오류:', error);
      alert(error.message || '이름 수정에 실패했습니다.');
    }
  };

  const handleNameInputKeyPress = (event, groupNumber) => {
    if (event.key === 'Enter') {
      handleNameSave(groupNumber);
    }
  };

  const handleScoreDoubleClick = (groupNumber) => {
    setEditingScore(groupNumber);
  };

  const handleScoreEdit = (groupNumber, newScore) => {
    setAccumulatedScores(prevScores => ({
      ...prevScores,
      [groupNumber]: newScore === '' ? '' : parseInt(newScore, 10) || 0
    }));
  };

  const handleScoreSave = async (groupNumber) => {
    try {
      const newScore = accumulatedScores[groupNumber];
      const scoreToSave = newScore === '' ? 0 : parseInt(newScore, 10);
      const oldScore = parseInt(employees.find(emp => emp.groupNumber === groupNumber).accumulatedScore, 10) || 0;
      const changeAmount = scoreToSave - oldScore;

      const response = await axios.put(`/accumulated-score/${groupNumber}`, { score: scoreToSave });
      if (response.data.success) {
        // 포인트 변동 내역 저장
        await axios.post('/point-history', {
          groupNumber,
          changeAmount,
          reason: '관리자변경',
          details: `${oldScore} → ${scoreToSave}`
        });

        setEditingScore(null);
        setAccumulatedScores(prevScores => ({
          ...prevScores,
          [groupNumber]: scoreToSave
        }));
      } else {
        throw new Error(response.data.message || '점수 수정을 실패했습니다.');
      }
    } catch (error) {
      console.error('점수 수정 중 오류:', error);
      alert(error.message || '점수 수정에 실패했습니다.');
    }
  };

  const handleScoreInputKeyPress = (event, groupNumber) => {
    if (event.key === 'Enter') {
      handleScoreSave(groupNumber);
    }
  };

  const sortedEmployees = useMemo(() => {
    let sortableItems = employees.map(employee => ({
      ...employee,
      accumulatedScore: accumulatedScores[employee.groupNumber] || 0,
      hasUndeliveredPurchase: purchaseHistory[employee.groupNumber]?.some(p => !p.isDelivered) || false
    }));
    
    // 미지급 구매내역이 있는 작업자를 상단으로 정렬
    sortableItems.sort((a, b) => {
      if (a.hasUndeliveredPurchase && !b.hasUndeliveredPurchase) return -1;
      if (!a.hasUndeliveredPurchase && b.hasUndeliveredPurchase) return 1;
      return 0;
    });
    
    // 기존 정렬 로직 적용
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [employees, accumulatedScores, sortConfig, purchaseHistory]);

  useEffect(() => {
    const handleEmployeeNameUpdate = (event) => {
      const { groupNumber, newName } = event.detail;
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.groupNumber === groupNumber ? {...emp, name: newName} : emp
        )
      );
    };

    window.addEventListener('employeeNameUpdated', handleEmployeeNameUpdate);

    return () => {
      window.removeEventListener('employeeNameUpdated', handleEmployeeNameUpdate);
    };
  }, []);

  const handleShowAccessLogs = async (groupNumber) => {
    try {
      const response = await axios.get(`/access-logs/${groupNumber}`);
      setSelectedEmployeeAccessLogs(response.data);
      setShowAccessLogs(true);
    } catch (error) {
      console.error('접속 기록 조회 중 오류:', error);
      alert('접속 기록 조회에 실패했습니다.');
    }
  };

  const handleShowPurchaseHistory = (groupNumber) => {
    const employee = employees.find(emp => emp.groupNumber === groupNumber);
    setSelectedEmployee(employee);
    setSelectedEmployeePurchases(purchaseHistory[groupNumber] || []);
    setShowPurchaseModal(true);
  };

  const handleCompletePurchase = async (purchaseId) => {
    try {
      await axios.post(`/lucky-shop-purchase-complete/${purchaseId}`);
      fetchPurchaseHistory();
      setSelectedEmployeePurchases(prevPurchases => 
        prevPurchases.map(purchase => 
          purchase._id === purchaseId ? {...purchase, isDelivered: true, deliveryDate: new Date()} : purchase
        )
      );
    } catch (error) {
      console.error('구매 완료 처리 중 오류:', error);
      alert('구매 완료 처리에 실패했습니다.');
    }
  };

  useEffect(() => {
    console.log('accumulatedScores 업데이트됨:', accumulatedScores);
  }, [accumulatedScores]);

  const handleShowPointHistory = (employee) => {
    setSelectedEmployeeForPointHistory(employee);
    setShowPointHistoryModal(true);
  };

  return (
    <div className="employee-management-container">
      <div className="employee-header">
        <h2>작업자 관리</h2>
      </div>
      <div className="employee-form">
        <input
          type="text"
          placeholder="조판번호"
          value={newGroupNumber}
          onChange={(e) => setNewGroupNumber(e.target.value)}
        />
        <input
          type="text"
          placeholder="작업자 이름"
          value={newEmployeeName}
          onChange={(e) => setNewEmployeeName(e.target.value)}
        />
        <select
          value={newEmployeeRole}
          onChange={(e) => setNewEmployeeRole(e.target.value)}
        >
          <option value="worker">작업자</option>
          <option value="admin">관리자</option>
        </select>
        <button onClick={addEmployee} className="employee-button">
          작업자 추가
        </button>
      </div>
      <div className="employee-list">
        <h3>작업자 목록</h3>
        {isLoading ? (
          <div className="loading">데이터를 불러오는 중...</div>
        ) : Array.isArray(employees) && employees.length > 0 ? (
          <table className="employee-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('groupNumber')}>
                  조판번호 {sortConfig.key === 'groupNumber' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('name')}>
                  이름 {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('role')}>
                  역할 {sortConfig.key === 'role' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('accumulatedScore')}>
                  누적 점수 {sortConfig.key === 'accumulatedScore' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                </th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((employee) => (
                <tr key={employee.groupNumber} className={employee.role === 'admin' ? 'admin-row' : ''}>
                  <td className={employee.role === 'admin' ? 'admin-cell' : ''}>{employee.groupNumber}</td>
                  <td className={employee.role === 'admin' ? 'admin-cell' : ''}>
                    {editingName === employee.groupNumber ? (
                      <input
                        type="text"
                        value={employee.name}
                        onChange={(e) => handleNameEdit(employee.groupNumber, e.target.value)}
                        onKeyPress={(e) => handleNameInputKeyPress(e, employee.groupNumber)}
                        onBlur={() => handleNameSave(employee.groupNumber)}
                        autoFocus
                      />
                    ) : (
                      <span onDoubleClick={() => handleNameDoubleClick(employee.groupNumber)}>
                        {employee.name}
                      </span>
                    )}
                  </td>
                  <td className={employee.role === 'admin' ? 'admin-cell' : ''}>{employee.role === 'admin' ? '관리자' : '작업자'}</td>
                  <td className={`score-cell ${employee.role === 'admin' ? 'admin-cell' : ''}`}>
                    {editingScore === employee.groupNumber ? (
                      <input
                        type="number"
                        className="score-input"
                        value={accumulatedScores[employee.groupNumber] ?? ''}
                        onChange={(e) => handleScoreEdit(employee.groupNumber, e.target.value)}
                        onKeyPress={(e) => handleScoreInputKeyPress(e, employee.groupNumber)}
                        onBlur={() => handleScoreSave(employee.groupNumber)}
                        autoFocus
                      />
                    ) : (
                      <span onDoubleClick={() => handleScoreDoubleClick(employee.groupNumber)}>
                        {accumulatedScores[employee.groupNumber] ?? 0}
                      </span>
                    )}
                  </td>
                  <td className="button-cell">
                    <button 
                      onClick={() => handleDeleteEmployee(employee.groupNumber, employee.name)}
                      className="employee-button delete"
                    >
                      삭제
                    </button>
                    <button 
                      onClick={() => handleShowAccessLogs(employee.groupNumber)}
                      className="employee-button access-logs"
                    >
                      접속 기록
                    </button>
                    <button 
                      onClick={() => handleShowPointHistory(employee)}
                      className="employee-button point-history"
                    >
                      포인트 내역
                    </button>
                    {purchaseHistory[employee.groupNumber] && purchaseHistory[employee.groupNumber].length > 0 && (
                      <button 
                        onClick={() => handleShowPurchaseHistory(employee.groupNumber)}
                        className={`employee-button purchase-history ${purchaseHistory[employee.groupNumber].some(p => !p.isDelivered) ? 'blink' : ''}`}
                      >
                        {purchaseHistory[employee.groupNumber].some(p => !p.isDelivered) ? '미지급 구입내역!' : '구입내역'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>등록된 작업자가 없습니다.</p>
        )}
      </div>
      {showAccessLogs && (
        <div className="modal-overlay" onClick={() => setShowAccessLogs(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>접속 기록</h3>
            <table className="access-logs-table">
              <thead>
                <tr>
                  <th>접속 시간</th>
                  <th>IP 주소</th>
                </tr>
              </thead>
              <tbody>
                {selectedEmployeeAccessLogs.map((log, index) => (
                  <tr key={index}>
                    <td>{new Date(log.accessTime).toLocaleString()}</td>
                    <td>{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setShowAccessLogs(false)}>닫기</button>
          </div>
        </div>
      )}
      {showPurchaseModal && selectedEmployee && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-content purchase-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="section-title">
                {selectedEmployee.groupNumber}, {selectedEmployee.name} 님의 미지급쿠폰내역
              </h4>
              <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>닫기</button>
            </div>
            <div className="purchase-history-section">
              {selectedEmployeePurchases.filter(purchase => !purchase.isDelivered).length > 0 ? (
                <table className="purchase-history-table">
                  <thead>
                    <tr>
                      <th>상품명</th>
                      <th>구매일</th>
                      <th>상태</th>
                      <th>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeePurchases
                      .filter(purchase => !purchase.isDelivered)
                      .map((purchase) => (
                        <tr key={purchase._id}>
                          <td>{purchase.itemName}</td>
                          <td>{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                          <td><span className="status pending">미지급</span></td>
                          <td>
                            <button className="action-button complete" onClick={() => handleCompletePurchase(purchase._id)}>
                              지급완료
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-data">현재 미지급 쿠폰 내역이 없습니다.</p>
              )}
            </div>
            <div className="purchase-history-section">
              <h4 className="section-title">지난 구매내역</h4>
              {selectedEmployeePurchases.filter(purchase => purchase.isDelivered).length > 0 ? (
                <table className="purchase-history-table">
                  <thead>
                    <tr>
                      <th>상품명</th>
                      <th>구매일</th>
                      <th>지급일</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeePurchases
                      .filter(purchase => purchase.isDelivered)
                      .map((purchase) => (
                        <tr key={purchase._id}>
                          <td>{purchase.itemName}</td>
                          <td>{new Date(purchase.purchaseDate).toLocaleDateString()}</td>
                          <td>{new Date(purchase.deliveryDate).toLocaleDateString()}</td>
                          <td><span className="status completed">지급완료</span></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="no-data">지난 구매 내역이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {showPointHistoryModal && selectedEmployeeForPointHistory && (
        <PointHistoryModal
          employee={selectedEmployeeForPointHistory}
          onClose={() => setShowPointHistoryModal(false)}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;