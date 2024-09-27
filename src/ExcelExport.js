import ExcelJS from 'exceljs';

export const exportToExcel = async (workStatistics, selectedMonth, datesWithData, exportPath, isAllData = false) => {
  const workbook = new ExcelJS.Workbook();

  if (isAllData) {
    // 전체 데이터 처리
    for (const [yearMonth, monthData] of Object.entries(workStatistics)) {
      const [year, month] = yearMonth.split('-');
      const worksheet = workbook.addWorksheet(`${month}월`);
      await addDataToWorksheet(worksheet, monthData, new Date(year, month - 1), datesWithData);
    }
  } else {
    // 선택된 월의 데이터 처리
    const worksheet = workbook.addWorksheet(`${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth() + 1}월`);
    await addDataToWorksheet(worksheet, workStatistics, selectedMonth, datesWithData);
  }

  // 파일 저장
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const fileName = `${selectedMonth.getFullYear()}년_작업내역_${timestamp}.xlsx`;

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Excel Files',
          accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']}
        }],
        excludeAcceptAllOption: true
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log('파일이 성공적으로 저장되었습니다:', fileName);
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }
  } catch (error) {
    console.error('파일 저장 중 오류 발생:', error);
    throw error;
  }
};

const addDataToWorksheet = async (worksheet, data, selectedMonth, datesWithData) => {
  console.log('Worksheet data:', data);
  console.log('Dates with data:', datesWithData);

  if (!data || typeof data !== 'object') {
    console.error('Invalid data structure:', data);
    return;
  }

  // 데이터가 있는 날짜만 추출
  let datesWithActualData = Object.keys(data).reduce((acc, groupNumber) => {
    Object.keys(data[groupNumber].중량).forEach(day => {
      const dayNumber = parseInt(day);
      if (!acc.includes(dayNumber) && data[groupNumber].중량[day] > 0) {
        acc.push(dayNumber);
      }
    });
    return acc;
  }, []).sort((a, b) => a - b);

  // datesWithActualData가 비어있는 경우 처리
  if (datesWithActualData.length === 0) {
    datesWithActualData = Object.keys(data).reduce((acc, groupNumber) => {
      Object.keys(data[groupNumber].중량).forEach(day => {
        if (!acc.includes(parseInt(day))) {
          acc.push(parseInt(day));
        }
      });
      return acc;
    }, []).sort((a, b) => a - b);
  }

  // 해당 년월 추가
  const yearMonth = `${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth() + 1}월`;
  worksheet.mergeCells('A1:B1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = yearMonth;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // 헤더 추가
  const headers = ['조판번호', '작업자명', ...datesWithActualData.map(day => `${day}일`), '중량합계', '도급'];
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    cell.font = { color: { argb: 'FFFFFFFF' } };
  });

  // 헤더 행 고정 및 작업자명 열 고정
  worksheet.views = [
    {
      state: 'frozen',
      xSplit: 2,
      ySplit: 2,
      topLeftCell: 'C3',
      activeCell: 'A1'
    }
  ];

  // 정렬 기능 추가
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.protection = { locked: false };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const colLetter = String.fromCharCode(65 + index);
    worksheet.addConditionalFormatting({
      ref: `${colLetter}2:${colLetter}${worksheet.rowCount}`,
      rules: [
        {
          type: 'expression',
          formulae: [`SUBTOTAL(3,${colLetter}3:${colLetter}${worksheet.rowCount})=0`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } } }
        }
      ]
    });
  });

  // 데이터 처리
  const monthData = Object.entries(data).map(([groupNumber, employeeData]) => {
    if (!employeeData || typeof employeeData !== 'object') {
      console.error('Invalid employee data structure:', employeeData);
      return null;
    }
    return {
      groupNumber,
      name: employeeData.employeeName,
      중량: employeeData.중량 || {},
      sum: Object.values(employeeData.중량 || {}).reduce((sum, weight) => sum + weight, 0),
      pay: Object.values(employeeData.중량 || {}).reduce((sum, weight) => sum + weight * 270, 0)
    };
  }).filter(Boolean);

  // 데이터 추가
  monthData.forEach((item, index) => {
    const rowData = [
      item.groupNumber,
      item.name,
      ...datesWithActualData.map(day => {
        const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
        return (date.getMonth() === selectedMonth.getMonth() && item.중량[day]) ? item.중량[day].toFixed(1) : '-';
      }),
      item.sum.toFixed(1) + ' kg',
      new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(item.pay)
    ];
    const row = worksheet.addRow(rowData);
    row.alignment = { horizontal: 'center', vertical: 'middle' };

    if (index % 6 < 3) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      });
    }
  });

  // 총합계 행 추가
  const totalRow = worksheet.addRow(['총합계']);
  worksheet.mergeCells(`A${worksheet.rowCount}:B${worksheet.rowCount}`);
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // 일별 총합계
  datesWithActualData.forEach((day, index) => {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
    if (date.getMonth() === selectedMonth.getMonth()) {
      const dailyTotal = monthData.reduce((sum, item) => sum + (item.중량[day] || 0), 0);
      const dailyPay = monthData.reduce((sum, item) => sum + (item.중량[day] ? item.중량[day] * 270 : 0), 0);
      totalRow.getCell(index + 3).value = `${dailyTotal.toFixed(1)}kg\n${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(dailyPay)}`;
      totalRow.getCell(index + 3).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    }
  });

  // 월별 총합계
  const monthlyTotal = monthData.reduce((sum, item) => sum + item.sum, 0);
  const monthlyPay = monthData.reduce((sum, item) => sum + item.pay, 0);
  totalRow.getCell(datesWithActualData.length + 3).value = `${monthlyTotal.toFixed(1)} kg`;
  totalRow.getCell(datesWithActualData.length + 4).value = `${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(monthlyPay)}`;

  totalRow.getCell(datesWithActualData.length + 3).alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell(datesWithActualData.length + 4).alignment = { horizontal: 'center', vertical: 'middle' };

  // 열 너비 자동 조정
  worksheet.columns.forEach(column => {
    column.width = 15;
  });

  // 정렬을 위한 테이블 생성
  worksheet.addTable({
    name: `Table${selectedMonth.getMonth() + 1}`,
    ref: `A2:${String.fromCharCode(65 + headers.length - 1)}${worksheet.rowCount - 1}`,
    columns: headers.map(header => ({ name: header, filterButton: true })),
    rows: monthData.map(item => [
      item.groupNumber,
      item.name,
      ...datesWithActualData.map(day => {
        const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
        return (date.getMonth() === selectedMonth.getMonth() && item.중량[day]) ? item.중량[day].toFixed(1) : '-';
      }),
      item.sum.toFixed(1) + ' kg',
      new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(item.pay)
    ]),
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
  });
};