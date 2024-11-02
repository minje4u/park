import React from 'react';
import './AccountHistoryModal.css'; // 스타일을 위한 CSS 파일
import axios from 'axios';

const AccountHistoryModal = ({ history = [], onClose, onDelete, onCheck }) => {
  const handleDelete = async (index) => {
    try {
      const entryId = history[index]._id; // 삭제할 이력의 ID 가져오기
      await axios.delete(`/account-history/${entryId}`); // 삭제 요청 보내기
      onDelete(index); // 부모 컴포넌트의 삭제 함수 호출
    } catch (error) {
      console.error('이력 삭제 중 오류 발생:', error);
      alert('이력 삭제에 실패했습니다.');
    }
  };

  const handleCheck = () => {
    onCheck(); // 관리자 확인 함수 호출
    onClose(); // 모달 닫기
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>계좌번호 변경 이력</h2>
        <button className="close-button" onClick={onClose}>닫기</button>
        <button className="check-button" onClick={handleCheck}>관리자 확인</button>
        <table className="table">
          <thead>
            <tr>
              <th>이전 계좌번호</th>
              <th>새 계좌번호</th>
              <th>변경 이유</th>
              <th>변경 날짜</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {history.length > 0 ? (
              history.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.oldAccountNumber}</td>
                  <td>{entry.newAccountNumber}</td>
                  <td>{entry.reason}</td>
                  <td>{new Date(entry.date).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <button className="delete-button" onClick={() => handleDelete(index)}>삭제</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5">변경 이력이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountHistoryModal;
