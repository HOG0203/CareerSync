const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const grade3Script = fs.readFileSync(path.join(__dirname, 'generate_employment_excel.js'), 'utf8');
const grade2Script = fs.readFileSync(path.join(__dirname, 'generate_grade2_employment_excel.js'), 'utf8');
const grade1Script = fs.readFileSync(path.join(__dirname, 'generate_grade1_employment_excel.js'), 'utf8');

function extractRawData(scriptContent) {
  const match = scriptContent.match(/const rawData = `([\s\S]*?)`;/);
  return match ? match[1] : '';
}

const rawGrade3 = extractRawData(grade3Script);
const rawGrade2 = extractRawData(grade2Script);
const rawGrade1 = extractRawData(grade1Script);

function parseEmploymentData(text, targetGrade) {
  const lines = text.split('\n');
  let currentStudent = null;

  const rowsAll = [];
  const rowsCourse = [];
  const rowsEdu = [];
  const rowsClub = [];
  const rowsContest = [];
  const rowsField = [];

  for (let line of lines) {
    line = line.trimEnd();
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const cleanParts = parts.map(p => p.trim());
    const firstNonEmptyIdx = cleanParts.findIndex(p => p !== '');

    if (firstNonEmptyIdx !== -1 && ['1', '2', '3'].includes(cleanParts[firstNonEmptyIdx])) {
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

    if (!currentStudent) continue;
    const grade = currentStudent.grade || targetGrade;

    // ① 산학교육 (취업진로교육참여)
    if (line.includes('[ ① 취업진로교육참여 ]')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ① 취업진로교육참여 ]')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let eventTitle = detailPart.replace(/^\[\s*①\s*취업진로교육참여\s*\]\s*/, '').trim();
      if (eventTitle.includes(' - ')) {
        eventTitle = eventTitle.split(' - ')[1].trim();
      }

      rowsEdu.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        title: eventTitle,
        date: datePart,
        remarks: writerPart ? `작성자: ${writerPart}` : ''
      });

      rowsAll.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '산학교육',
        detail: eventTitle,
        periodOrGrade: datePart,
        score: '1점',
        date: datePart,
        writer: writerPart
      });
    }

    // ②-1 취업진로코스 (청솔반, 취업맞춤반, 혁신인재동아리 등)
    if (line.includes('[ ②-1 청솔반 및 취업반')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ②-1')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let courseName = '청솔반';
      if (detailPart.includes('취업맞춤반')) courseName = '취업맞춤반';
      else if (detailPart.includes('중견기업반')) courseName = '중견기업반';
      else if (detailPart.includes('반도체아카데미') || detailPart.includes('반도체 아카데미')) courseName = '반도체아카데미반';
      else if (detailPart.includes('혁신인재')) courseName = '혁신인재반';
      else if (detailPart.includes('부사관')) courseName = '부사관반';
      else if (detailPart.includes('군특성화') || detailPart.includes('군특')) courseName = '군특성화반';
      else if (detailPart.includes('도제반') || detailPart.includes('산학일체')) courseName = '산학일체도제반';

      // 학기 결정 로직
      let terms = [];
      if (detailPart.includes('2학년 1학기')) {
        terms = ['2-1'];
      } else if (detailPart.includes('2학년 2학기')) {
        terms = ['2-2'];
      } else if (detailPart.includes('3학년 1학기')) {
        terms = ['3-1'];
      } else if (detailPart.includes('3학년 2학기')) {
        terms = ['3-2'];
      } else if (detailPart.includes('1학년 1학기')) {
        terms = ['1-1'];
      } else if (detailPart.includes('1학년 2학기')) {
        terms = ['1-2'];
      } else if (detailPart.includes('3학기 참여')) {
        if (grade === 3) terms = ['2-1', '2-2', '3-1'];
        else terms = ['1-1', '1-2', '2-1'];
      } else if (detailPart.includes('2학기 참여')) {
        if (grade === 3) terms = ['2-2', '3-1'];
        else terms = ['1-2', '2-1'];
      } else if (detailPart.includes('1학기 참여')) {
        if (grade === 3) terms = ['3-1'];
        else if (grade === 2) terms = ['2-1'];
        else terms = ['1-1'];
      } else if (detailPart.includes('4학기 참여')) {
        terms = ['1-2', '2-1', '2-2', '3-1'];
      } else if (detailPart.includes('5학기 참여')) {
        terms = ['1-1', '1-2', '2-1', '2-2', '3-1'];
      } else {
        if (grade === 3) terms = ['3-1'];
        else if (grade === 2) terms = ['2-1'];
        else terms = ['1-1'];
      }

      for (const t of terms) {
        rowsCourse.push({
          grade: currentStudent.grade,
          major: currentStudent.major,
          classNum: currentStudent.classNum,
          studentNum: currentStudent.studentNum,
          name: currentStudent.name,
          term: t,
          courseName: courseName,
          remarks: writerPart ? `작성자: ${writerPart}` : ''
        });

        rowsAll.push({
          grade: currentStudent.grade,
          major: currentStudent.major,
          classNum: currentStudent.classNum,
          studentNum: currentStudent.studentNum,
          name: currentStudent.name,
          category: '취업진로코스',
          detail: courseName,
          periodOrGrade: t,
          score: '2점',
          date: datePart,
          writer: writerPart
        });
      }
    }

    // ②-2 전공심화동아리
    if (line.includes('[ ②-2 전공심화동아리 ]')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ②-2')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let clubYear = `${grade}학년`;
      let clubYearsList = [`${grade}학년`];
      if (detailPart.includes('3개 학년')) {
        clubYearsList = ['1학년', '2학년', '3학년'];
      } else if (detailPart.includes('2개 학년')) {
        if (grade === 3) clubYearsList = ['2학년', '3학년'];
        else clubYearsList = ['1학년', '2학년'];
      } else if (detailPart.includes('1개 학년')) {
        clubYearsList = [`${grade}학년`];
      }

      for (const cy of clubYearsList) {
        rowsClub.push({
          grade: currentStudent.grade,
          major: currentStudent.major,
          classNum: currentStudent.classNum,
          studentNum: currentStudent.studentNum,
          name: currentStudent.name,
          clubGrade: cy,
          clubName: '전공심화동아리',
          remarks: writerPart ? `작성자: ${writerPart}` : ''
        });
      }

      rowsAll.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '전공심화동아리',
        detail: '전공심화동아리 참여',
        periodOrGrade: clubYearsList.join(', '),
        score: detailPart.includes('3개') ? '5점' : (detailPart.includes('2개') ? '4점' : '3점'),
        date: datePart,
        writer: writerPart
      });
    }

    // ②-3 기능경기대회입상
    if (line.includes('[ ②-3 기능경기대회입상 ]')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ②-3')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let contestCategory = detailPart.includes('전국') ? '전국기능경기대회' : '지방기능경기대회';
      let award = detailPart.includes('전국') ? '입상 (5점)' : '입상 (2점)';
      let jobType = '전공직종';

      rowsContest.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        contestCategory,
        jobType,
        award,
        year: datePart ? datePart.substring(0, 4) : '2026'
      });

      rowsAll.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '기능경기대회',
        detail: contestCategory,
        periodOrGrade: award,
        score: detailPart.includes('전국') ? '5점' : '2점',
        date: datePart,
        writer: writerPart
      });
    }

    // ③-2 도제 OJT 참여 기간
    if (line.includes('[ ③-2 도제 OJT 참여 기간 ]')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ③-2')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let terms = ['2-1', '2-2', '3-1'];
      if (detailPart.includes('3학기')) {
        if (grade === 3) terms = ['2-1', '2-2', '3-1'];
        else terms = ['1-1', '1-2', '2-1'];
      } else if (detailPart.includes('2학기')) {
        if (grade === 3) terms = ['2-2', '3-1'];
        else terms = ['1-2', '2-1'];
      } else if (detailPart.includes('1학기')) {
        if (grade === 3) terms = ['3-1'];
        else if (grade === 2) terms = ['2-1'];
        else terms = ['1-1'];
      }

      for (const t of terms) {
        rowsField.push({
          grade: currentStudent.grade,
          major: currentStudent.major,
          classNum: currentStudent.classNum,
          studentNum: currentStudent.studentNum,
          name: currentStudent.name,
          category: '도제OJT',
          term: t,
          company: '산학일체도제 참여기업',
          remarks: writerPart ? `작성자: ${writerPart}` : ''
        });
      }

      rowsAll.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '도제OJT',
        detail: '도제 OJT 참여',
        periodOrGrade: terms.join(', '),
        score: '4점',
        date: datePart,
        writer: writerPart
      });
    }

    // ③-3 취업확정
    if (line.includes('[ ③-3 취업확정 ]') || line.includes('[ 취업확정 ]')) {
      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ③-3') || p.startsWith('[ 취업확정 ]')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let company = '취업확정 기업';
      if (detailPart.includes(' - ')) {
        company = detailPart.split(' - ')[1].trim();
      }

      rowsField.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '취업확정',
        term: '3-1',
        company: company,
        remarks: writerPart ? `작성자: ${writerPart}` : ''
      });

      rowsAll.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        category: '취업확정',
        detail: company,
        periodOrGrade: '3-1',
        score: '5점',
        date: datePart,
        writer: writerPart
      });
    }
  }

  return { rowsAll, rowsCourse, rowsEdu, rowsClub, rowsContest, rowsField };
}

