import React, { useState, useEffect, useCallback } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeID, setNewEmployeeID] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [editingEmployee, setEditingEmployee] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await axios.get('/employees');
      console.log('Fetched employees:', response.data);
      if (Array.isArray(response.data)) {
        setEmployees(response.data);
      } else {
        console.error('Fetched data is not an array:', response.data);
        setEmployees([]);
      }
    } catch (error) {
      console.error('직원 정보를 가져오는 데 실패했습니다:', error.response ? error.response.data : error.message);
      setEmployees([]);
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
    if (window.confirm(`정말로 ${employeeName} 작업자를 삭제하시겠습니까?`)) {
      try {
        await axios.delete(`/employees/${employeeId}`);
        alert(`${employeeName} 작업자가 삭제되었습니다.`);
        fetchEmployees();
      } catch (error) {
        console.error('작업자 삭제 중 오류 발생:', error);
        alert('작업자 삭제에 실패했습니다.');
      }
    }
  };

  const showLoginRecords = (name) => {
    const records = JSON.parse(localStorage.getItem("loginRecords")) || {};
    if (!records[name] || records[name].length === 0) {
      alert(`${name}님의 접속 기록이 없습니다.`);
    } else {
      alert(`${name}님의 접속 기록:\n` + records[name].join("\n"));
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
  };

  const handleUpdateEmployee = async () => {
    try {
      await axios.put(`/employees/${editingEmployee._id}`, editingEmployee);
      alert("작업자 정보가 수정되었습니다.");
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('작업자 수정 중 오류 발생:', error);
      alert('작업자 수정에 실패했습니다.');
    }
  };

  return (
    <div className="employee-management">
      <h2>작업자 관리</h2>
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
        {Array.isArray(employees) && employees.length > 0 ? (
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
                  <td>
                    {editingEmployee && editingEmployee._id === employee._id ? (
                      <input
                        value={editingEmployee.employeeId}
                        onChange={(e) => setEditingEmployee({...editingEmployee, employeeId: e.target.value})}
                      />
                    ) : (
                      employee.employeeId
                    )}
                  </td>
                  <td>
                    {editingEmployee && editingEmployee._id === employee._id ? (
                      <input
                        value={editingEmployee.name}
                        onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                      />
                    ) : (
                      employee.name
                    )}
                  </td>
                  <td>
                    {editingEmployee && editingEmployee._id === employee._id ? (
                      <select
                        value={editingEmployee.role}
                        onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value})}
                      >
                        <option value="worker">작업자</option>
                        <option value="admin">관리자</option>
                      </select>
                    ) : (
                      employee.role === 'admin' ? '관리자' : '작업자'
                    )}
                  </td>
                  <td>
                    {editingEmployee && editingEmployee._id === employee._id ? (
                      <>
                        <button onClick={handleUpdateEmployee}>저장</button>
                        <button onClick={() => setEditingEmployee(null)}>취소</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditEmployee(employee)}>수정</button>
                        <button onClick={() => handleDeleteEmployee(employee._id, employee.name)}>삭제</button>
                        <button onClick={() => showLoginRecords(employee.name)}>접속기록</button>
                      </>
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
    </div>
  );
};

export default EmployeeManagement;