import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { normalizeTerm, StandardTerm } from './employment-parser';
import { evaluateContestList } from './certification-calculator';

export const STANDARD_MAJORS = [
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
 * 예체능 및 대회실적 파싱된 단일 레코드
 */
export interface RawArtsContestRecord {
  id: string;
  sourceFile: string;
  grade?: number; // 1, 2, 3학년
  major: string;
  classNumber: number;
  studentNumber: number;
  studentName: string;

  // 1. 예체능 (운동부 / 관악부)
  artsSports?: {
    category: '운동부' | '관악부' | string;
    term: StandardTerm;
    deptName: string; // 예: 축구부, 관악부
  };

  // 2. 교내외 대회 (참가 / 입상)
  contest?: {
    type: 'award' | 'participate';      // 입상 / 단순참가
    category: '교내대회' | '교외대회' | string;
    title: string;                      // 대회명 (예: 교내 백일장 대회)
    dateOrTerm?: string;                // 일자 또는 학기
    award?: string;                     // 상명 (예: 금상, 은상, 동상, 참가)
  };
}

/**
 * 엑셀 파일 파싱 엔진
 */
export function parseArtsContestWorkbook(fileBuffer: ArrayBuffer, fileName: string): RawArtsContestRecord[] {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const records: RawArtsContestRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!data || data.length < 2) continue;

    // 헤더 행 찾기 (학년/과/반/번호, 이름/성명)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(10, data.length); r++) {
      const row = data[r];
      const rowStr = row.map((c: any) => String(c).trim()).join(' ');
      if ((rowStr.includes('이름') || rowStr.includes('성명')) && (rowStr.includes('번호') || rowStr.includes('과') || rowStr.includes('학번') || rowStr.includes('반'))) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    const headers = data[headerRowIdx].map((h: any) => String(h).trim());

    // 컬럼 인덱스 매핑
    const colMap = {
      grade: headers.findIndex(h => h === '학년' || h === '현재학년' || h === '학년도학년' || h.includes('학년')),
      majorClass: headers.findIndex(h => h.includes('과반') || (h.includes('학과') && h.includes('반')) || h === '학급' || h === '과' || h.includes('소속') || h.includes('전공반')),
      major: headers.findIndex(h => h === '학과' || h === '전공' || h === '과' || h === '계열' || h.includes('학과') || h.includes('전공')),
      classNum: headers.findIndex(h => h === '반' || h === '학급' || h === '분반' || h === '반번호'),
      studentNum: headers.findIndex(h => h === '번호' || h === '번' || h === '학번' || h === 'No' || h === 'NO' || h === 'No.' || h.includes('번호')),
      studentName: headers.findIndex(h => h === '이름' || h === '성명' || h === '학생명' || h === '학생이름' || h.replace(/\s+/g, '') === '성명'),
      
      // 공통 구분
      generalCategory: headers.findIndex(h => h === '구분' || h === '분야' || h === '항목'),
      
      // A. 예체능 (운동부 / 관악부)
      sportsCategory: headers.findIndex(h => h === '예체능구분' || h.includes('예체능') || h.includes('운동부') || h.includes('관악부')),
      sportsDept: headers.findIndex(h => h === '소속부' || h === '종목' || h === '부명' || h.includes('종목')),
      sportsTerm: headers.findIndex(h => (h.includes('활동학기') || h.includes('참여학기') || h.includes('학기')) && !h.includes('대회')),
      
      // B. 교내외 대회
      contestCategory: headers.findIndex(h => h === '대회구분' || h === '교내외구분' || (h.includes('교내') && !h.includes('대회명')) || (h.includes('교외') && !h.includes('대회명'))),
      contestType: headers.findIndex(h => h === '실적구분' || h === '참가입상구분' || h === '수상여부' || h.includes('입상구분')),
      contestTitle: headers.findIndex(h => h === '대회명' || (h.includes('대회명') && !h.includes('구분')) || h === '행사명' || (h.includes('대회') && !h.includes('구분') && !h.includes('학기'))),
      contestAward: headers.findIndex(h => h === '수상명' || h === '입상명' || h === '수상내역' || h.includes('상명') || (h.includes('수상') && !h.includes('구분')) || (h.includes('입상') && !h.includes('구분'))),
      contestDate: headers.findIndex(h => h.includes('일자') || h.includes('일시') || h.includes('수상일') || h.includes('개최일') || h.includes('날짜')),
    };

    if (colMap.studentName === -1) continue;

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      const rawName = String(row[colMap.studentName] || '').trim();
      if (!rawName || rawName === '이름' || rawName.includes('합계') || rawName.includes('비고')) continue;

      // 학년 추출
      let parsedGrade: number | undefined = undefined;
      if (colMap.grade !== -1 && row[colMap.grade]) {
        const gVal = parseInt(String(row[colMap.grade]).replace(/\D/g, ''), 10);
        if (!isNaN(gVal) && gVal >= 1 && gVal <= 3) parsedGrade = gVal;
      }

      // 학과 및 반 추출
      let major = '';
      let classNumber = 0;

      if (colMap.major !== -1 && row[colMap.major]) {
        major = String(row[colMap.major] || '').trim();
      }
      if (colMap.classNum !== -1 && row[colMap.classNum] !== undefined) {
        const cnVal = parseInt(String(row[colMap.classNum]).replace(/\D/g, ''), 10);
        if (!isNaN(cnVal)) classNumber = cnVal;
      }

      if (colMap.majorClass !== -1 && (!major || classNumber === 0)) {
        const mcStr = String(row[colMap.majorClass] || '').trim();
        if (!parsedGrade) {
          const gMatch = mcStr.match(/(\d)학년/);
          if (gMatch) parsedGrade = parseInt(gMatch[1], 10);
        }
        if (!major) {
          const mMatch = mcStr.match(/([가-힣a-zA-Z]+(?:과|계열)?)/);
          if (mMatch) major = mMatch[1];
        }
        if (classNumber === 0) {
          const cMatch = mcStr.match(/(\d+)\s*반/);
          if (cMatch) classNumber = parseInt(cMatch[1], 10);
        }
      }

      let studentNumber = 0;
      if (colMap.studentNum !== -1) {
        const snVal = parseInt(String(row[colMap.studentNum]).replace(/\D/g, ''), 10);
        if (!isNaN(snVal)) studentNumber = snVal;
      }

      const recId = `ac_${fileName}_${sheetName}_${r}`;

      // A. 예체능 (운동부 / 관악부) 파싱
      const isSportsSheet = sheetName.includes('운동') || sheetName.includes('관악') || sheetName.includes('예체능') || fileName.includes('운동') || fileName.includes('관악') || fileName.includes('예체능');
      const sportsCategoryVal = colMap.sportsCategory !== -1 ? String(row[colMap.sportsCategory] || '').trim() : (colMap.generalCategory !== -1 ? String(row[colMap.generalCategory] || '').trim() : '');
      const sportsTermVal = colMap.sportsTerm !== -1 ? normalizeTerm(row[colMap.sportsTerm]) : undefined;
      const sportsDeptVal = colMap.sportsDept !== -1 ? String(row[colMap.sportsDept] || '').trim() : '';

      if ((isSportsSheet || sportsCategoryVal.includes('운동') || sportsCategoryVal.includes('관악')) && sportsTermVal) {
        records.push({
          id: `${recId}_sports_${sportsTermVal}`,
          sourceFile: fileName,
          grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
          artsSports: {
            category: sportsCategoryVal || (sportsDeptVal.includes('관악') ? '관악부' : '운동부'),
            term: sportsTermVal,
            deptName: sportsDeptVal || sportsCategoryVal || '운동부'
          }
        });
      }

      // B. 교내외 대회 (참가 / 입상) 파싱
      const isContestSheet = sheetName.includes('대회') || sheetName.includes('수상') || fileName.includes('대회') || fileName.includes('수상');
      const contestTypeVal = colMap.contestType !== -1 ? String(row[colMap.contestType] || '').trim() : (colMap.generalCategory !== -1 ? String(row[colMap.generalCategory] || '').trim() : '');
      const contestCatVal = colMap.contestCategory !== -1 ? String(row[colMap.contestCategory] || '').trim() : '교내대회';
      const contestTitleVal = colMap.contestTitle !== -1 ? String(row[colMap.contestTitle] || '').trim() : '';
      const contestDateVal = colMap.contestDate !== -1 ? String(row[colMap.contestDate] || '').trim() : '';
      const contestAwardVal = colMap.contestAward !== -1 ? String(row[colMap.contestAward] || '').trim() : '';

      if (contestTitleVal && (isContestSheet || contestTypeVal || contestAwardVal)) {
        const isAward = contestTypeVal.includes('입상') || contestTypeVal.includes('수상') || (contestAwardVal && !contestAwardVal.includes('참가') && contestAwardVal !== 'X');
        const type: 'award' | 'participate' = isAward ? 'award' : 'participate';

        records.push({
          id: `${recId}_contest_${contestTitleVal}`,
          sourceFile: fileName,
          grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
          contest: {
            type,
            category: contestCatVal.includes('교외') ? '교외대회' : '교내대회',
            title: contestTitleVal,
            dateOrTerm: contestDateVal,
            award: contestAwardVal || (type === 'award' ? '입상' : '참가')
          }
        });
      }
    }
  }

  return records;
}

