// src/EmployeeManagement.js
import React, { useState, useEffect } from "react";
import axios from 'axios';
import "./EmployeeManagement.css";

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState({});
  const [lockedAccounts, setLockedAccounts] = useState({});
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeID, setNewEmployeeID] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState("worker");
  const [newEmployeePassword, setNewEmployeePassword] = useState("0000");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");

  useEffect(() => {
    fetchEmployees();
    const locked = JSON.parse(localStorage.getItem("lockedAccounts")) || {};
    setLockedAccounts(locked);
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/employees');
      const employeesData = response.data.reduce((acc, employee) => {
        acc[employee.name] = {
          작업자ID: employee.employeeId,
          role: employee.role,
          _id: employee._id
        };
        return acc;
      }, {});
      setEmployees(employeesData);
    } catch (error) {
      console.error('직원 목록을 가져오는 중 오류 발생:', error);
    }
  };

  const addEmployee = async () => {
    if (newEmployeeName === "" || newEmployeeID === "") {
      alert("이름과 ID를 입력하세요.");
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/employees', {
        name: newEmployeeName,
        employeeId: newEmployeeID,
        role: newEmployeeRole,
        password: newEmployeePassword
      });
      
      console.log('서버 응답:', response.data);

      if (response.data.message === "직원이 성공적으로 추가되었습니다.") {
        alert("새 직원이 추가되었습니다. 초기 비밀번호는 0000입니다.");
        fetchEmployees();
        setNewEmployeeName("");
        setNewEmployeeID("");
        setNewEmployeeRole("worker");
      } else {
        alert("직원 추가에 실패했습니다.");
      }
    } catch (error) {
      console.error('직원 추가 중 오류 발생:', error);
      alert("직원 추가 중 오류가 발생했습니다: " + error.response?.data?.error || error.message);
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
        await axios.delete(`http://localhost:5000/api/employees/${id}`);
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
        await axios.put(`http://localhost:5000/api/employees/${id}/password`, { password: newPassword });
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
      const response = await axios.post('http://localhost:5000/api/notices', {
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

      <table className="employee-table">
        <thead>
          <tr>
            <th>작업자명</th>
            <th>작업자ID</th>
            <th>권한</th>
            <th>계정 상태</th>
            <th>작업</th>
            <th>기록</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(employees).map(([name, user]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{user.작업자ID}</td>
              <td>{user.role === "admin" ? "관리자" : "작업자"}</td>
              <td>{lockedAccounts[name] ? "잠김" : "활성"}</td>
              <td className="button-cell">
                {lockedAccounts[name] ? (
                  <button onClick={() => handleUnlockAccount(name)} className="employee-button">
                    잠금해제
                  </button>
                ) : (
                  <span>계정정상</span>
                )}
                <button
                  onClick={() => changePassword(user._id, name)}
                  className="employee-button"
                >
                  비밀번호 변경
                </button>
                <button
                  onClick={() => deleteEmployee(user._id, name)}
                  className="employee-button delete"
                >
                  삭제
                </button>
              </td>
              <td>
                <button onClick={() => showLoginRecords(name)} className="employee-button">
                  기록
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="notice-form">
        <h3>공지사항 등록</h3>
        <input
          type="text"
          placeholder="공지사항 제목"
          value={noticeTitle}
          onChange={(e) => setNoticeTitle(e.target.value)}
        />
        <textarea
          placeholder="공지사항 내용"
          value={noticeContent}
          onChange={(e) => setNoticeContent(e.target.value)}
        />
        <button onClick={addNotice} className="notice-button">
          공지등록
        </button>
      </div>
    </div>
  );
};

export default EmployeeManagement;
