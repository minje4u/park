import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const FortuneManagement = ({ fortunes, setFortunes }) => {
  const [file, setFile] = useState(null);

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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('파일을 선택해주세요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      const fortunes = content.split('\n').filter(line => line.trim() !== '');

      try {
        await axios.post('/fortunes/upload', { fortunes }, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        setFile(null);
        fetchFortunes();
        alert('운세 파일이 성공적으로 업로드되었습니다.');
      } catch (error) {
        console.error('운세 파일 업로드 중 오류:', error);
        alert('운세 파일 업로드에 실패했습니다.');
      }
    };

    reader.readAsText(file);
  };

  const handleDelete = async (fortuneId) => {
    try {
      await axios.delete(`/fortunes/${fortuneId}`);
      fetchFortunes();
      alert('운세가 성공적으로 삭제되었습니다.');
    } catch (error) {
      console.error('운세 삭제 중 오류:', error);
      alert('운세 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="fortune-management">
      <h2>운세 관리</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".txt"
        />
        <button type="submit">파일 업로드</button>
      </form>
      <div className="fortune-list">
        <h3>등록된 운세 목록 (총 {fortunes.length}개)</h3>
        <ul>
          {fortunes.map((fortune) => (
            <li key={fortune._id}>
              {fortune.content}
              <button onClick={() => handleDelete(fortune._id)}>삭제</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FortuneManagement;
