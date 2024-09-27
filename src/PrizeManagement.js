


import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PrizeManagement = () => {
  const [prizes, setPrizes] = useState([]);
  const [newPrize, setNewPrize] = useState('');

  useEffect(() => {
    fetchPrizes();
  }, []);

  const fetchPrizes = async () => {
    try {
      const response = await axios.get('/prizes');
      setPrizes(response.data);
    } catch (error) {
      console.error('상품 목록 조회 중 오류:', error);
    }
  };

  const handleAddPrize = async (e) => {
    e.preventDefault();
    if (!newPrize.trim()) return;

    try {
      await axios.post('/prizes', { name: newPrize });
      setNewPrize('');
      fetchPrizes();
    } catch (error) {
      console.error('상품 추가 중 오류:', error);
    }
  };

  const handleDeletePrize = async (id) => {
    try {
      await axios.delete(`/prizes/${id}`);
      fetchPrizes();
    } catch (error) {
      console.error('상품 삭제 중 오류:', error);
    }
  };

  return (
    <div className="prize-management">
      <h2>상품 관리</h2>
      <form onSubmit={handleAddPrize}>
        <input
          type="text"
          value={newPrize}
          onChange={(e) => setNewPrize(e.target.value)}
          placeholder="새 상품 이름"
        />
        <button type="submit">추가</button>
      </form>
      <ul>
        {prizes.map((prize) => (
          <li key={prize._id}>
            {prize.name}
            <button onClick={() => handleDeletePrize(prize._id)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PrizeManagement;