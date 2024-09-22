import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newGroupNumber, setNewGroupNumber] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [editingName, setEditingName] = useState(null);

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

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

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

  const sortedEmployees = useMemo(() => {
    let sortableItems = [...employees];
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
  }, [employees, sortConfig]);

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
                  <td className="button-cell">
                    <button 
                      onClick={() => handleDeleteEmployee(employee.groupNumber, employee.name)}
                      className="employee-button delete"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>등록된 작업자가 없습니다.</p>
        )}
      </div>
      <div className="access-log-placeholder">
        <h3>접속 기록</h3>
        <p>이 기능은 추후 구현될 예정입니다.</p>
      </div>
    </div>
  );
};

export default EmployeeManagement;