/**
 * 엑셀 파일에 등장한 학생 단위 행 데이터 (업로드된 학생들만 표시)
 */
export interface UploadedStudentArtsContestRow {
  rowKey: string;
  sourceFiles: string[];

  // 엑셀 원본 기재 정보
  excelGrade?: number;
  excelMajor?: string;
  excelClassNumber?: number;
  excelStudentNumber?: number;
  excelStudentName: string;

  // DB 매칭 결과
  matchStatus: 'matched' | 'unmatched' | 'ambiguous';
  unmatchedReason?: string;
  candidateStudents?: any[];
  selectedStudentId?: string;

  // 매칭된 실제 DB 학적
  studentId?: string;
  studentName: string;
  currentGrade?: number;
  currentClass?: number;
  currentNumber?: number;
  currentMajor?: string;

  // 슬롯 기반 정형화 데이터
  artsSports: Record<string, string>; // { "1-1": "축구부", "2-1": "관악부" }
  contestList: Array<{
    id: string;
    type: 'award' | 'participate';
    category?: '교내대회' | '교외대회' | string;
    title: string;
    dateOrTerm?: string;
    award?: string;
  }>;

  // 실시간 계산 점수
  artsSportsSemesters: number;   // 참여 학기 수
  artsSportsScore: number;       // 예체능 점수 (6학기 5, 5학기 4, 4학기 3, 3학기 2, 2학기 1)
  contestAwardCount: number;     // 입상 건수
  contestParticipateCount: number; // 참가 건수
  contestScore: number;          // 대회 점수 (입상x1 + 참가지x0.5, 최대 5점)
  totalArtsContestScore: number; // 총점 (최대 10점)
}

/**
 * 점수 계산 헬퍼
 */
export function calcSportsScore(semesters: number): number {
  if (semesters >= 6) return 5.0;
  if (semesters === 5) return 4.0;
  if (semesters === 4) return 3.0;
  if (semesters === 3) return 2.0;
  if (semesters >= 2) return 1.0;
  return 0.0;
}

export function calcContestScore(awardCount: number, partCount: number): number {
  const raw = (awardCount * 1.0) + (partCount * 0.5);
  return Math.min(5.0, Math.max(0.0, Math.round(raw * 10) / 10));
}

/**
 * 업로드된 엑셀에 등장하는 학생들만 추출하여 DB 대조 및 누적 병합하는 엔진
 */
export function buildUploadedOnlyArtsContestRows(
  activeStudents: any[],
  existingStore: Record<string, any>,
  uploadedRecords: RawArtsContestRecord[],
  manualSelections: Record<string, string> = {},
  baseYear: number = 2026
): UploadedStudentArtsContestRow[] {
  if (uploadedRecords.length === 0) return [];

  // 1. 엑셀에 등장하는 고유 학생 그룹핑
  const studentGroups = new Map<string, RawArtsContestRecord[]>();

  for (const r of uploadedRecords) {
    const key = `${r.grade || ''}_${r.major}_${r.classNumber}_${r.studentNumber}_${r.studentName}`;
    if (!studentGroups.has(key)) {
      studentGroups.set(key, []);
    }
    studentGroups.get(key)!.push(r);
  }

  const resultRows: UploadedStudentArtsContestRow[] = [];

  studentGroups.forEach((records, key) => {
    const sample = records[0];
    const rawName = sample.studentName;
    const rawGrade = sample.grade;
    const rawClass = sample.classNumber;
    const rawNum = sample.studentNumber;
    const rawMajor = sample.major;
    const sourceFiles = Array.from(new Set(records.map(r => r.sourceFile)));

    // 2. DB activeStudents에서 매칭 후보 탐색
    const nameMatches = activeStudents.filter(st => String(st.student_name || '').trim() === rawName.trim());
    let matchedStudent: any = null;
    let matchStatus: 'matched' | 'unmatched' | 'ambiguous' = 'unmatched';
    let unmatchedReason = '';
    let candidateStudents: any[] = [];

    // 숫자 및 학과 정규화 헬퍼
    // 숫자 및 학과 정규화 헬퍼 (0 또는 빈값은 null로 처리하여 잘못된 불일치 방지)
    const toNum = (v: any) => {
      if (v === null || v === undefined || v === '' || v === 0 || v === '0') return null;
      const parsed = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) || parsed === 0 ? null : parsed;
    };
    const toMajor = (m: any) => String(m || '').trim().replace(/\s+/g, '').replace(/과$/, '').replace(/계열$/, '').replace(/공업계$/, '');

    const excelGrade = toNum(rawGrade);
    const excelClass = toNum(rawClass);
    const excelNum = toNum(rawNum);
    const excelMajor = toMajor(rawMajor);


    if (manualSelections[key]) {
      const selectedId = manualSelections[key];
      if (selectedId === 'none') {
        matchStatus = 'unmatched';
        unmatchedReason = '사용자가 매칭 제외(선택 안 함)함';
      } else {
        matchedStudent = activeStudents.find(st => st.id === selectedId);
        if (matchedStudent) {
          matchStatus = 'matched';
        }
      }
    } else {
      if (nameMatches.length === 0) {
        matchStatus = 'unmatched';
        unmatchedReason = '현재 DB 재학생 목록에 일치하는 이름이 없습니다.';
      } else if (nameMatches.length === 1) {
        const st = nameMatches[0];
        const stGrade = toNum(baseYear - st.graduation_year + 4);
        const stClass = toNum(st.class_info);
        const stNum = toNum(st.student_number);
        const stMajor = toMajor(st.major);
        
        if (excelGrade !== null && stGrade !== null && excelGrade !== stGrade) {
          matchStatus = 'unmatched';
          unmatchedReason = `엑셀 학년(${excelGrade}학년)과 DB 학적(${stGrade}학년)이 불일치합니다.`;
        } else if (excelClass !== null && stClass !== null && excelClass !== stClass) {
          matchStatus = 'unmatched';
          unmatchedReason = `엑셀 학급(${excelClass}반)과 DB 학적(${stClass}반)이 불일치합니다.`;
        } else if (excelNum !== null && stNum !== null && excelNum !== stNum) {
          matchStatus = 'unmatched';
          unmatchedReason = `엑셀 번호(${excelNum}번)와 DB 학적(${stNum}번)이 불일치합니다.`;
        } else if (excelMajor && stMajor && !stMajor.includes(excelMajor) && !excelMajor.includes(stMajor)) {
          matchStatus = 'unmatched';
          unmatchedReason = `엑셀 학과(${rawMajor})와 DB 학적(${st.major})이 불일치합니다.`;
        } else {
          matchedStudent = st;
          matchStatus = 'matched';
        }
      } else {
        const exactMatches = nameMatches.filter(st => {
          const stGrade = toNum(baseYear - st.graduation_year + 4);
          const stClass = toNum(st.class_info);
          const stNum = toNum(st.student_number);
          const stMajor = toMajor(st.major);

          if (excelGrade !== null && stGrade !== null && excelGrade !== stGrade) return false;
          if (excelClass !== null && stClass !== null && excelClass !== stClass) return false;
          if (excelNum !== null && stNum !== null && excelNum !== stNum) return false;
          if (excelMajor && stMajor && !stMajor.includes(excelMajor) && !excelMajor.includes(stMajor)) return false;
          return true;
        });

        if (exactMatches.length === 1) {
          matchedStudent = exactMatches[0];
          matchStatus = 'matched';
        } else if (exactMatches.length > 1) {
          matchStatus = 'ambiguous';
          candidateStudents = exactMatches;
          unmatchedReason = `동명이인 ${exactMatches.length}명이 존재하여 명확한 선택이 필요합니다.`;
        } else {
          matchStatus = 'ambiguous';
          candidateStudents = nameMatches;
          unmatchedReason = `동명이인 ${nameMatches.length}명이 존재하여 명확한 선택이 필요합니다.`;
        }
      }
    }

    // 3. 업로드 파일 내 순수 데이터 추출 (이번 업로드 파일 기준)
    const artsSports: Record<string, string> = {};
    const contestList: Array<{
      id: string;
      type: 'award' | 'participate';
      category?: string;
      title: string;
      dateOrTerm?: string;
      award?: string;
    }> = [];

    // 엑셀에서 올라온 레코드들을 슬롯에 누적 병합
    for (const r of records) {
      if (r.artsSports) {
        artsSports[r.artsSports.term] = r.artsSports.deptName;
      }
      if (r.contest) {
        const contestId = `${r.contest.dateOrTerm || ''}_${r.contest.title}_${r.contest.type}`;
        if (!contestList.some(c => c.id === contestId)) {
          contestList.push({
            id: contestId,
            type: r.contest.type,
            category: r.contest.category,
            title: r.contest.title,
            dateOrTerm: r.contest.dateOrTerm,
            award: r.contest.award,
          });
        }
      }
    }

    // 4. 점수 계산 (동일 대회 입상 시 입상 우선 인정 및 참가 중복 배점 제외)
    const artsSportsSemesters = Object.keys(artsSports).length;
    const artsSportsScore = calcSportsScore(artsSportsSemesters);

    const contestEval = evaluateContestList(contestList);
    const contestAwardCount = contestEval.effectiveAwardCount;
    const contestParticipateCount = contestEval.effectivePartCount;
    const contestScore = contestEval.score;

    const totalArtsContestScore = Math.round((artsSportsScore + contestScore) * 10) / 10;

    resultRows.push({
      rowKey: key,
      sourceFiles,

      excelGrade: rawGrade,
      excelMajor: rawMajor,
      excelClassNumber: rawClass,
      excelStudentNumber: rawNum,
      excelStudentName: rawName,

      matchStatus,
      unmatchedReason,
      candidateStudents,
      selectedStudentId: manualSelections[key] || (matchedStudent ? matchedStudent.id : undefined),

      studentId: matchedStudent?.id,
      studentName: matchedStudent?.student_name || rawName,
      currentGrade: matchedStudent ? (baseYear - matchedStudent.graduation_year + 4) : rawGrade,
      currentClass: matchedStudent?.class_info || rawClass,
      currentNumber: matchedStudent?.student_number || rawNum,
      currentMajor: matchedStudent?.major || rawMajor,

      artsSports,
      contestList,

      artsSportsSemesters,
      artsSportsScore,
      contestAwardCount,
      contestParticipateCount,
      contestScore,
      totalArtsContestScore,
    });
  });

  return resultRows;
}

