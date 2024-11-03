import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AllEmployees.css';
import AccountHistoryModal from './AccountHistoryModal';
import { FaRegCalendarAlt, FaRegIdCard, FaRegUser, FaRegFlag, FaPhoneAlt, FaRegAddressCard, FaRegMoneyBillAlt } from 'react-icons/fa';
import { exportEmployeesToExcel } from './EmployeeExport'; // 새로운 엑셀 내보내기 함수 import

const API_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions/api'
  : 'http://localhost:8888/.netlify/functions/api';

axios.defaults.baseURL = API_URL;

const extractImageUrl = (html) => {
  const regex = /<img[^>]+src="([^">]+)"/; // <img> 태그에서 src 속성 추출
  const match = html.match(regex);
  return match ? match[1] : null; // URL이 있으면 반환, 없으면 null
};

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchParam, setSearchParam] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [activeInput, setActiveInput] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [accountHistory, setAccountHistory] = useState([]);
  const [photoUrl, setPhotoUrl] = useState(''); // 사진 URL 상태 추가
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get('/employees');
        setEmployees(response.data);
        setFilteredEmployees(response.data);
        if (response.data.length > 0) {
          setSelectedEmployee(response.data[0]); // 첫 번째 작업자를 선택
          setPhoto(response.data[0].photo || 'default-photo.png'); // 첫 번째 작업자의 사진 URL 설정
        }
      } catch (error) {
        console.error('직원 정보를 가져오는 데 실패했습니다:', error);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (filteredEmployees.length > 0) {
      setSelectedEmployee(filteredEmployees[0]); // 필터링된 직원이 있을 경우 첫 번째 직원 선택
    } else {
      setSelectedEmployee(null); // 필터링된 직원이 없으면 선택 초기화
    }
  }, [filteredEmployees]);

  const handleSearchChange = (e) => {
    setSearchParam(e.target.value);
  };

  const handleSearch = () => {
    const filtered = employees.filter((employee) =>
      (employee.groupNumber && employee.groupNumber.includes(searchParam)) || 
      (employee.name && employee.name.includes(searchParam)) ||
      (employee.nationality && employee.nationality.includes(searchParam)) ||
      (employee.residency && employee.residency.includes(searchParam)) ||
      (employee.idNumber && employee.idNumber.includes(searchParam)) ||
      (employee.phoneNumber && employee.phoneNumber.includes(searchParam)) ||
      (employee.address && employee.address.includes(searchParam)) ||
      (employee.accountNumber && employee.accountNumber.includes(searchParam)) ||
      (employee.accountHolder && employee.accountHolder.includes(searchParam))
    );
    setFilteredEmployees(filtered);
    
    // 검색 결과가 없으면 선택된 직원 초기화
    if (filtered.length === 0) {
      setSelectedEmployee(null);
    } else {
      setSelectedEmployee(filtered[0]); // 첫 번째 결과를 선택
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleResetSearch = () => {
    setSearchParam('');
    setFilteredEmployees(employees);
    setSelectedEmployee(employees[0] || null); // 초기화 시 첫 번째 직원 선택
  };

  const handleCardClick = (employee) => {
    setSelectedEmployee(employee);
    setPhoto(employee.photo || 'default-photo.png'); // 선택된 작업자의 사진 URL 업데이트
  };


  const highlightText = (text) => {
    if (!text || !searchParam) return text; // 텍스트가 null 또는 검색어가 없으면 원래 텍스트 반환
    const regex = new RegExp(`(${searchParam})`, 'gi'); // 대소문자 구분 없이 검색어 하이라이트
    const parts = text.split(regex); // 검색어를 기준으로 텍스트 분할
    return parts.map((part, index) => 
      part.toLowerCase() === searchParam.toLowerCase() ? (
        <span key={index} style={{ backgroundColor: 'yellow' }}>{part}</span> // 하이라이트 스타일
      ) : part
    );
  };

  const handleCellDoubleClick = (employee, field, event) => {
    const cell = event.currentTarget;

    if (activeInput) {
      activeInput.blur();
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = employee[field] || '';
    input.className = 'editable-input';
    input.style.width = `${Math.max(input.value.length * 8, 100)}px`;

    const adjustInputWidth = () => {
      input.style.width = `${Math.max(input.scrollWidth, 100)}px`;
    };
    input.addEventListener('input', adjustInputWidth);

    input.onblur = async () => {
      if (input.value) {
        try {
          const updatedData = { [field]: input.value };

          const response = await axios.put(`/employee/${employee.groupNumber}`, updatedData);
          if (response.status === 200) {
            setEmployees((prev) =>
              prev.map((emp) => (emp.groupNumber === employee.groupNumber ? { ...emp, [field]: input.value } : emp))
            );
            setFilteredEmployees((prev) =>
              prev.map((emp) => (emp.groupNumber === employee.groupNumber ? { ...emp, [field]: input.value } : emp))
            );

            if (field === 'accountNumber') {
              const oldAccountNumber = employee.accountNumber;
              if (oldAccountNumber !== input.value) {
                const reason = prompt('변경 이유를 입력하세요:');
                if (!reason) {
                  alert('변경 이유를 입력해야 합니다.');
                  return;
                }

                await axios.put(`/employee/${employee.groupNumber}`, { previousAccountNumber: oldAccountNumber });
                await axios.post('/account-history', {
                  groupNumber: employee.groupNumber,
                  oldAccountNumber,
                  newAccountNumber: input.value,
                  reason
                });

                alert('계좌번호가 변경되었습니다.');
              }
            }
          }
        } catch (error) {
          console.error('수정된 내용을 저장하는 데 실패했습니다:', error);
        }
      }
      setActiveInput(null);
      cell.innerHTML = input.value;
    };

    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    };

    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
  };

  const handleShowHistory = async (employee) => {
    setSelectedEmployee(employee);
    try {
      const response = await axios.get(`/account-history/${employee.groupNumber}`);
      console.log('이력 데이터:', response.data);
      setAccountHistory(response.data);
    } catch (error) {
      console.error('이력 가져오기 실패:', error);
      alert('이력을 가져오는 데 실패했습니다.');
    }
    setShowModal(true);
  };

  const handleCheckAccountNumber = async () => {
    try {
      const response = await axios.put(`/employee/check-account-number/${selectedEmployee.groupNumber}`);
      console.log('API 응답:', response.data);
      if (response.status === 200) {
        setSelectedEmployee((prev) => ({ ...prev, isAccountNumberChecked: true }));
      }
    } catch (error) {
      console.error('계좌번호 확인 중 오류 발생:', error);
      alert('계좌번호 확인에 실패했습니다.');
    }
  };

  const handleDeleteHistory = (index) => {
    setAccountHistory((prevHistory) => {
      const newHistory = [...prevHistory];
      newHistory.splice(index, 1); // 해당 인덱스의 이력 삭제
      return newHistory;
    });

    // 만약 이력이 모두 삭제되면 "변경됨" 버튼을 숨기기 위해 상태 업데이트
    if (accountHistory.length === 1) {
      setSelectedEmployee((prev) => ({ ...prev, previousAccountNumber: null }));
    }
  };

  const handleExportToExcel = () => {
    exportEmployeesToExcel(filteredEmployees); // 새로운 함수 호출
  };

  const handlePhotoModalOpen = () => {
    setShowPhotoModal(true);
  };


// 삭제 핸들러 함수 추가
    const handlePhotoDelete = async () => {
      // 첫 번째 확인
      if (!window.confirm('사진을 삭제하시겠습니까?')) {
          return;
      }
      
      // 두 번째 확인
      if (!window.confirm('정말로 삭제하시겠습니까?')) {
          return;
      }

      try {
          await axios.put(`/employee/${selectedEmployee.groupNumber}`, { photo: null });
          
          // 상태 업데이트
          setEmployees((prev) =>
              prev.map((emp) =>
                  emp.groupNumber === selectedEmployee.groupNumber ? { ...emp, photo: null } : emp
              )
          );
          setFilteredEmployees((prev) =>
              prev.map((emp) =>
                  emp.groupNumber === selectedEmployee.groupNumber ? { ...emp, photo: null } : emp
              )
          );
          setSelectedEmployee((prev) => ({ ...prev, photo: null }));
          setPhoto('default-photo.png'); // 기본 이미지로 변경
      } catch (error) {
          console.error('사진 삭제 중 오류 발생:', error);
          alert('사진 삭제에 실패했습니다.');
      }
    };


  const handlePhotoUrlSave = async () => {
    if (photoUrl) {
        const imageUrl = extractImageUrl(photoUrl);
        if (imageUrl) {
            try {
                await axios.put(`/employee/${selectedEmployee.groupNumber}`, { photo: imageUrl });
                
                // 상태 업데이트
                setEmployees((prev) =>
                    prev.map((emp) =>
                        emp.groupNumber === selectedEmployee.groupNumber ? { ...emp, photo: imageUrl } : emp
                    )
                );
                setFilteredEmployees((prev) =>
                    prev.map((emp) =>
                        emp.groupNumber === selectedEmployee.groupNumber ? { ...emp, photo: imageUrl } : emp
                    )
                );
                setSelectedEmployee((prev) => ({ ...prev, photo: imageUrl }));
                setPhoto(imageUrl); // 사진 상태 즉시 업데이트
                setShowPhotoModal(false);
            } catch (error) {
                console.error('사진 URL 저장 중 오류 발생:', error);
                alert('사진 URL 저장에 실패했습니다.');
            }
        } else {
            alert('유효한 이미지 URL을 포함한 HTML 코드를 입력하세요.');
        }
    } else {
        alert('유효한 URL을 입력하세요.');
    }
};

  return (
    <div className="all-employees-container">
      <div className="search-form">
        <input
          type="text"
          placeholder="모든 내용을 검색할 수 있습니다."
          value={searchParam}
          onChange={handleSearchChange}
          onKeyPress={handleSearchKeyPress} // 엔터 키로 검색
        />
        <button onClick={handleSearch}>확인</button>
        <button onClick={handleResetSearch}>초기화</button> {/* 초기화 버튼 추가 */}
        <button onClick={handleExportToExcel}>엑셀 저장</button> {/* 엑셀 저장 버튼 추가 */}
      </div>

      {/* 사진 등록 모달 */}
      {showPhotoModal && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>사진 URL 입력</h3>
            <textarea
              placeholder="HTML 코드를 입력하세요 (예: <img src='URL' alt='설명'>)"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
            <button onClick={handlePhotoUrlSave}>저장</button>
            <button onClick={() => setShowPhotoModal(false)}>닫기</button>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <>
          <h3 className="selected-employee-title">선택된 작업자 정보</h3>
          <div className="selected-employee">
            <div className="photo-container">
              <div className="photo-box">
                <img 
                  src={photo || 'default-photo.png'} 
                  alt={`${selectedEmployee.name}의 사진`} 
                  className="selected-employee-photo" 
                />
              </div>
              <div className="photo-buttons">
    <button onClick={handlePhotoModalOpen} className="photo-upload-label">
        사진 등록
    </button>
    <button onClick={handlePhotoDelete} className="photo-delete-button">
        ×
    </button>
</div>
            </div>
            <div className="employee-info">
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegIdCard /> 조판번호</div>
                  <div className="info-content">{highlightText(selectedEmployee.groupNumber)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label"><FaRegUser /> 이름</div>
                  <div className="info-content">{highlightText(selectedEmployee.name)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegIdCard /> 주민번호(외국인)</div>
                  <div className="info-content">{highlightText(selectedEmployee.idNumber)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegCalendarAlt /> 입사일자</div>
                  <div className="info-content">
                    {selectedEmployee.hireDate || '정보 없음'}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label"><FaRegFlag /> 보증기간</div>
                  <div className="info-content">{highlightText(selectedEmployee.guaranteePeriod)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegFlag /> 국적</div>
                  <div className="info-content">{highlightText(selectedEmployee.nationality)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label"><FaRegFlag /> 체류</div>
                  <div className="info-content">{highlightText(selectedEmployee.residency)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegAddressCard /> 주소</div>
                  <div className="info-content">{highlightText(selectedEmployee.address)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaPhoneAlt /> 전화번호</div>
                  <div className="info-content">{highlightText(selectedEmployee.phoneNumber)}</div>
                </div>
              </div>
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegMoneyBillAlt /> 계좌번호</div>
                  <div className="info-content">{highlightText(selectedEmployee.accountNumber)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label"><FaRegUser /> 예금주</div>
                  <div className="info-content">{highlightText(selectedEmployee.accountHolder)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="employee-table" style={{ overflow: 'auto', maxHeight: '400px' }}>
        <table>
          <thead>
            <tr>
              <th>조판번호</th>
              <th>이름</th>
              <th>국적</th>
              <th>체류</th>
              <th>주민번호</th>
              <th>전화번호</th>
              <th>주소</th>
              <th>계좌번호</th>
              <th>예금주</th>
              <th>입사일자</th>
              <th>보증기간</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <tr key={employee.groupNumber} onClick={() => handleCardClick(employee)}>
                  <td data-label="조판번호" onDoubleClick={(e) => handleCellDoubleClick(employee, 'groupNumber', e)}>{highlightText(employee.groupNumber)}</td>
                  <td data-label="이름" onDoubleClick={(e) => handleCellDoubleClick(employee, 'name', e)}>{highlightText(employee.name)}</td>
                  <td data-label="국적" onDoubleClick={(e) => handleCellDoubleClick(employee, 'nationality', e)}>{highlightText(employee.nationality)}</td>
                  <td data-label="체류" onDoubleClick={(e) => handleCellDoubleClick(employee, 'residency', e)}>{highlightText(employee.residency)}</td>
                  <td data-label="주민번호" onDoubleClick={(e) => handleCellDoubleClick(employee, 'idNumber', e)}>{highlightText(employee.idNumber)}</td>
                  <td data-label="전화번호" onDoubleClick={(e) => handleCellDoubleClick(employee, 'phoneNumber', e)}>{highlightText(employee.phoneNumber)}</td>
                  <td data-label="주소" onDoubleClick={(e) => handleCellDoubleClick(employee, 'address', e)}>{highlightText(employee.address)}</td>
                  <td data-label="계좌번호" onDoubleClick={(e) => handleCellDoubleClick(employee, 'accountNumber', e)}>
                    {highlightText(employee.accountNumber)}
                    {employee.previousAccountNumber && employee.accountNumber !== employee.previousAccountNumber && !employee.isAccountNumberChecked && (
                      <button className="change-button" onClick={() => handleShowHistory(employee)}>변경됨</button>
                    )}
                  </td>
                  <td data-label="예금주" onDoubleClick={(e) => handleCellDoubleClick(employee, 'accountHolder', e)}>{highlightText(employee.accountHolder)}</td>
                  <td data-label="입사일자" onDoubleClick={(e) => handleCellDoubleClick(employee, 'hireDate', e)}>{highlightText(employee.hireDate)}</td>
                  <td data-label="보증기간" onDoubleClick={(e) => handleCellDoubleClick(employee, 'guaranteePeriod', e)}>{highlightText(employee.guaranteePeriod)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12">등록된 작업자가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccountHistoryModal
          history={accountHistory}
          onClose={() => setShowModal(false)}
          onDelete={handleDeleteHistory}
          onCheck={handleCheckAccountNumber}
        />
      )}
    </div>
  );
};

export default AllEmployees;
