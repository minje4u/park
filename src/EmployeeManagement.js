import React, { useState, useEffect, useCallback } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeID, setNewEmployeeID] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [isLoading, setIsLoading] = useState(true);

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
    if (newEmployeeName === "" || newEmployeeID === "") {
      alert("이름과 ID를 입력하세요.");
      return;
    }

    try {
      await axios.post('/employees', {
        name: newEmployeeName,
        employeeId: newEmployeeID,
        role: newEmployeeRole,
        password: "0000",
        isInitialPassword: true
      });
      alert("작업자가 추가되었습니다. 초기 비밀번호는 0000입니다.");
      fetchEmployees();
      setNewEmployeeName("");
      setNewEmployeeID("");
      setNewEmployeeRole("worker");
    } catch (error) {
      console.error('작업자 추가 중 오류 발생:', error);
      alert('작업자 추가에 실패했습니다.');
    }
  };

  const handleDeleteEmployee = async (employeeId, employeeName) => {
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
      await axios.delete(`/employees/${employeeId}`);
      alert(`${employeeName} 작업자가 성공적으로 삭제되었습니다.`);
      fetchEmployees();
    } catch (error) {
      console.error('작업자 삭제 중 오류 발생:', error);
      alert('작업자 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="employee-management-container">
      <div className="employee-header">
        <h2>작업자 관리</h2>
      </div>
      <div className="employee-form">
        <input
          type="text"
          placeholder="작업자 이름"
          value={newEmployeeName}
          onChange={(e) => setNewEmployeeName(e.target.value)}
        />
        <input
          type="text"
          placeholder="작업자 ID"
          value={newEmployeeID}
          onChange={(e) => setNewEmployeeID(e.target.value)}
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
                <th>작업자ID</th>
                <th>이름</th>
                <th>역할</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee._id}>
                  <td>{employee.employeeId}</td>
                  <td>{employee.name}</td>
                  <td>{employee.role === 'admin' ? '관리자' : '작업자'}</td>
                  <td className="button-cell">
                    <button 
                      onClick={() => handleDeleteEmployee(employee._id, employee.name)}
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