async function buildEmploymentWorkbook(data, filename) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '옥저인재인증시스템';
  wb.created = new Date();

  const fontHeader = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FF1F2937' } };
  const fontDefault = { name: '맑은 고딕', size: 10 };
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  function styleSheet(ws, headerColorArgb) {
    ws.views = [{ showGridLines: true }];
    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    headerRow.font = fontHeader;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColorArgb }
      };
      cell.border = thinBorder;
    });

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      row.height = 20;
      row.font = fontDefault;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder;
      });
    }
  }

  // 1. 취업진로코스명단 (표준 양식)
  const wsCourse = wb.addWorksheet('취업진로코스명단');
  wsCourse.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '참여학기', key: 'term', width: 12 },
    { header: '코스명', key: 'courseName', width: 20 },
    { header: '비고', key: 'remarks', width: 16 }
  ];
  data.rowsCourse.forEach(r => wsCourse.addRow(r));
  styleSheet(wsCourse, 'FFD9E1F2');

  // 2. 산학교육이수명단 (표준 양식)
  const wsEdu = wb.addWorksheet('산학교육이수명단');
  wsEdu.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '교육행사명', key: 'title', width: 38 },
    { header: '이수일자(또는 학기)', key: 'date', width: 18 },
    { header: '비고', key: 'remarks', width: 16 }
  ];
  data.rowsEdu.forEach(r => wsEdu.addRow(r));
  styleSheet(wsEdu, 'FFD9E1F2');

  // 3. 전공동아리명단 (표준 양식)
  const wsClub = wb.addWorksheet('전공동아리명단');
  wsClub.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '참여학년', key: 'clubGrade', width: 12 },
    { header: '동아리명', key: 'clubName', width: 22 },
    { header: '비고', key: 'remarks', width: 16 }
  ];
  data.rowsClub.forEach(r => wsClub.addRow(r));
  styleSheet(wsClub, 'FFD9E1F2');

  // 4. 기능대회입상명단 (표준 양식)
  const wsContest = wb.addWorksheet('기능대회입상명단');
  wsContest.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '대회구분', key: 'contestCategory', width: 18 },
    { header: '직종', key: 'jobType', width: 16 },
    { header: '입상내역', key: 'award', width: 16 },
    { header: '수상연도', key: 'year', width: 12 }
  ];
  data.rowsContest.forEach(r => wsContest.addRow(r));
  styleSheet(wsContest, 'FFD9E1F2');

  // 5. 현장실습_도제_취업명단 (표준 양식)
  const wsField = wb.addWorksheet('현장실습_도제_취업명단');
  wsField.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '구분', key: 'category', width: 14 },
    { header: '참여학기', key: 'term', width: 12 },
    { header: '업체명(기업명)', key: 'company', width: 28 },
    { header: '비고', key: 'remarks', width: 16 }
  ];
  data.rowsField.forEach(r => wsField.addRow(r));
  styleSheet(wsField, 'FFD9E1F2');

  // 6. 전체통합내역
  const wsAll = wb.addWorksheet('전체통합내역');
  wsAll.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '영역구분', key: 'category', width: 16 },
    { header: '실적상세내역', key: 'detail', width: 34 },
    { header: '학기/학년', key: 'periodOrGrade', width: 16 },
    { header: '점수', key: 'score', width: 10 },
    { header: '평가일자', key: 'date', width: 14 },
    { header: '작성자', key: 'writer', width: 12 }
  ];
  data.rowsAll.forEach(r => wsAll.addRow(r));
  styleSheet(wsAll, 'FFE2E8F0');

  const publicOutPath = path.join(__dirname, '..', 'public', filename);
  const rootOutPath = path.join(__dirname, '..', filename);

  await wb.xlsx.writeFile(publicOutPath);
  await wb.xlsx.writeFile(rootOutPath);

  console.log(`Saved: ${filename} (Course: ${data.rowsCourse.length}, Edu: ${data.rowsEdu.length}, Club: ${data.rowsClub.length}, Contest: ${data.rowsContest.length}, Field: ${data.rowsField.length})`);
}

