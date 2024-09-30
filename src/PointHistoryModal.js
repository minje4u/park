import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PointHistoryModal.css';

const PointHistoryModal = ({ employee, onClose }) => {
  const [pointHistory, setPointHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPointHistory = async () => {
      try {
        const response = await axios.get(`/point-history/${employee.groupNumber}`);
        setPointHistory(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error('포인트 변동 내역 조회 중 오류:', error);
        setIsLoading(false);
      }
    };

    fetchPointHistory();
  }, [employee.groupNumber]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{employee.name} ({employee.groupNumber}) 포인트 변동 내역</h3>
          <button className="close-button" onClick={onClose}>닫기</button>
        </div>
        {isLoading ? (
          <p className="loading">로딩 중...</p>
        ) : (
          <div className="table-container">
            <table className="point-history-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>변동</th>
                  <th>사유</th>
                  <th>세부</th>
                </tr>
              </thead>
              <tbody>
                {pointHistory.map((history, index) => (
                  <tr key={index}>
                    <td>{new Date(history.timestamp).toLocaleDateString()}</td>
                    <td className={history.changeAmount >= 0 ? 'positive' : 'negative'}>
                      {history.changeAmount}
                    </td>
                    <td>{history.reason}</td>
                    <td>{history.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointHistoryModal;