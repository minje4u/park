import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './LuckyShopManagement.css';

const LuckyShopManagement = () => {
  const [luckyShopItems, setLuckyShopItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', points: '' });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItem, setEditingItem] = useState({ name: '', points: '' });
  const [luckyShopPurchases, setLuckyShopPurchases] = useState([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [hasNewPurchases, setHasNewPurchases] = useState(false);
  
  const fetchLuckyShopItems = useCallback(async () => {
    try {
      const response = await axios.get('/lucky-shop-items');
      setLuckyShopItems(response.data);
    } catch (error) {
      console.error('상품 목록 조회 중 오류:', error);
    }
  }, []);

  useEffect(() => {
    fetchLuckyShopItems();
  }, [fetchLuckyShopItems]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/lucky-shop-items', newItem);
      setNewItem({ name: '', points: '' });
      fetchLuckyShopItems();
    } catch (error) {
      console.error('상품 등록 중 오류:', error);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await axios.delete(`/lucky-shop-items/${id}`);
      fetchLuckyShopItems();
    } catch (error) {
      console.error('상품 삭제 중 오류:', error);
      if (error.response && error.response.status === 404) {
        alert('삭제하려는 상품을 찾을 수 없습니다.');
      } else {
        alert('상품 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleEditItem = (item) => {
    setEditingItemId(item._id);
    setEditingItem({ name: item.name, points: item.points });
  };

  const handleSaveEdit = async (id) => {
    try {
      await axios.put(`/lucky-shop-items/${id}`, editingItem);
      setEditingItemId(null);
      fetchLuckyShopItems();
    } catch (error) {
      console.error('상품 수정 중 오류:', error);
    }
  };

  const fetchLuckyShopPurchases = async () => {
    try {
      const response = await axios.get('/lucky-shop-purchases');
      setLuckyShopPurchases(response.data);
      setHasNewPurchases(response.data.some(purchase => !purchase.isDelivered));
    } catch (error) {
      console.error('구매 내역 조회 중 오류:', error);
    }
  };

  useEffect(() => {
    fetchLuckyShopPurchases();
    const interval = setInterval(fetchLuckyShopPurchases, 60000);
    return () => clearInterval(interval);
  }, []);

  const openPurchaseModal = () => {
    setShowPurchaseModal(true);
  };

  const handlePurchaseComplete = async (purchaseId) => {
    try {
      await axios.post(`/lucky-shop-purchase-complete/${purchaseId}`);
      fetchLuckyShopPurchases();
    } catch (error) {
      console.error('구매 완료 처리 중 오류:', error);
    }
  };

  return (
    <div className="lucky-shop-management">
      <h2 className="lucky-shop-title">행운상점 관리</h2>
      <div className="lucky-shop-content">
        <div className="lucky-shop-form-container">
          <h3>새 상품 추가</h3>
          <form onSubmit={handleAddItem}>
            <input
              type="text"
              placeholder="상품명"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="필요 점수"
              value={newItem.points}
              onChange={(e) => setNewItem({ ...newItem, points: e.target.value })}
              required
            />
            <button type="submit">상품 추가</button>
          </form>
        </div>
        <div className="lucky-shop-items-container">
          <h3>상품 목록</h3>
          <div className="lucky-shop-items-table-container">
            <table className="lucky-shop-items-table">
              <thead>
                <tr>
                  <th>상품명</th>
                  <th>필요 점수</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {luckyShopItems.map((item) => (
                  <tr key={item._id}>
                    <td>
                      {editingItemId === item._id ? (
                        <input
                          type="text"
                          value={editingItem.name}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td>
                      {editingItemId === item._id ? (
                        <input
                          type="number"
                          value={editingItem.points}
                          onChange={(e) => setEditingItem({ ...editingItem, points: e.target.value })}
                        />
                      ) : (
                        item.points
                      )}
                    </td>
                    <td>
                      {editingItemId === item._id ? (
                        <>
                          <button className="btn-save" onClick={() => handleSaveEdit(item._id)}>저장</button>
                          <button className="btn-cancel" onClick={() => setEditingItemId(null)}>취소</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-edit" onClick={() => handleEditItem(item)}>수정</button>
                          <button className="btn-delete" onClick={() => handleDeleteItem(item._id)}>삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <button 
        onClick={openPurchaseModal} 
        className={`purchase-history-button ${hasNewPurchases ? 'blink' : ''}`}
      >
        구매 내역 확인
      </button>

      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>행운상점 구매 내역</h2>
            {luckyShopPurchases.length > 0 ? (
              <ul className="purchase-list">
                {luckyShopPurchases.map((purchase) => (
                  <li key={purchase._id} className="purchase-item">
                    <span>작업자 번호: {purchase.groupNumber}</span>
                    <span>구매 상품: {purchase.itemName}</span>
                    <span>상태: {purchase.isDelivered ? '지급완료' : '미지급'}</span>
                    {!purchase.isDelivered && (
                      <button onClick={() => handlePurchaseComplete(purchase._id)}>지급 완료</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>구매 내역이 없습니다.</p>
            )}
            <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckyShopManagement;