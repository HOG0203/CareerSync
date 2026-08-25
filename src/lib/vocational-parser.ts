import * as XLSX from 'xlsx';
import { 
  calcVocalGrade1Score, 
  calcVocalGrade2Score, 
  calcVocalGrade3Score,
  VocationalDomainGrades
} from './certification-calculator';

export interface RawVocalRecord {
  id: string;                // 고유 식별자 (파일+행)
  fileName: string;
  academicYear: number;      // 2024, 2025 등
  evalGrade: number;         // 1, 2, 3 학년
  targetGraduationYear: number; // 2027, 2028 등
  rawClass: string;          // 원본 과반 (예: 바이오화학과 1반, 건설과 1)
  rawNumber: string;         // 원본 번호 (예: 14)
  studentName: string;       // 원본 이름
  normMajor: string;         // 정규화된 학과명
  isCompleted: boolean;      // 완료 여부
  korean: number;            // 의사소통국어
  english: number;           // 의사소통영어
  math: number;              // 수리활용
  problem: number;           // 문제해결
  gradeSum: number;          // 등급합
  calculatedScore: number;   // 인증 환산점수
}

export interface StudentVocalMatchRow {
  studentId: string;
  studentName: string;
  currentMajor: string;
  currentClass: string;
  currentNumber: string;
  graduationYear: number;
  currentGrade: number;      // 올해 기준 학년 (1, 2, 3)

  // 1학년 평가 데이터 매칭
  grade1SelectedId?: string; // 선택된 RawVocalRecord.id
  grade1Record?: RawVocalRecord;
  grade1Candidates: RawVocalRecord[];

  // 2학년 평가 데이터 매칭
  grade2SelectedId?: string;
  grade2Record?: RawVocalRecord;
  grade2Candidates: RawVocalRecord[];

  // 3학년 평가 데이터 매칭
  grade3SelectedId?: string;
  grade3Record?: RawVocalRecord;
  grade3Candidates: RawVocalRecord[];

  // 총 환산 점수
  totalScore: number;
  hasAmbiguity: boolean;
}

/**
 * 학과명 정규화 헬퍼
 */
export function normalizeMajor(rawMajor?: string): string {
  if (!rawMajor) return '';
  const s = rawMajor.replace(/\s+/g, '');
  if (s.includes('전기')) return '스마트전기과';
  if (s.includes('기계') || s.includes('자동화기계')) return '자동화기계과';
  if (s.includes('자동차')) return '친환경자동차과';
  if (s.includes('화학') || s.includes('바이오')) return '바이오화학과';
  if (s.includes('건축') || s.includes('공간') || s.includes('건설') || s.includes('토목')) return '스마트공간과';
  if (s.includes('섬유')) return '스마트융합섬유과';
  return rawMajor;
}

/**
 * 파일명 또는 1행 타이틀에서 평가 학년도 및 학년 추출
 */
export function extractEvaluationMeta(titleOrName: string, baseYear: number): { academicYear: number; grade: number } {
  let academicYear = baseYear;
  let grade = 1;

  const yearMatch = titleOrName.match(/(20\d{2})/);
  if (yearMatch) {
    academicYear = parseInt(yearMatch[1], 10);
  }

  const gradeMatch = titleOrName.match(/([1-3])\s*학년/);
  if (gradeMatch) {
    grade = parseInt(gradeMatch[1], 10);
  }

  return { academicYear, grade };
}

/**
 * 단일 엑셀 워크북에서 RawVocalRecord 목록 파싱
 */