async function run() {
  const g3 = parseEmploymentData(rawGrade3, 3);
  const g2 = parseEmploymentData(rawGrade2, 2);
  const g1 = parseEmploymentData(rawGrade1, 1);

  await buildEmploymentWorkbook(g3, '2026학년도_3학년_취업역량_산학교육_실적명단.xlsx');
  await buildEmploymentWorkbook(g2, '2026학년도_2학년_취업역량_산학교육_실적명단.xlsx');
  await buildEmploymentWorkbook(g1, '2026학년도_1학년_취업역량_산학교육_실적명단.xlsx');

  const allData = {
    rowsAll: [...g3.rowsAll, ...g2.rowsAll, ...g1.rowsAll],
    rowsCourse: [...g3.rowsCourse, ...g2.rowsCourse, ...g1.rowsCourse],
    rowsEdu: [...g3.rowsEdu, ...g2.rowsEdu, ...g1.rowsEdu],
    rowsClub: [...g3.rowsClub, ...g2.rowsClub, ...g1.rowsClub],
    rowsContest: [...g3.rowsContest, ...g2.rowsContest, ...g1.rowsContest],
    rowsField: [...g3.rowsField, ...g2.rowsField, ...g1.rowsField],
  };

  await buildEmploymentWorkbook(allData, '2026학년도_전학년_취업역량_산학교육_실적명단.xlsx');
  console.log('All employment workbooks updated successfully!');
}

run();