/**
 * 예체능 & 대회실적 표준 서식 2종 생성기 (드롭다운 유효성 검사 및 스타일 탑재)
 */
export async function generateArtsContestTemplate(
  type: 'sports' | 'contest' = 'sports',
  academicYear: number = 2026
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CareerSync';
  wb.created = new Date();

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 28;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
  };

  const applyDropdownValidation = (
    ws: ExcelJS.Worksheet,
    colIndex: number,
    values: string[],
    errorTitle: string = '입력 제한 오류',
    errorMessage: string = '목록에서 제공하는 표준 값만 선택할 수 있습니다.'
  ) => {
    const formulaStr = `"${values.join(',')}"`;
    for (let r = 5; r <= 300; r++) {
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

  if (type === 'sports') {
    const ws = wb.addWorksheet('운동부_관악부_명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 예체능(운동부/관악부) 참여 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [구분], [참여학기] 셀을 클릭하시면 드롭다운 목록이 나타납니다. (6학기 5점, 5학기 4점, 4학기 3점, 3학기 2점, 2학기 1점)']);
    ws.addRow([]);

    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '구분', '참여학기', '활동부서명', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '운동부', '1-1', '축구부', ''],
      [3, '스마트전기과', 1, 1, '홍길동', '운동부', '1-2', '축구부', ''],
      [3, '스마트전기과', 1, 1, '홍길동', '관악부', '2-1', '윈드오케스트라', ''],
      [2, '자동화기계과', 1, 1, '김철수', '관악부', '1-2', '관악합주단', ''],
      [1, '바이오화학과', 1, 1, '이영희', '운동부', '1-1', '세팍타크로부', '']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 14 }, // 구분
      { width: 14 }, // 참여학기
      { width: 22 }, // 활동부서명
      { width: 18 }, // 비고
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['운동부', '관악부'], '구분 선택 오류', '운동부 또는 관악부 중 선택해주세요.');
    applyDropdownValidation(ws, 7, ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'], '학기 선택 오류', '1-1, 1-2, 2-1, 2-2, 3-1, 3-2 중 선택해주세요.');

  } else if (type === 'contest') {
    const ws = wb.addWorksheet('교내외대회_참가입상_명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 교내외 각종 대회 참가 및 입상 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [실적구분], [대회구분] 셀을 클릭하시면 드롭다운 목록이 나타납니다. (입상 건당 1.0점, 참가 건당 0.5점, 최대 5점)']);
    ws.addRow([]);

    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '실적구분', '대회구분', '대회명', '일자(또는 학기)', '수상내역', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '입상', '교내대회', '교내 창의아이디어 경진대회', `${academicYear}-05-20`, '금상(1위)', ''],
      [3, '스마트전기과', 1, 1, '홍길동', '단순참가', '교외대회', '충남 청소년 과학탐구대회', `${academicYear}-06-11`, '참가', '본선 진출'],
      [2, '자동화기계과', 1, 1, '김철수', '입상', '교내대회', '교내 백일장 대회', `${academicYear}-09-15`, '은상(2위)', '']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 14 }, // 실적구분
      { width: 14 }, // 대회구분
      { width: 28 }, // 대회명
      { width: 18 }, // 일자
      { width: 16 }, // 수상내역
      { width: 18 }, // 비고
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['입상', '단순참가'], '실적구분 선택 오류', '입상 또는 단순참가 중 선택해주세요.');
    applyDropdownValidation(ws, 7, ['교내대회', '교외대회'], '대회구분 선택 오류', '교내대회 또는 교외대회 중 선택해주세요.');
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}
