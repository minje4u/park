import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AllEmployees.css';
import AccountHistoryModal from './AccountHistoryModal';
import { FaRegCalendarAlt, FaRegIdCard, FaRegUser, FaRegFlag, FaPhoneAlt, FaRegAddressCard, FaRegMoneyBillAlt } from 'react-icons/fa';
import { exportEmployeesToExcel } from './EmployeeExport'; // 새로운 엑셀 내보내기 함수 import
import * as XLSX from 'xlsx'; // 엑셀 파일 처리를 위해 XLSX 라이브러리 사용
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




  
  // useEffect 수정 - 데이터 fetch 후 정렬 적용
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get('/employees');
        const sortedEmployees = sortByGuaranteePeriod(response.data);
        setEmployees(sortedEmployees);
        setFilteredEmployees(sortedEmployees);
        if (sortedEmployees.length > 0) {
          setSelectedEmployee(sortedEmployees[0]);
          setPhoto(sortedEmployees[0].photo || 'default-photo.png');
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
      (employee.employmentstatus && employee.employmentstatus.includes(searchParam)) ||
      (employee.bank && employee.bank.includes(searchParam)) ||
      (employee.resignationDate && employee.resignationDate.includes(searchParam)) ||
      (employee.accountHolder && employee.accountHolder.includes(searchParam))

      
      
      

    );
    const sortedFiltered = sortByGuaranteePeriod(filtered);
    setFilteredEmployees(sortedFiltered);
    // 검색 결과가 없으면 선택된 직원 초기화
    if (sortedFiltered.length === 0) {
      setSelectedEmployee(null);
    } else {
      setSelectedEmployee(sortedFiltered[0]);
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

  // 보증기간 상태를 체크하는 함수 추가
  const checkGuaranteePeriod = (guaranteePeriod) => {
    if (!guaranteePeriod) return 'normal';
    
    const today = new Date();
    const guarantee = new Date(guaranteePeriod);
    const threeMothsBeforeGuarantee = new Date(guarantee);
    threeMothsBeforeGuarantee.setMonth(guarantee.getMonth() - 3);

    if (today > guarantee) {
      return 'expired'; // 보증기간 만료
    } else if (today > threeMothsBeforeGuarantee) {
      return 'warning'; // 보증기간 3개월 이내
    }
    return 'normal';
  };

  const handleCellDoubleClick = (employee, field, event) => {
    const cell = event.currentTarget;
    const originalValue = employee[field];

    // 이미 활성화된 input이 있다면 원래 값으로 복원하고 제거
    if (activeInput) {
      const activeCell = activeInput.parentElement;
      if (activeCell) {
        if (activeInput.type === 'date') {
          // 유효한 날짜인지 확인
          const originalDate = originalValue ? new Date(originalValue) : null;
          activeCell.innerHTML = originalDate && !isNaN(originalDate) 
            ? originalDate.toLocaleDateString('ko-KR') 
            : originalValue || '';
        } else {
          activeCell.innerHTML = activeInput.defaultValue || '';
        }
      }
      setActiveInput(null);
    }

    const input = document.createElement('input');
    
    // 보증기간과 입사일자, 퇴사일자는 date 타입으로 설정
    if (field === 'guaranteePeriod' || field === 'hireDate' || field === 'resignationDate') {
      input.type = 'date';
      if (employee[field]) {
        const date = new Date(employee[field]);
        // 유효한 날짜인 경우에만 date input 값 설정
        if (!isNaN(date)) {
          input.value = date.toISOString().split('T')[0];
          input.defaultValue = input.value;
        } else {
          input.value = '';
          input.defaultValue = '';
        }
      }

      input.addEventListener('change', async () => {
        try {
          let updatedData = { [field]: input.value || null }; // 빈 값 시 null 처리
          const selectedDate = input.value ? new Date(input.value) : null;
          updatedData[field] = selectedDate ? selectedDate.toISOString().split('T')[0] : null;

          // 퇴사일자 처리
          if (field === 'resignationDate') {
            const newStatus = input.value ? '퇴사' : '근무중';
            updatedData = {
              ...updatedData,
              employmentstatus: newStatus
            };
          }

          const response = await axios.put(`/employee/${employee.groupNumber}`, updatedData);
          if (response.status === 200) {
            setEmployees((prev) =>
              prev.map((emp) => {
                if (emp.groupNumber === employee.groupNumber) {
                  return {
                    ...emp,
                    [field]: updatedData[field],
                    ...(field === 'resignationDate' && {
                      employmentstatus: input.value ? '퇴사' : '근무중'
                    })
                  };
                }
                return emp;
              })
            );
            setFilteredEmployees((prev) =>
              prev.map((emp) => {
                if (emp.groupNumber === employee.groupNumber) {
                  return {
                    ...emp,
                    [field]: updatedData[field],
                    ...(field === 'resignationDate' && {
                      employmentstatus: input.value ? '퇴사' : '근무중'
                    })
                  };
                }
                return emp;
              })
            );
          }

          cell.innerHTML = selectedDate ? selectedDate.toLocaleDateString('ko-KR') : '';
          setActiveInput(null);

        } catch (error) {
          console.error('수정된 내용을 저장하는 데 실패했습니다:', error);
          const originalDate = originalValue ? new Date(originalValue) : null;
          cell.innerHTML = originalDate && !isNaN(originalDate)
            ? originalDate.toLocaleDateString('ko-KR')
            : originalValue || '';
          setActiveInput(null);
        }
      });

      input.addEventListener('blur', () => {
        if (!input.value || input.value === input.defaultValue) {
          const originalDate = originalValue ? new Date(originalValue) : null;
          cell.innerHTML = originalDate && !isNaN(originalDate)
            ? originalDate.toLocaleDateString('ko-KR')
            : originalValue || '';
          setActiveInput(null);
        }
      });
    } else {
      input.type = 'text';
      input.value = employee[field] || '';
      input.defaultValue = input.value;

      input.onblur = async () => {
        if (!input.value) {
          input.value = null; // 비어있을 때 null 처리
        }
        if (input.value === null || input.value === input.defaultValue) {
          cell.innerHTML = originalValue || '';
        } else {
          try {
            let updatedData = { [field]: input.value || null };

            if (field === 'resignationDate') {
              const newStatus = input.value ? '퇴사' : '근무중';
              updatedData = {
                ...updatedData,
                employmentstatus: newStatus
              };
            }

            const response = await axios.put(`/employee/${employee.groupNumber}`, updatedData);
            if (response.status === 200) {
              setEmployees((prev) =>
                prev.map((emp) => {
                  if (emp.groupNumber === employee.groupNumber) {
                    return {
                      ...emp,
                      [field]: updatedData[field],
                      ...(field === 'resignationDate' && {
                        employmentstatus: input.value ? '퇴사' : '근무중'
                      })
                    };
                  }
                  return emp;
                })
              );
              setFilteredEmployees((prev) =>
                prev.map((emp) => {
                  if (emp.groupNumber === employee.groupNumber) {
                    return {
                      ...emp,
                      [field]: updatedData[field],
                      ...(field === 'resignationDate' && {
                        employmentstatus: input.value ? '퇴사' : '근무중'
                      })
                    };
                  }
                  return emp;
                })
              );
            }
            cell.innerHTML = input.value || '';
          } catch (error) {
            console.error('수정된 내용을 저장하는 데 실패했습니다:', error);
            cell.innerHTML = originalValue || '';
          }
        }
        setActiveInput(null);
      };
    }

    input.className = 'editable-input';
    input.style.width = `${Math.max(input.value.length * 8, 100)}px`;

    const adjustInputWidth = () => {
      input.style.width = `${Math.max(input.scrollWidth, 100)}px`;
    };
    input.addEventListener('input', adjustInputWidth);

    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    };

    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    setActiveInput(input);
  };

  // 날짜 표시 형식을 위한 헬퍼 함수
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
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

    if (accountHistory.length === 1) {
      setSelectedEmployee((prev) => ({ ...prev, previousAccountNumber: null }));
    }
  };

 
  const handlePhotoModalOpen = () => {
    setShowPhotoModal(true);
  };

  const handlePhotoDelete = async () => {
    if (!window.confirm('사진을 삭제하시겠습니까?')) {
        return;
    }
    
    if (!window.confirm('정말로 삭제하시겠습니까?')) {
        return;
    }

    try {
        await axios.put(`/employee/${selectedEmployee.groupNumber}`, { photo: null });
        
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

  const getEmploymentStatus = (resignationDate) => {
    return resignationDate ? '퇴사' : '근무중';
  };

  const sortByGuaranteePeriod = (employees) => {
    return [...employees].sort((a, b) => {
      if (!a.guaranteePeriod) return 1;
      if (!b.guaranteePeriod) return -1;

      const today = new Date();
      const guaranteeA = new Date(a.guaranteePeriod);
      const guaranteeB = new Date(b.guaranteePeriod);
      const daysLeftA = Math.ceil((guaranteeA - today) / (1000 * 60 * 60 * 24));
      const daysLeftB = Math.ceil((guaranteeB - today) / (1000 * 60 * 60 * 24));

      return daysLeftA - daysLeftB;
    });
  };

  const handlePhotoUrlSave = async () => {
    if (photoUrl) {
        const imageUrl = extractImageUrl(photoUrl);
        if (imageUrl) {
            try {
                await axios.put(`/employee/${selectedEmployee.groupNumber}`, { photo: imageUrl });
                
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

  // 엑셀 파일 업로드 및 데이터 처리 함수
  const handleExcelUpload = async (event) => {
    try {
      const file = event.target.files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);

          const processedData = data.map(row => ({
            groupNumber: row['조판번호'],
            name: row['이름'],
            nationality: row['국적'],
            residency: row['체류'],
            idNumber: row['주민번호'],
            phoneNumber: row['전화번호'],
            address: row['주소'],
            bank: row['은행'],
            accountNumber: row['계좌번호'],
            accountHolder: row['예금주'],
            hireDate: row['입사일자'] ? new Date(row['입사일자']).toISOString().slice(0, 10) : null,
            guaranteePeriod: row['보증기간'] ? new Date(row['보증기간']).toISOString().slice(0, 10) : null,
            resignationDate: row['퇴사일자'] ? new Date(row['퇴사일자']).toISOString().slice(0, 10) : null,


            employmentstatus: row['재직상태']
          }));

          const response = await axios.post('/employees/bulk-update', processedData);
          if (response.status === 200) {
            alert('엑셀 데이터를 통해 데이터베이스가 업데이트되었습니다.');
            setEmployees(response.data);
            setFilteredEmployees(response.data);
          }
        } catch (error) {
          console.error('엑셀 파일 처리 중 오류 발생:', error);
          alert('엑셀 파일 처리 중 오류가 발생했습니다.');
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('파일 업로드 중 오류 발생:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    }
  };



  const handleExportToExcel = () => {
    exportEmployeesToExcel(filteredEmployees); // 새로운 함수 호출
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
       
         {/* 엑셀 업로드 버튼 추가 */}
  <div className="excel-upload">
    <input
      type="file"
      accept=".xlsx, .xls"
      onChange={handleExcelUpload}
      style={{ display: 'none' }}
      id="excel-upload-input"
    />
    <label htmlFor="excel-upload-input" className="excel-upload-button">
    업로드
    </label>
  </div>
</div>
       
      
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
                <div className="info-item">
                  <div className="info-label"><FaRegUser /> 재직상태</div>
                  <div className="info-content">
                    {getEmploymentStatus(selectedEmployee.resignationDate)}
                  </div>
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
                <div className="info-item">
                  <div className="info-label"><FaRegCalendarAlt /> 퇴사일자</div>
                  <div className="info-content">
                    {selectedEmployee.resignationDate ? highlightText(selectedEmployee.resignationDate) : '근무중'}
                  </div>
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
                  <div className="info-label"><FaRegIdCard /> 주민번호(외국인)</div>
                  <div className="info-content">{highlightText(selectedEmployee.idNumber)}</div>
                </div>

                <div className="info-item">
                  <div className="info-label"><FaPhoneAlt /> 전화번호</div>
                  <div className="info-content">{highlightText(selectedEmployee.phoneNumber)}</div>
                </div>
              </div>
              
              <div className="info-pair">
                <div className="info-item">
                  <div className="info-label"><FaRegMoneyBillAlt /> 은행</div>
                  <div className="info-content">{highlightText(selectedEmployee.bank)}</div>
                </div>
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
              <th>은행</th>
              <th>계좌번호</th>
              <th>예금주</th>
              <th>입사일자</th>
              <th>보증기간</th>
              <th>퇴사일자</th>
              <th>재직상태</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <tr 
                    key={employee.groupNumber} 
                    onClick={() => handleCardClick(employee)}
                    className={`guarantee-${checkGuaranteePeriod(employee.guaranteePeriod)}-row`}
                  >

                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'groupNumber', e)}
                  data-field="groupNumber">
                    {highlightText(employee.groupNumber)}</td>

                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'name', e)}>{highlightText(employee.name)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'nationality', e)}>{highlightText(employee.nationality)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'residency', e)}>{highlightText(employee.residency)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'idNumber', e)}>{highlightText(employee.idNumber)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'phoneNumber', e)}>{highlightText(employee.phoneNumber)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'address', e)}>{highlightText(employee.address)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'bank', e)}>{highlightText(employee.bank)}</td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'accountNumber', e)}>
                    
                    {highlightText(employee.accountNumber)}
                    {employee.previousAccountNumber && employee.accountNumber !== employee.previousAccountNumber && !employee.isAccountNumberChecked && (
                      <button className="change-button" onClick={() => handleShowHistory(employee)}>변경됨</button>
                    )}
                  </td>
                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'accountHolder', e)}>{highlightText(employee.accountHolder)}</td>
                  <td 
                      onDoubleClick={(e) => handleCellDoubleClick(employee, 'hireDate', e)}
                      data-field="hireDate"
                    >
                      {highlightText(formatDate(employee.hireDate))}
                    </td>
                  
                  <td 
                  onDoubleClick={(e) => handleCellDoubleClick(employee, 'guaranteePeriod', e)}>{highlightText(formatDate(employee.guaranteePeriod))}</td>

                  <td 
                    onDoubleClick={(e) => handleCellDoubleClick(employee, 'resignationDate', e)}
                    data-field="resignationDate"
                  >
                    {highlightText(formatDate(employee.resignationDate))}
                  </td>

                  <td onDoubleClick={(e) => handleCellDoubleClick(employee, 'employmentstatus', e)}>
                    {highlightText(getEmploymentStatus(employee.resignationDate))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="13">등록된 작업자가 없습니다.</td>
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
