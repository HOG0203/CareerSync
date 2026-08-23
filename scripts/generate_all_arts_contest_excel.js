const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Load raw data from existing scripts
const grade3Script = fs.readFileSync(path.join(__dirname, 'generate_arts_contest_excel.js'), 'utf8');
const grade2Script = fs.readFileSync(path.join(__dirname, 'generate_grade2_arts_contest_excel.js'), 'utf8');
const grade1Script = fs.readFileSync(path.join(__dirname, 'generate_grade1_arts_contest_excel.js'), 'utf8');

function extractRawData(scriptContent) {
  const match = scriptContent.match(/const rawData = `([\s\S]*?)`;/);
  return match ? match[1] : '';
}

const rawGrade3 = extractRawData(grade3Script);
const rawGrade2 = extractRawData(grade2Script);
const rawGrade1 = extractRawData(grade1Script);

function parseArtsAndContests(text, targetGrade) {
  const lines = text.split('\n');
  let currentStudent = null;
  const sportsRows = [];
  const contestRows = [];

  for (let line of lines) {
    line = line.trimEnd();
    if (!line.trim()) continue;

    const parts = line.split('\t');
    const cleanParts = parts.map(p => p.trim());
    const firstNonEmptyIdx = cleanParts.findIndex(p => p !== '');

    // Header student check (e.g. 3 건설과 1 1 강민석 ...)
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

    // ③ 예체능활동 참여점수 라인
    if (line.includes('[ ③ 예체능활동 참여점수 ]')) {
      if (!currentStudent) continue;

      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ③ 예체능활동')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      let deptName = '관악부';
      let category = '관악부';
      if (detailPart.includes('축구부')) {
        deptName = '축구부';
        category = '운동부';
      } else if (detailPart.includes('관악부')) {
        deptName = '관악부';
        category = '관악부';
      } else if (detailPart.includes('세팍타크로')) {
        deptName = '세팍타크로부';
        category = '운동부';
      }

      // 학기별 행 생성 로직 (5학기 참여 -> 1-1, 1-2, 2-1, 2-2, 3-1 5개 행 생성)
      let terms = [];
      const grade = currentStudent.grade || targetGrade;

      if (detailPart.includes('6학기')) {
        terms = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'];
      } else if (detailPart.includes('5학기')) {
        terms = ['1-1', '1-2', '2-1', '2-2', '3-1'];
      } else if (detailPart.includes('4학기')) {
        terms = ['1-1', '1-2', '2-1', '2-2'];
      } else if (detailPart.includes('3학기')) {
        terms = ['1-1', '1-2', '2-1'];
      } else if (detailPart.includes('2학기')) {
        terms = ['1-1', '1-2'];
      } else if (detailPart.includes('1학기')) {
        terms = ['1-1'];
      } else {
        // 기본값: 학년에 맞게 설정
        if (grade === 3) terms = ['1-1', '1-2', '2-1', '2-2', '3-1'];
        else if (grade === 2) terms = ['1-1', '1-2', '2-1'];
        else terms = ['1-1'];
      }

      for (const t of terms) {
        sportsRows.push({
          grade: currentStudent.grade,
          major: currentStudent.major,
          classNum: currentStudent.classNum,
          studentNum: currentStudent.studentNum,
          name: currentStudent.name,
          category: category,
          term: t,
          deptName: deptName,
          remarks: ''
        });
      }
    }

    // ④ 가산점(교내 외 각종대회 참가) 라인
    if (line.includes('[ ④ 가산점(교내 외 각종대회 참가) ]')) {
      if (!currentStudent) continue;

      let detailPart = '';
      let datePart = '';
      let writerPart = '';

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].trim();
        if (p.startsWith('[ ④ 가산점')) {
          detailPart = p;
          if (parts[i + 1]) datePart = parts[i + 1].trim();
          if (parts[i + 3]) writerPart = parts[i + 3].trim();
          break;
        }
      }

      const content = detailPart.replace(/^\[\s*④\s*가산점\([^)]*\)\s*\]\s*/, '').trim();
      if (!content) continue;

      // 단순 점수 표기 라인('1(점)', '0.5(점)' 등) 건너뛰기
      if (/^\d+(\.\d+)?\(점\)$/.test(content)) {
        continue;
      }
      
      let contestType = '단순참가';
      let contestCategory = '교내대회';
      let contestTitle = content;
      let award = '참가';

      if (content.includes('입상') || content.includes('동상') || content.includes('금상') || content.includes('은상') || content.includes('대상') || content.includes('(1점)') || content.includes('(2점)') || content.includes('(3점)')) {
        contestType = '입상';
        award = '입상';
      }

      if (content.includes('동상')) award = '동상';
      else if (content.includes('은상')) award = '은상';
      else if (content.includes('금상')) award = '금상';
      else if (content.includes('대상')) award = '대상';
      else if (content.includes('장려상')) award = '장려상';

      if (content.includes('포항전국합주경연대회') || content.includes('교육감배') || content.includes('총장배') || content.includes('지방기능경기') || content.includes('전국') || content.includes('교외')) {
        contestCategory = '교외대회';
      }

      // Title formatting
      if (content.includes(' - ')) {
        const sub = content.split(' - ');
        contestTitle = sub[0].trim();
        if (!award || award === '참가' || award === '입상') {
          award = sub[1].trim().replace(/\(\d+(\.\d+)?점\)/, '').trim();
        }
      }

      contestRows.push({
        grade: currentStudent.grade,
        major: currentStudent.major,
        classNum: currentStudent.classNum,
        studentNum: currentStudent.studentNum,
        name: currentStudent.name,
        contestType: contestType,
        contestCategory: contestCategory,
        contestTitle: contestTitle,
        contestDate: datePart,
        award: award,
        remarks: ''
      });
    }
  }

  return { sportsRows, contestRows };
}

