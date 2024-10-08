import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import './WorkRegistration.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

// axios 기본 URL 설정
axios.defaults.baseURL = API_URL;

const WorkRegistration = ({ onConfirm }) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filteredContent, setFilteredContent] = useState([]); // 필터링된 내용을 저장할 상태
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // 오늘 날짜로 초기값 설정
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }, []);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    readFile(file); // 파일을 선택하면 파일 내용을 읽어옴
  };

  // 파일 읽기 및 내용 저장
  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const filteredData = jsonData.filter(
        (row) => row['조'] === 3 && row['중량(Kg)'] > 0
      );

      const enhancedData = filteredData.map((row) => ({
        ...row,
        groupNumber: `${row['조']}-${row['작업자ID'].toString().padStart(2, '0')}`
      }));

      console.log("필터링된 데이터:", enhancedData);
      setFilteredContent(enhancedData);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedFile) {
      setErrorMessage("날짜와 파일을 선택해주세요.");
      return;
    }

    try {
      // 기존 데이터 확인
      const checkResponse = await axios.get(`/employee/work/check/${selectedDate}`);
      if (checkResponse.data.exists) {
        const confirmOverwrite = window.confirm(`${selectedDate}에 이미 데이터가 존재합니다. 덮어쓰시겠습니까?`);
        if (!confirmOverwrite) {
          setErrorMessage("작업이 취소되었습니다.");
          return;
        }
      }

      const workData = await Promise.all(filteredContent.map(async row => {
        const groupNumber = await generateGroupNumber(row['조'], row['작업자ID']);
        return {
          date: new Date(selectedDate),
          조: parseInt(row['조']),
          employeeId: row['작업자ID'],
          employeeName: row['작업자명'],
          weight: parseFloat(row['중량(Kg)']),
          workHours: parseFloat(row['총작업시간']) || 0,
          totalWeight: parseFloat(row['중량(Kg)']),
          payment: Math.floor(parseFloat(row['중량(Kg)']) * 270),
          groupNumber: groupNumber
        };
      }));

      console.log("전송할 데이터:", JSON.stringify(workData, null, 2));

      // 서버에 데이터 전송 (덮어쓰기 모드)
      const response = await axios.post('/employee/work', { workData, overwrite: true });
      
      console.log("서버 응답:", response.data);

      onConfirm(selectedDate, workData);
      setConfirmationMessage(`${selectedDate} 작업이 등록되었습니다.`);
      setErrorMessage("");
      setSelectedFile(null);
      setFilteredContent([]);
    } catch (error) {
      console.error("작업 등록 중 오류 발생:", error.response ? error.response.data : error.message);
      setErrorMessage("작업 등록에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const generateGroupNumber = (조, employeeId) => {
    const paddedId = employeeId.toString().padStart(2, '0');
    return `${조}-${paddedId}`;
  };

  return (
    <div className="work-registration-container">
      <h2 className="work-header">작업 등록</h2>

      <form className="work-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="date-input">날짜 선택</label>
          <input
            id="date-input"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="file-input">파일 선택</label>
          <input
            id="file-input"
            type="file"
            onChange={handleFileChange}
          />
        </div>
        <button type="submit">확인</button>
      </form>

      {/* 필터링된 파일 내용 미리보기 */}
      {filteredContent.length > 0 && (
        <div className="file-preview">
          <h3>조 3 작업 미리보기 (중량 0 이상)</h3>
          <div className="table-container">
            <table className="file-table">
              <thead>
                <tr>
                  {Object.keys(filteredContent[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredContent.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmationMessage && <p className="confirmation-message">{confirmationMessage}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </div>
  );
};

export default WorkRegistration;

