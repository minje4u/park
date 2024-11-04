import ExcelJS from 'exceljs';

export const exportEmployeesToExcel = async (employees) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('직원 정보');

  // 보증기간으로 정렬
  const sortedEmployees = [...employees].sort((a, b) => {
    if (!a.guaranteePeriod) return 1;
    if (!b.guaranteePeriod) return -1;
    return new Date(a.guaranteePeriod) - new Date(b.guaranteePeriod);
  });

  // 헤더 설정
  worksheet.columns = [
    { header: '조판번호', key: 'groupNumber', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '이름', key: 'name', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '국적', key: 'nationality', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '체류', key: 'residency', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '주민번호', key: 'idNumber', width: 20, style: { alignment: { horizontal: 'center' } } },
    { header: '전화번호', key: 'phoneNumber', width: 20, style: { alignment: { horizontal: 'center' } } },
    { header: '주소', key: 'address', width: 60, style: { alignment: { horizontal: 'center' } } },
    { header: '은행', key: 'bank', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '계좌번호', key: 'accountNumber', width: 25, style: { alignment: { horizontal: 'center' } } },
    { header: '예금주', key: 'accountHolder', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '입사일자', key: 'hireDate', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '보증기간', key: 'guaranteePeriod', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '퇴사일자', key: 'resignationDate', width: 15, style: { alignment: { horizontal: 'center' } } },
    { header: '재직상태', key: 'employmentstatus', width: 15, style: { alignment: { horizontal: 'center' } } },
  ];

  // 헤더 스타일 설정
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' },
  };

  // 정렬 기능 추가
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length }
  };

  // 보증기간 체크 함수
  const checkGuaranteePeriod = (guaranteePeriod) => {
    if (!guaranteePeriod) return 'normal';
    
    const today = new Date();
    const guarantee = new Date(guaranteePeriod);
    const threeMothsBeforeGuarantee = new Date(guarantee);
    threeMothsBeforeGuarantee.setMonth(guarantee.getMonth() - 3);

    if (today > guarantee) {
      return 'expired';
    } else if (today > threeMothsBeforeGuarantee) {
      return 'warning';
    }
    return 'normal';
  };

  // 정렬된 데이터 추가
  sortedEmployees.forEach((employee, index) => {
    const row = worksheet.addRow({
      groupNumber: employee.groupNumber,
      name: employee.name,
      nationality: employee.nationality,
      residency: employee.residency,
      idNumber: employee.idNumber,
      phoneNumber: employee.phoneNumber,
      address: employee.address,
      bank: employee.bank,
      accountNumber: employee.accountNumber,
      accountHolder: employee.accountHolder,
      hireDate: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ko-KR') : '',
      guaranteePeriod: employee.guaranteePeriod ? new Date(employee.guaranteePeriod).toLocaleDateString('ko-KR') : '',
      resignationDate: employee.resignationDate ? new Date(employee.resignationDate).toLocaleDateString('ko-KR') : '',
      employmentstatus: employee.resignationDate ? '퇴사' : '근무중',
    });

    // 보증기간 상태에 따른 전체 행 스타일 적용
    const guaranteePeriodStatus = checkGuaranteePeriod(employee.guaranteePeriod);
    
    if (guaranteePeriodStatus === 'expired') {
      // 만료된 경우 전체 행을 빨간색 배경으로
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF9999' }  // 연한 빨간색
        };
      });
      // 보증기간 셀은 더 진한 빨간색으로
      const guaranteePeriodCell = row.getCell('guaranteePeriod');
      guaranteePeriodCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' }  // 진한 빨간색
      };
    } else if (guaranteePeriodStatus === 'warning') {
      // 경고인 경우 전체 행을 주황색 배경으로
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFD699' }  // 연한 주황색
        };
      });
      // 보증기간 셀은 더 진한 주황색으로
      const guaranteePeriodCell = row.getCell('guaranteePeriod');
      guaranteePeriodCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFA500' }  // 진한 주황색
      };
    } else {
      // 정상인 경우 기존의 줄무늬 효과 적용
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEBF1DE' },
          };
        });
      }
    }

    // 셀 정렬 설정
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });

  // 첫 번째 행 고정
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // 엑셀 파일 저장
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '직원정보.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
};