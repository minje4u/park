import ExcelJS from 'exceljs';

export const exportToExcel = async (workStatistics, selectedYear, datesWithData, fileName) => {
  const workbook = new ExcelJS.Workbook();

  try {
    console.log('Selected Year:', selectedYear.getFullYear());
    for (const [yearMonth, monthData] of Object.entries(workStatistics)) {
      const [year, month] = yearMonth.split('-');
      const yearInt = parseInt(year);
      console.log('Processing year:', yearInt);
      if (yearInt === selectedYear.getFullYear()) {
        console.log('Creating worksheet for:', yearMonth);
        const worksheet = workbook.addWorksheet(`${month}월`);
        await addDataToWorksheet(worksheet, { [yearMonth]: monthData }, new Date(year, month - 1), datesWithData, yearMonth);
      }
    }

    if (workbook.worksheets.length === 0) {
      console.error('No worksheets created. Check if selectedYear matches any data.');
      throw new Error('선택한 연도의 데이터가 없습니다.');
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const userFileName = prompt("저장할 파일 이름을 입력하세요:", fileName);
    const finalFileName = userFileName || fileName;

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${finalFileName}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(link.href);
    console.log('파일이 성공적으로 저장되었습니다:', finalFileName);
  } catch (error) {
    console.error('엑셀 파일 생성 중 오류 발생:', error);
    throw error;
  }
};

const addDataToWorksheet = async (worksheet, data, selectedMonth, datesWithData, yearMonth) => {
  const monthData = Object.values(data)[0];

  // 데이터가 있는 날짜 추출
  const datesWithActualData = monthData.reduce((acc, item) => {
    const day = new Date(item.date).getUTCDate();
    if (!acc.includes(day)) {
      acc.push(day);
    }
    return acc;
  }, []).sort((a, b) => a - b);

  // 스타일 정의
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  const dataStyle = {
    font: { size: 10 },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  // 최상단에 년월 추가
  worksheet.mergeCells('A1:B1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = yearMonth;
  titleCell.style = {
    font: { bold: true, size: 14 },
    alignment: { vertical: 'middle', horizontal: 'center' }
  };

  // 헤더 추가
  const headers = ['조판번호', '이름', ...datesWithActualData.map(day => `${day}일`), '합계', '도급비용'];
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // 데이터 추가
  const employeeData = {};
  monthData.forEach(item => {
    if (!employeeData[item.groupNumber]) {
      employeeData[item.groupNumber] = {
        groupNumber: item.groupNumber,
        name: item.employeeName,
        weights: {},
        sum: 0,
        pay: 0
      };
    }
    const day = new Date(item.date).getUTCDate();
    employeeData[item.groupNumber].weights[day] = item.weight;
    employeeData[item.groupNumber].sum += item.weight;
    employeeData[item.groupNumber].pay += item.weight * 270;
  });

  Object.values(employeeData).forEach(employee => {
    const rowData = [
      employee.groupNumber,
      employee.name,
      ...datesWithActualData.map(day => employee.weights[day] ? employee.weights[day].toFixed(1) : '-'),
      `${employee.sum.toFixed(1)} kg`,
      employee.pay
    ];
    const dataRow = worksheet.addRow(rowData);
    dataRow.eachCell((cell, colNumber) => {
      cell.style = dataStyle;
      if (colNumber === 2 || colNumber === dataRow.cellCount) { // 이름과 도급비용 열
        cell.font = { ...cell.font, bold: true };
      }
      if (colNumber === dataRow.cellCount) {
        cell.numFmt = '#,##0"원"';
      }
    });
  });

  // 열 너비 설정
  worksheet.getColumn(1).width = 10; // 조판번호
  worksheet.getColumn(2).width = 15; // 이름
  datesWithActualData.forEach((_, index) => {
    worksheet.getColumn(index + 3).width = 13.5; // 날짜별 중량 및 도급비용
  });
  worksheet.getColumn(worksheet.columnCount - 1).width = 12; // 합계
  worksheet.getColumn(worksheet.columnCount).width = 15; // 도급비용

  // 합계 행 추가 (중량과 도급비용을 함께 표시)
  const totalWeights = datesWithActualData.map(day => 
    Object.values(employeeData).reduce((sum, emp) => sum + (emp.weights[day] || 0), 0)
  );
  const totalPays = totalWeights.map(weight => weight * 270);
  
  const totalRow = worksheet.addRow([
    '합계',
    '',
    ...datesWithActualData.map((_, index) => `${totalWeights[index].toFixed(1)}kg\n${totalPays[index].toLocaleString()}원`),
    `${Object.values(employeeData).reduce((sum, emp) => sum + emp.sum, 0).toFixed(1)}kg`,
    Object.values(employeeData).reduce((sum, emp) => sum + emp.pay, 0)
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.style = { 
      ...headerStyle, 
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } },
      font: { bold: true, color: { argb: 'FF000000' }, size: 9 },
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
    };
  
    if (colNumber > 2 && colNumber < totalRow.cellCount - 1) {
      try {
        const [weightText, payText] = String(cell.value).split('\n');
        cell.value = {
          richText: [
            {text: weightText + '\n', font: {size: 8, bold: true}},
            {text: payText || '', font: {size: 9, bold: true}}
          ]
        };
      } catch (error) {
        console.error('Error processing cell:', error);
        cell.value = String(cell.value);
      }
    } else if (colNumber === totalRow.cellCount - 1) {
      // 중량 총합계 셀
      cell.font = { bold: true, size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNumber === totalRow.cellCount) {
      // 도급비 총합계 셀
      cell.numFmt = '#,##0"원"';
      cell.font = { bold: true, size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  // 행 높이 조정
  totalRow.height = 30; // 행 높이를 조정하여 두 줄의 텍스트가 잘 보이도록 함

  // 조건부 서식 추가 (0인 셀 회색 배경)
  worksheet.addConditionalFormatting({
    ref: `C3:${worksheet.getColumn(worksheet.columnCount - 2).letter}${worksheet.rowCount - 2}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'equal',
        formulae: ['0'],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD9D9D9' } } }
      }
    ]
  });

  // 이름행과 헤더 열 고정
  worksheet.views = [
    { state: 'frozen', xSplit: 2, ySplit: 2, topLeftCell: 'C3', activeCell: 'A1' }
  ];

  // 정렬 기능 추가
  worksheet.autoFilter = {
    from: 'A2',
    to: {
      row: 2,
      column: worksheet.columnCount
    }
  };
};