import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const FortuneManagement = ({ fortunes, setFortunes }) => {
  const [newFortune, setNewFortune] = useState('');

  const fetchFortunes = useCallback(async () => {
    try {
      const response = await axios.get('/fortunes');
      setFortunes(response.data);
    } catch (error) {
      console.error('운세 문구 조회 중 오류:', error);
    }
  }, [setFortunes]);

  useEffect(() => {
    fetchFortunes();
  }, [fetchFortunes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/fortunes', { content: newFortune });
      setNewFortune('');
      fetchFortunes();
    } catch (error) {
      console.error('운세 문구 등록 중 오류:', error);
    }
  };

  return (
    <div className="fortune-management">
      <h2>운세 관리</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={newFortune}
          onChange={(e) => setNewFortune(e.target.value)}
          placeholder="새로운 운세 문구를 입력하세요"
          required
        />
        <button type="submit">등록</button>
      </form>
      <div className="fortune-list">
        <h3>등록된 운세 목록</h3>
        <ul>
          {fortunes.map((fortune) => (
            <li key={fortune._id}>{fortune.content}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FortuneManagement;
