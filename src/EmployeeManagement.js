// src/EmployeeManagement.js
import React, { useState, useEffect } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState({});
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeID, setNewEmployeeID] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [newEmployeePassword, setNewEmployeePassword] = useState("0000");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [works, setWorks] = useState([]);

// API_URL 정의 확인
const API_URL = process.env.NODE_ENV === 'production' 
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';


  useEffect(() => {
    fetchEmployees();
    fetchWorks();  // 컴포넌트가 마운트될 때 작업 정보도 가져옵니다.
    const locked = JSON.parse(localStorage.getItem("lockedAccounts")) || {};
    setLockedAccounts(locked);
  }, []);

  const fetchEmployees = async () => {
     try {
       const response = await axios.get(`${API_URL}/employees`);
       console.log('Fetched employees:', response.data);
       if (Array.isArray(response.data)) {
         setEmployees(response.data);
       } else {
         console.error('Fetched data is not an array:', response.data);
         setEmployees([]); // 빈 배열로 설정
       }
     } catch (error) {
       console.error('직원 정보를 가져오는 데 실패했습니다:', error.response ? error.response.data : error.message);
       setEmployees([]); // 오류 발생 시 빈 배열로 설정
     }
   };

   const fetchWorks = async () => {
    try {
      const response = await axios.get(`${API_URL}/works`);
      console.log('Fetched works:', response.data);
      setWorks(response.data);
    } catch (error) {
      console.error('작업 정보를 가져오는 데 실패했습니다:', error);
    }
  };

  const addEmployee = async () => {
    if (newEmployeeName === "" || newEmployeeID === "") {
      alert("이름과 ID를 입력하세요.");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/employees`, {
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
        await axios.delete(`${API_URL}/employees/${employeeId}`);
        alert(`${employeeName} 작업자가 삭제되었습니다.`);
        fetchEmployees(); // 작업자 목록 새로고침
      } catch (error) {
        console.error('작업자 삭제 중 오류 발생:', error);
        alert('작업자 삭제에 실패했습니다.');
      }
    }
  };


  const handleUnlockAccount = (name) => {
    const updatedLockedAccounts = { ...lockedAccounts };
    delete updatedLockedAccounts[name];
    setLockedAccounts(updatedLockedAccounts);
    localStorage.setItem("lockedAccounts", JSON.stringify(updatedLockedAccounts));
  };

  const deleteEmployee = async (id, name) => {
    if (
      window.confirm(`정말 ${name}님의 계정을 삭제하시겠습니까?`) &&
      window.confirm("이 작업은 되돌릴 수 없습니다. 다시 확인해주세요.") &&
      window.confirm("마지막으로, 계정을 삭제하시겠습니까?")
    ) {
      try {
        await axios.delete(`${API_URL}/employees/${id}`);
        alert(`${name}님의 계정이 삭제되었습니다.`);
        fetchEmployees();

        const updatedLockedAccounts = { ...lockedAccounts };
        delete updatedLockedAccounts[name];
        setLockedAccounts(updatedLockedAccounts);
        localStorage.setItem("lockedAccounts", JSON.stringify(updatedLockedAccounts));
      } catch (error) {
        console.error('직원 삭제 중 오류 발생:', error);
        alert("직원 삭제 중 오류가 발생했습니다.");
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

  const changePassword = async (id, name) => {
    const newPassword = prompt(`${name}님의 새 비밀번호를 입력하세요:`);
    if (newPassword) {
      try {
        await axios.put(`${API_URL}/employees/${id}/password`, { password: newPassword });
        alert(`${name}님의 비밀번호가 변경되었습니다.`);
      } catch (error) {
        console.error('비밀번호 변경 중 오류 발생:', error);
        alert("비밀번호 변경 중 오류가 발생했습니다.");
      }
    }
  };

  const addNotice = async () => {
    if (noticeTitle.trim() === "" || noticeContent.trim() === "") {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/notices`, {
        title: noticeTitle,
        content: noticeContent
      });
      
      if (response.data.message === "공지사항이 등록되었습니다.") {
        alert("새 공지사항이 등록되었습니다.");
        setNoticeTitle("");
        setNoticeContent("");
      } else {
        alert("공지사항 등록에 실패했습니다.");
      }
    } catch (error) {
      console.error('공지사항 등록 중 오류 발생:', error);
      alert("공지사항 등록 중 오류가 발생했습니다: " + error.response?.data?.error || error.message);
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
                  <td>{employee.employeeId}</td>
                  <td>{employee.name}</td>
                  <td>{employee.role === 'admin' ? '관리자' : '작업자'}</td>
                  <td>
                    <button onClick={() => handleDeleteEmployee(employee._id, employee.name)}>삭제</button>
                    <button onClick={() => showLoginRecords(employee.name)}>접속기록</button>
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