export function parseSingleVocationalFile(
  workbookData: ArrayBuffer | Uint8Array,
  fileName: string,
  baseYear: number = 2026
): RawVocalRecord[] {
  const wb = XLSX.read(workbookData, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

  let titleStr = fileName;
  if (rows.length > 0 && rows[0] && rows[0].length > 0) {
    titleStr = `${String(rows[0][0])} ${fileName}`;
  }
  const { academicYear, grade } = extractEvaluationMeta(titleStr, baseYear);
  const targetGraduationYear = academicYear + (4 - grade);

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    if (row.some(c => String(c).includes('과반') || String(c).includes('이름') || String(c).includes('성명') || String(c).includes('반'))) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(`[${fileName}] 표준 서식 헤더(과반, 이름, 등급합 등)를 찾을 수 없습니다.`);
  }

  const headers = rows[headerRowIdx].map(c => String(c).trim());
  const majorIdx = headers.findIndex(h => h === '학과' || h === '전공' || h === '과' || h === '계열' || h.includes('학과') || h.includes('전공'));
  const classIdx = headers.findIndex(h => h === '반' || h === '학급' || h === '분반' || h.includes('과반') || h.includes('학급') || h.includes('반'));
  const numIdx = headers.findIndex(h => h === '번호' || h === '번' || h === '학번' || h === 'No' || h === 'NO' || h === 'No.' || h.includes('번호'));
  const nameIdx = headers.findIndex(h => h === '이름' || h === '성명' || h === '학생명' || h === '학생이름' || h.replace(/\s+/g, '') === '성명' || h.includes('이름') || h.includes('성명'));
  const completedIdx = headers.findIndex(h => h.includes('완료') || h.includes('응시') || h.includes('이수') || h === '상태' || h === '구분');
  const koreanIdx = headers.findIndex(h => h.includes('국어'));
  const englishIdx = headers.findIndex(h => h.includes('영어'));
  const mathIdx = headers.findIndex(h => h.includes('수리'));
  const problemIdx = headers.findIndex(h => h.includes('문제해결') || h.includes('문제'));
  const gradeSumIdx = headers.findIndex(h => h.includes('등급합') || h.includes('총합') || h.includes('합계'));

  const records: RawVocalRecord[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const name = String(row[nameIdx] || '').trim().replace(/\s+/g, '');
    if (!name) continue;

    let classRaw = '';
    if (majorIdx !== -1 && classIdx !== -1 && majorIdx !== classIdx) {
      const majorVal = String(row[majorIdx] || '').trim();
      const classVal = String(row[classIdx] || '').trim();
      classRaw = `${majorVal} ${classVal}${classVal.includes('반') ? '' : '반'}`.trim();
    } else if (classIdx !== -1) {
      classRaw = String(row[classIdx] || '').trim();
    }
    const numRaw = String(row[numIdx] || '').replace(/[^0-9]/g, '');

    const rawCompletedStr = completedIdx !== -1 ? String(row[completedIdx] || '').trim() : '';
    const korean = Number(row[koreanIdx] || 0);
    const english = Number(row[englishIdx] || 0);
    const math = Number(row[mathIdx] || 0);
    const problem = Number(row[problemIdx] || 0);
    const rawGradeSum = gradeSumIdx !== -1 ? Number(row[gradeSumIdx] || 0) : 0;

    // 미응시 영역(0)은 5등급으로 계산
    const kVal = (korean > 0) ? korean : 5;
    const eVal = (english > 0) ? english : 5;
    const mVal = (math > 0) ? math : 5;
    const pVal = (problem > 0) ? problem : 5;

    // '완료' 기재 시 무조건 응시 완료 (1순위)
    const isCompletedText = rawCompletedStr.includes('완료') || 
      ['응시', '응시완료', 'O', 'ㅇ', 'Y', 'YES', '이수', '참여', '합격', 'TRUE', '1'].some(k => rawCompletedStr.toUpperCase().includes(k));
    const isExplicitlyAbsent = ['미응시', '미완료', '결시', 'X', 'NO', 'FALSE', '0'].some(k => rawCompletedStr === k);
    const hasScoreInput = (korean > 0 || english > 0 || math > 0 || problem > 0 || (rawGradeSum > 0 && rawGradeSum < 20));

    let isCompleted = false;
    if (isExplicitlyAbsent) {
      isCompleted = false;
    } else if (isCompletedText || hasScoreInput) {
      isCompleted = true;
    }

    const calculatedSum = kVal + eVal + mVal + pVal;
    const gradeSum = isCompleted ? (rawGradeSum > 0 ? rawGradeSum : calculatedSum) : 20;


    let calculatedScore = 0;
    if (grade === 1) {
      calculatedScore = calcVocalGrade1Score(gradeSum).score;
    } else if (grade === 2) {
      calculatedScore = calcVocalGrade2Score(gradeSum).score;
    } else {
      calculatedScore = calcVocalGrade3Score(gradeSum).score;
    }


    records.push({
      id: `${fileName}_row_${r}_${name}_${numRaw}`,
      fileName,
      academicYear,
      evalGrade: grade,
      targetGraduationYear,
      rawClass: classRaw,
      rawNumber: numRaw,
      studentName: name,
      normMajor: normalizeMajor(classRaw),
      isCompleted,
      korean,
      english,
      math,
      problem,
      gradeSum: isCompleted ? gradeSum : 0,
      calculatedScore,
    });
  }

  return records;
}

/**
 * 올해(현재 학년/반/번호) 재학생 기준으로 업로드된 과거 평가 데이터를 지능형 매핑
 */
