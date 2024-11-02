import ExcelJS from 'exceljs';

/**
 * 직원 정보를 엑셀 파일로 내보내는 함수
 * @param {Array} employees - 직원 정보 배열
 */
export const exportEmployeesToExcel = async (employees) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('직원 정보');

  worksheet.columns = [
    { header: '조판번호', key: 'groupNumber', width: 15 },
    { header: '이름', key: 'name', width: 30 },
    { header: '국적', key: 'nationality', width: 15 },
    { header: '체류', key: 'residency', width: 15 },
    { header: '주민번호', key: 'idNumber', width: 25 },
    { header: '전화번호', key: 'phoneNumber', width: 20 },
    { header: '주소', key: 'address', width: 60 },
    { header: '계좌번호', key: 'accountNumber', width: 30 },
    { header: '예금주', key: 'accountHolder', width: 20 },
    { header: '입사일자', key: 'hireDate', width: 20 },
    { header: '보증기간', key: 'guaranteePeriod', width: 20 },
  ];

  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).alignment = { horizontal: 'center' };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' },
  };

  employees.forEach((employee, index) => {
    const row = worksheet.addRow({
      groupNumber: employee.groupNumber,
      name: employee.name,
      nationality: employee.nationality,
      residency: employee.residency,
      idNumber: employee.idNumber,
      phoneNumber: employee.phoneNumber,
      address: employee.address,
      accountNumber: employee.accountNumber,
      accountHolder: employee.accountHolder,
      hireDate: employee.hireDate,
      guaranteePeriod: employee.guaranteePeriod,
    });

    if (index % 3 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEBF1DE' },
      };
    }

    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
     
    });
  });

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