async function buildWorkbook(sportsRows, contestRows, filename) {
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

  // 1. 운동부_관악부_명단 시트
  const sportsSheet = wb.addWorksheet('운동부_관악부_명단');
  sportsSheet.views = [{ showGridLines: true }];
  sportsSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '구분', key: 'category', width: 12 },
    { header: '참여학기', key: 'term', width: 12 },
    { header: '활동부서명', key: 'deptName', width: 22 },
    { header: '비고', key: 'remarks', width: 14 }
  ];

  sportsRows.forEach(r => sportsSheet.addRow(r));

  // Style sportsSheet
  sportsSheet.getRow(1).height = 26;
  sportsSheet.getRow(1).font = fontHeader;
  sportsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sportsSheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' } // Light soft blue-gray
    };
    cell.border = thinBorder;
  });

  for (let r = 2; r <= sportsSheet.rowCount; r++) {
    const row = sportsSheet.getRow(r);
    row.height = 20;
    row.font = fontDefault;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.eachCell({ includeEmpty: true }, (cell, cIdx) => {
      cell.border = thinBorder;
      if (cIdx === 8 || cIdx === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  // 2. 교내외대회_참가입상_명단 시트
  const contestSheet = wb.addWorksheet('교내외대회_참가입상_명단');
  contestSheet.views = [{ showGridLines: true }];
  contestSheet.columns = [
    { header: '학년', key: 'grade', width: 8 },
    { header: '학과', key: 'major', width: 18 },
    { header: '반', key: 'classNum', width: 8 },
    { header: '번호', key: 'studentNum', width: 8 },
    { header: '이름', key: 'name', width: 12 },
    { header: '실적구분', key: 'contestType', width: 12 },
    { header: '대회구분', key: 'contestCategory', width: 12 },
    { header: '대회명', key: 'contestTitle', width: 34 },
    { header: '일자(또는 학기)', key: 'contestDate', width: 16 },
    { header: '수상내역', key: 'award', width: 22 },
    { header: '비고', key: 'remarks', width: 14 }
  ];

  contestRows.forEach(r => contestSheet.addRow(r));

  // Style contestSheet
  contestSheet.getRow(1).height = 26;
  contestSheet.getRow(1).font = fontHeader;
  contestSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  contestSheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' } // Light soft blue-gray
    };
    cell.border = thinBorder;
  });

  for (let r = 2; r <= contestSheet.rowCount; r++) {
    const row = contestSheet.getRow(r);
    row.height = 20;
    row.font = fontDefault;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.eachCell({ includeEmpty: true }, (cell, cIdx) => {
      cell.border = thinBorder;
      if (cIdx === 8 || cIdx === 10 || cIdx === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  const publicOutPath = path.join(__dirname, '..', 'public', filename);
  const rootOutPath = path.join(__dirname, '..', filename);

  await wb.xlsx.writeFile(publicOutPath);
  await wb.xlsx.writeFile(rootOutPath);

  console.log(`Saved: ${filename} (Sports: ${sportsRows.length}, Contests: ${contestRows.length})`);
}

async function run() {
  const g3 = parseArtsAndContests(rawGrade3, 3);
  const g2 = parseArtsAndContests(rawGrade2, 2);
  const g1 = parseArtsAndContests(rawGrade1, 1);

  await buildWorkbook(g3.sportsRows, g3.contestRows, '2026학년도_3학년_예체능_각종대회_실적명단.xlsx');
  await buildWorkbook(g2.sportsRows, g2.contestRows, '2026학년도_2학년_예체능_각종대회_실적명단.xlsx');
  await buildWorkbook(g1.sportsRows, g1.contestRows, '2026학년도_1학년_예체능_각종대회_실적명단.xlsx');

  const allSports = [...g3.sportsRows, ...g2.sportsRows, ...g1.sportsRows];
  const allContests = [...g3.contestRows, ...g2.contestRows, ...g1.contestRows];
  await buildWorkbook(allSports, allContests, '2026학년도_전학년_예체능_각종대회_실적명단.xlsx');

  console.log('All Arts & Contest workbooks generated successfully!');
}

run();