export function buildStudentCentricVocalRows(
  allRawRecords: RawVocalRecord[],
  allStudents: any[],
  baseYear: number = 2026,
  manualSelections: Record<string, string> = {} // studentId_grade -> rawRecordId
): StudentVocalMatchRow[] {
  // 업로드된 파일들에 해당하는 졸업연도 식별
  const targetGradYears = Array.from(new Set(allRawRecords.map(r => r.targetGraduationYear)));
  if (targetGradYears.length === 0) return [];

  // 대상 재학생 목록 필터링 (학과 > 반 > 번호 정렬)
  const targetStudents = allStudents.filter(s => targetGradYears.includes(s.graduation_year));
  targetStudents.sort((a, b) => {
    if (a.graduation_year !== b.graduation_year) return a.graduation_year - b.graduation_year;
    const majA = a.major || '';
    const majB = b.major || '';
    if (majA !== majB) return majA.localeCompare(majB);
    const clsA = parseInt(a.class_info || '0', 10);
    const clsB = parseInt(b.class_info || '0', 10);
    if (clsA !== clsB) return clsA - clsB;
    const numA = parseInt(a.student_number || '0', 10);
    const numB = parseInt(b.student_number || '0', 10);
    return numA - numB;
  });

  const resultRows: StudentVocalMatchRow[] = [];

  for (const st of targetStudents) {
    const currentGrade = Math.max(1, Math.min(3, baseYear + 4 - st.graduation_year));
    const normDbMajor = normalizeMajor(st.major);
    const cleanName = String(st.student_name || '').trim().replace(/\s+/g, '');
    const cleanNum = String(st.student_number || '').replace(/[^0-9]/g, '');

    const cleanDbClass = String(st.class_info || '').replace(/[^0-9]/g, '');
    const cleanDbNum = String(st.student_number || '').replace(/[^0-9]/g, '');

    // 각 학년별 평가 후보 필터링 및 지능형 매핑
    const getGradeCandidates = (targetGradeNum: number) => {
      return allRawRecords.filter(r => 
        r.evalGrade === targetGradeNum &&
        r.targetGraduationYear === st.graduation_year &&
        r.studentName === cleanName &&
        (r.normMajor === normDbMajor || !r.normMajor)
      );
    };

    const g1Candidates = getGradeCandidates(1);
    const g2Candidates = getGradeCandidates(2);
    const g3Candidates = getGradeCandidates(3);

    // 수동 선택 또는 지능형 자동 매칭 판정 헬퍼
    const pickRecord = (gradeNum: number, candidates: RawVocalRecord[]) => {
      const manualKey = `${st.id}_grade_${gradeNum}`;
      if (manualSelections[manualKey]) {
        if (manualSelections[manualKey] === 'none') return { id: 'none', record: undefined, isAmbiguous: false };
        const found = candidates.find(c => c.id === manualSelections[manualKey]);
        if (found) return { id: found.id, record: found, isAmbiguous: false };
      }

      // 후보가 0개
      if (candidates.length === 0) {
        return { id: undefined, record: undefined, isAmbiguous: false };
      }

      // 후보가 1개인 경우 (단일 매칭)는 자동 연결
      if (candidates.length === 1) {
        return { id: candidates[0].id, record: candidates[0], isAmbiguous: false };
      }

      // 후보가 2개 이상인 경우 (동명이인 발생):
      // 1순위: [학과 + 반 + 번호]까지 100% 일치하는 레코드 탐색 (현재 학년도 또는 반/번호가 일치하는 경우)
      const exactMatches = candidates.filter(r => {
        const rNum = String(r.rawNumber || '').replace(/[^0-9]/g, '');
        const rClass = String(r.rawClass || '').replace(/[^0-9]/g, '');
        const numMatch = cleanDbNum && rNum ? cleanDbNum === rNum : false;
        const classMatch = cleanDbClass && rClass ? cleanDbClass === rClass : false;
        return numMatch && classMatch;
      });

      if (exactMatches.length === 1) {
        // 완벽히 학적(반, 번호)이 일치하므로 동명이인 모달 없이 즉시 1:1 자동 매칭!
        return { id: exactMatches[0].id, record: exactMatches[0], isAmbiguous: false };
      }

      // 2순위: 번호만이라도 일치하는 단일 후보가 있는 경우
      const numMatches = candidates.filter(r => {
        const rNum = String(r.rawNumber || '').replace(/[^0-9]/g, '');
        return cleanDbNum && rNum && cleanDbNum === rNum;
      });
      if (numMatches.length === 1) {
        return { id: numMatches[0].id, record: numMatches[0], isAmbiguous: false };
      }

      // 3순위: 과년도 데이터이거나 반/번호가 달라 특정할 수 없는 경우 -> 동명이인 선택 창 유도
      return { id: 'none', record: undefined, isAmbiguous: true };
    };

    const g1 = pickRecord(1, g1Candidates);
    const g2 = pickRecord(2, g2Candidates);
    const g3 = pickRecord(3, g3Candidates);

    const totalScore = (g1.record?.calculatedScore || 0) + 
                       (g2.record?.calculatedScore || 0) + 
                       (g3.record?.calculatedScore || 0);

    const hasAmbiguity = g1.isAmbiguous || g2.isAmbiguous || g3.isAmbiguous;

    resultRows.push({
      studentId: st.id,
      studentName: cleanName,
      currentMajor: st.major,
      currentClass: st.class_info,
      currentNumber: st.student_number,
      graduationYear: st.graduation_year,
      currentGrade,
      grade1SelectedId: g1.id,
      grade1Record: g1.record,
      grade1Candidates: g1Candidates,
      grade2SelectedId: g2.id,
      grade2Record: g2.record,
      grade2Candidates: g2Candidates,
      grade3SelectedId: g3.id,
      grade3Record: g3.record,
      grade3Candidates: g3Candidates,
      totalScore,
      hasAmbiguity,
    });
  }

  return resultRows;
}


