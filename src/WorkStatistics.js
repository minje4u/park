import React, { useEffect, useState } from "react";
import axios from "axios";
import "./WorkStatistics.css"; // 스타일링 파일 (필요시 추가)

// 작업 통계를 표시하는 컴포넌트
const WorkStatistics = () => {
  const [workData, setWorkData] = useState([]); // 작업 데이터를 저장할 상태
  const [errorMessage, setErrorMessage] = useState(""); // 오류 메시지 상태

  // 작업 데이터를 가져오는 함수
  useEffect(() => {
    const fetchWorkData = async () => {
      try {
        // MongoDB에서 작업 데이터 가져오기
        const response = await axios.get("/api/employee/work");
        setWorkData(response.data);
      } catch (error) {
        setErrorMessage("작업 데이터를 불러오는 중 오류 발생: " + error.message);
      }
    };

    fetchWorkData();
  }, []);

  return (
    <div className="work-statistics-container">
      <h2>작업 통계</h2>

      {/* 오류 메시지 표시 */}
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {/* 작업 데이터가 있을 때 테이블로 출력 */}
      {workData.length > 0 ? (
        <table className="work-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>작업자ID</th>
              <th>중량(Kg)</th>
            </tr>
          </thead>
          <tbody>
            {workData.map((work, index) => (
              <tr key={index}>
                <td>{work.date}</td>
                <td>{work.workData.map((data) => data["작업자ID"]).join(", ")}</td>
                <td>{work.workData.map((data) => data["중량(Kg)"]).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>등록된 작업 데이터가 없습니다.</p>
      )}
    </div>
  );
};

export default WorkStatistics;
