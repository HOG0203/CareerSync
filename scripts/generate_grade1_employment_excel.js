const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const rawData = `
	1	바이오화학과	1	1	고원민	[ 취업역량강화 종합 ] 10점
① 취업진로교육참여 : -
② 취업역량강화반 : 10점
  ②-1 청솔반 및 취업반 참여 : 0점
  ②-2 전공심화동아리 : 6점
  ②-3 기능경기대회입상 : 4점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-3 기능경기대회입상 ] 지방기능경기대회 ( 2점 ) - 23	2026-07-10	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-3 기능경기대회입상 ] 지방기능경기대회 ( 2점 ) - 23	2026-07-03	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 ) - 23	2026-07-10	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 ) - 23	2026-07-10	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-1 청솔반 및 취업반 학기 참여 ] 1학기 참여 ( 점 ) - 123	2026-07-10	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-1 청솔반 및 취업반 학기 참여 ] 1학기 참여 ( 점 ) - 123	2026-07-09	수정 삭제	비엘관리자
 	 	 	 	 	 		[ ②-1 청솔반 및 취업반 학기 참여 ] 1학기 참여 ( 점 ) - 111111	2026-07-03	수정 삭제	비엘관리자
	1	친환경자동차과	1	3	김도현	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
	1	친환경자동차과	1	23	최유현	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
	1	친환경자동차과	2	7	김준희	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
	1	친환경자동차과	2	22	최승현	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
	1	자동화기계과	3	1	강태경	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
	1	자동화기계과	3	9	류종호	[ 취업역량강화 종합 ] 3점
① 취업진로교육참여 : -
② 취업역량강화반 : 3점
  ②-2 전공심화동아리 : 3점
③ 현장실습 참여 : -
 	 	 	 	 	 		[ ②-2 전공심화동아리 ] 1개 학년 ( 3점 )	2026-05-27	수정 삭제	관리자
`;

function parseRows(text) {
  const lines = text.split('\n');
  let currentStudent = null;
  const allParsedRows = [];

  for (let line of lines) {
    line = line.trimEnd();
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const cleanParts = parts.map(p => p.trim());
    const firstNonEmptyIdx = cleanParts.findIndex(p => p !== '');

    if (firstNonEmptyIdx !== -1 && (cleanParts[firstNonEmptyIdx] === '1' || cleanParts[firstNonEmptyIdx] === '2' || cleanParts[firstNonEmptyIdx] === '3')) {
      const g = parseInt(cleanParts[firstNonEmptyIdx], 10);
      const m = cleanParts[firstNonEmptyIdx + 1];
      const c = parseInt(cleanParts[firstNonEmptyIdx + 2], 10);
      const n = parseInt(cleanParts[firstNonEmptyIdx + 3], 10);
      const sName = cleanParts[firstNonEmptyIdx + 4];

      if (g && m && c && n && sName && !sName.includes('[')) {
        currentStudent = {
          grade: g,
          major: m,
          classNum: c,
          studentNum: n,
          name: sName
        };
      }
    }

    if (line.includes('[ ① 취업진로교육참여 ]') || line.includes('[ ②-1') || line.includes('[ ②-2') || line.includes('[ ②-3') || line.includes('[ ③-1') || line.includes('[ ③-2') || line.includes('[ ③-3') || line.includes('[ 취업확정 ]')) {
      if (!currentStudent) continue;

      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[') && (p.includes('취업진로교육') || p.includes('청솔반') || p.includes('전공심화') || p.includes('기능경기') || p.includes('도제') || p.includes('현장실습') || p.includes('취업'))) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      if (detailPart) {
        allParsedRows.push({
          ...currentStudent,
          detail: detailPart,
          date: datePart,
          writer: writerPart
        });
      }
    }
  }

  return allParsedRows;
}