import ExcelJS from 'exceljs';

const VOCATIONAL_STANDARD_MAJORS = [
  '스마트전기과',
  '자동화기계과',
  '바이오화학과',
  '친환경자동차과',
  '스마트공간건축과',
  '스마트융합섬유과',
  '자동차기계과',
  '건설과',
  '스마트공간과',
  '전기과',
  '섬유소재과'
];

/**
 * 직업공통능력평가 표준 엑셀 템플릿 생성 (드롭다운 유효성 검사 및 스타일 탑재)
 */
export async function generateVocationalTemplate(
  academicYear: number = 2025, 
  grade: number = 1,
  isMock: boolean = false
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CareerSync';
  wb.created = new Date();

  let evalTypeName = '자가진단평가';
  if (isMock) {
    evalTypeName = '모의평가';
  } else if (grade === 3) {
    evalTypeName = '전국단위평가';
  }

  const ws = wb.addWorksheet(`${grade}학년_${evalTypeName}`);
  ws.views = [{ showGridLines: true }];

  ws.addRow([`${academicYear}학년도 ${grade}학년 직업공통능력평가 ${evalTypeName} 결과`]);
  ws.addRow([isMock
    ? '※ 3학년 모의평가 결과에 따라 특기사항을 기재해 주시기 바랍니다.'
    : grade === 3 
      ? '※ 3학년 전국단위평가 결과에 따라 특기사항을 기재해 주시기 바랍니다.'
      : `${grade}학년 자가진단평가 완료여부에 따라 '완료' 학생에게만 아래의 문구를 기재해 주시기 바랍니다.`
  ]);
  ws.addRow(['기재 장소', '[학급담임]-[창의적체험활동]-[진로활동관리]-[특기사항]']);
  ws.addRow([
    '기재 내용', 
    `직업공통능력평가(의사소통 국어, 의사소통 영어, 수리활용, 문제해결, 직무적응 영역) ${evalTypeName}에 ${grade === 3 ? '응시함' : '참여함'}.`
  ]);
  ws.addRow([]);

  const headerRow = ws.addRow(['학과', '반', '번호', '이름', '완료여부', '의사소통국어', '의사소통영어', '수리활용', '문제해결', '등급합', '비고']);
  headerRow.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const sampleRows = [
    ['스마트전기과', 1, 1, '홍길동', '완료', 3, 3, 4, 4, 14, ''],
    ['스마트전기과', 1, 2, '김철수', '완료', 2, 2, 3, 3, 10, ''],
    ['스마트전기과', 1, 3, '이영희', '미완료', 0, 0, 0, 0, 0, '미응시'],
    ['자동화기계과', 1, 1, '강민수', '완료', 4, 4, 3, 3, 14, ''],
    ['바이오화학과', 1, 1, '박지민', '완료', 1, 2, 2, 2, 7, '우수'],
    ['친환경자동차과', 1, 1, '정우성', '완료', 3, 4, 4, 5, 16, '']
  ];
  sampleRows.forEach(r => ws.addRow(r));

  ws.columns = [
    { width: 18 }, // 학과
    { width: 8 },  // 반
    { width: 8 },  // 번호
    { width: 14 }, // 이름
    { width: 12 }, // 완료여부
    { width: 14 }, // 의사소통국어
    { width: 14 }, // 의사소통영어
    { width: 12 }, // 수리활용
    { width: 12 }, // 문제해결
    { width: 10 }, // 등급합
    { width: 15 }, // 비고
  ];

  // 드롭다운 검사 적용
  const applyDropdown = (colIndex: number, values: string[], errorTitle: string, errorMessage: string) => {
    const formulaStr = `"${values.join(',')}"`;
    for (let r = 7; r <= 300; r++) {
      const cell = ws.getCell(r, colIndex);
      cell.dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formulaStr],
        showErrorMessage: true,
        errorTitle,
        error: errorMessage,
      };
    }
  };

  applyDropdown(1, VOCATIONAL_STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
  applyDropdown(5, ['완료', '미완료'], '완료여부 선택 오류', '완료 또는 미완료 중 선택해주세요.');

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}