async function createExcel() {
  const rows = parseRows(rawData);
  console.log(`Parsed total ${rows.length} detailed rows for 1st grade.`);

  const wb = new ExcelJS.Workbook();
  wb.creator = '옥저인재인증시스템';
  wb.created = new Date();

  // Style constants
  const fontDefault = { name: '맑은 고딕', size: 10 };
  const fontHeader = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  function applyTableStyles(sheet, headerColorArgb) {
    sheet.getRow(1).height = 28;
    sheet.getRow(1).font = fontHeader;
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColorArgb }
      };
      cell.border = thinBorder;
    });

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      row.height = 22;
      row.font = fontDefault;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      
      const isEven = r % 2 === 0;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = thinBorder;
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }
          };
        }
      });
    }
  }

  // 1. 시트: 취업진로코스
  const courseSheet = wb.addWorksheet('1.취업진로코스');
  courseSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '참여학기', key: 'term', width: 12 },
    { header: '코스명', key: 'courseName', width: 22 },
    { header: '비고', key: 'remarks', width: 26 }
  ];

  // 2. 시트: 산학교육이수
  const eduSheet = wb.addWorksheet('2.산학교육이수');
  eduSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '교육행사명', key: 'eduTitle', width: 46 },
    { header: '이수일자(또는 학기)', key: 'eduDate', width: 18 },
    { header: '비고', key: 'remarks', width: 16 }
  ];

  // 3. 시트: 전공심화동아리
  const clubSheet = wb.addWorksheet('3.전공심화동아리');
  clubSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '참여학년', key: 'joinGrade', width: 12 },
    { header: '동아리명', key: 'clubName', width: 24 },
    { header: '비고', key: 'remarks', width: 18 }
  ];

  // 4. 시트: 기능경기대회
  const contestSheet = wb.addWorksheet('4.기능경기대회');
  contestSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '대회구분', key: 'contestLevel', width: 18 },
    { header: '직종', key: 'job', width: 16 },
    { header: '입상내역', key: 'award', width: 16 },
    { header: '수상연도', key: 'year', width: 12 }
  ];

  // 5. 시트: 현장실습_도제_취업
  const fieldSheet = wb.addWorksheet('5.현장실습_도제_취업');
  fieldSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '구분', key: 'category', width: 16 },
    { header: '참여학기', key: 'term', width: 12 },
    { header: '업체명(기업명)', key: 'company', width: 28 },
    { header: '비고', key: 'remarks', width: 16 }
  ];

  // 6. 시트: 전체통합내역
  const summarySheet = wb.addWorksheet('전체통합내역');
  summarySheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 16 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '영역구분', key: 'category', width: 18 },
    { header: '상세실적내역', key: 'detail', width: 46 },
    { header: '학기/일자', key: 'dateOrTerm', width: 16 },
    { header: '등록자', key: 'writer', width: 12 }
  ];

  for (const r of rows) {
    const detail = r.detail;

    // A. 취업진로코스
    if (detail.includes('청솔반') || detail.includes('취업반')) {
      let courseName = '청솔반';
      if (detail.includes('123') || detail.includes('111111')) {
        courseName = '청솔반';
      }
      courseSheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        term: '1-1',
        courseName: courseName,
        remarks: `${r.date} (${r.writer})`
      });

      summarySheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        category: '취업진로코스',
        detail: courseName,
        dateOrTerm: '1-1',
        writer: r.writer
      });
    }
    // B. 전공심화동아리
    else if (detail.includes('전공심화동아리')) {
      clubSheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        joinGrade: '1개 학년',
        clubName: '전공심화동아리',
        remarks: `${r.date} (${r.writer})`
      });

      summarySheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        category: '전공심화동아리',
        detail: '전공심화동아리 (1개 학년)',
        dateOrTerm: r.date,
        writer: r.writer
      });
    }
    // C. 기능경기대회
    else if (detail.includes('기능경기대회')) {
      contestSheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        contestLevel: '지방기능경기대회',
        job: r.major,
        award: '입상',
        year: '2026'
      });

      summarySheet.addRow({
        grade: r.grade,
        major: r.major,
        classNum: r.classNum,
        studentNum: r.studentNum,
        name: r.name,
        category: '기능경기대회',
        detail: '지방기능경기대회 입상',
        dateOrTerm: r.date,
        writer: r.writer
      });
    }
  }

  // Apply colors and styling
  applyTableStyles(summarySheet, 'FF1E293B'); // Slate
  applyTableStyles(courseSheet, 'FF4F46E5');  // Indigo
  applyTableStyles(eduSheet, 'FF059669');     // Emerald
  applyTableStyles(clubSheet, 'FF7C3AED');    // Purple
  applyTableStyles(contestSheet, 'FFD97706'); // Amber
  applyTableStyles(fieldSheet, 'FFE11D48');   // Rose

  // Set alignments
  [courseSheet, eduSheet, clubSheet, contestSheet, fieldSheet, summarySheet].forEach(ws => {
    ws.columns.forEach((col, cIdx) => {
      const header = String(col.header || '');
      if (header.includes('명') || header.includes('내역') || header.includes('비고') || header.includes('업체')) {
        for (let r = 2; r <= ws.rowCount; r++) {
          ws.getRow(r).getCell(cIdx + 1).alignment = { vertical: 'middle', horizontal: 'left' };
        }
      }
    });
  });

  const publicOutPath = path.join(__dirname, '..', 'public', '2026학년도_1학년_취업역량_산학교육_실적명단.xlsx');
  const rootOutPath = path.join(__dirname, '..', '2026학년도_1학년_취업역량_산학교육_실적명단.xlsx');

  await wb.xlsx.writeFile(publicOutPath);
  await wb.xlsx.writeFile(rootOutPath);

  console.log(`1st grade Excel created successfully!`);
  console.log(`- ${publicOutPath}`);
  console.log(`- ${rootOutPath}`);
}

createExcel();
