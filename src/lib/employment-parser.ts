import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

/**
 * 표준 취업진로코스 목록
 */
export const STANDARD_CAREER_COURSES = [
  '청솔반',
  '취업맞춤반',
  '중견기업반',
  '반도체아카데미반',
  '혁신인재반',
  '부사관반',
  '군특성화반',
  '산학일체도제반',
  '기타공식코스'
] as const;

export type StandardCourseName = typeof STANDARD_CAREER_COURSES[number];

export const STANDARD_TERMS = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'] as const;
export type StandardTerm = typeof STANDARD_TERMS[number];

/**
 * 학기 정규화 함수 (예: "1학년 1학기", "1-1학기", "1_1" -> "1-1")
 */
export function normalizeTerm(input: any): StandardTerm | null {
  if (!input) return null;
  const s = String(input).trim().replace(/\s+/g, '');
  if (/^1[-_./학년]*1/.test(s) || s === '11') return '1-1';
  if (/^1[-_./학년]*2/.test(s) || s === '12') return '1-2';
  if (/^2[-_./학년]*1/.test(s) || s === '21') return '2-1';
  if (/^2[-_./학년]*2/.test(s) || s === '22') return '2-2';
  if (/^3[-_./학년]*1/.test(s) || s === '31') return '3-1';
  if (/^3[-_./학년]*2/.test(s) || s === '32') return '3-2';
  return null;
}

/**
 * 코스명 정규화 함수
 */
export function normalizeCourseName(input: any): string {
  if (!input) return '';
  const s = String(input).trim();
  if (s.includes('청솔')) return '청솔반';
  if (s.includes('맞춤') || s.includes('취업맞춤')) return '취업맞춤반';
  if (s.includes('중견') || s.includes('중견기업')) return '중견기업반';
  if (s.includes('반도체') || s.includes('아카데미')) return '반도체아카데미반';
  if (s.includes('혁신') || s.includes('혁신인재')) return '혁신인재반';
  if (s.includes('부사관')) return '부사관반';
  if (s.includes('군특') || s.includes('군특성화')) return '군특성화반';
  if (s.includes('도제') || s.includes('산학일체')) return '산학일체도제반';
  return s;
}

/**
 * 동아리 학년 정규화 (1, 2, 3)
 */
export function normalizeClubGrade(input: any): number | null {
  if (!input) return null;
  const s = String(input).trim();
  if (s.startsWith('1') || s.includes('1학년')) return 1;
  if (s.startsWith('2') || s.includes('2학년')) return 2;
  if (s.startsWith('3') || s.includes('3학년')) return 3;
  return null;
}

/**
 * 기능경기대회 훈격 정규화
 */
export function normalizeContestLevel(input: any): 'national' | 'regional' | 'none' {
  if (!input) return 'none';
  const s = String(input).trim();
  if (s.includes('전국')) return 'national';
  if (s.includes('지방') || s.includes('시도') || s.includes('충남') || s.includes('지역')) return 'regional';
  return 'none';
}

/**
 * 불리언 정규화 (이수, 완료, O, 확정 -> true)
 */
export function normalizeBoolean(input: any): boolean {
  if (input === true || input === 1 || input === '1') return true;
  if (!input) return false;
  const s = String(input).trim().toUpperCase();
  return ['O', 'ㅇ', 'YES', 'Y', '이수', '완료', '참여', '확정', '합격', 'TRUE'].includes(s);
}

/**
 * 취업역량 파싱된 단일 레코드
 */
export interface RawEmploymentRecord {
  id: string;
  sourceFile: string;
  grade?: number; // 1, 2, 3학년
  major: string;
  classNumber: number;
  studentNumber: number;
  studentName: string;
  
  // 파싱된 항목
  industryEdu?: { title: string; dateOrTerm?: string };
  careerCourse?: { term: StandardTerm; courseName: string };
  majorClub?: { grade: number; clubName: string };
  skillsContest?: { level: 'national' | 'regional' | 'none'; name: string; award?: string };
  fieldTraining?: { completed: boolean; company?: string };
  apprenticeship?: { term: StandardTerm; company?: string };
  employedEarly?: { confirmed: boolean; company?: string };
}

/**
 * 엑셀 파일 파싱 엔진
 */
export function parseEmploymentWorkbook(fileBuffer: ArrayBuffer, fileName: string): RawEmploymentRecord[] {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const records: RawEmploymentRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!data || data.length < 2) continue;

    // 헤더 행 찾기 (과반/학과/반, 번호, 성명/이름)
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

    const isClubSheet = sheetName.includes('전공동아리') || sheetName.includes('전공심화') || sheetName.includes('동아리') || fileName.includes('전공동아리') || fileName.includes('전공심화') || fileName.includes('동아리') || fileName.includes('3.전공');
    const isEduSheet = sheetName.includes('산학교육') || sheetName.includes('교육') || fileName.includes('산학교육') || fileName.includes('교육') || fileName.includes('2.산학');
    const isCourseSheet = sheetName.includes('진로코스') || sheetName.includes('취업진로') || sheetName.includes('코스') || fileName.includes('진로코스') || fileName.includes('취업진로') || fileName.includes('코스') || fileName.includes('1.취업');
    const isContestSheet = sheetName.includes('기능대회') || sheetName.includes('기능경기') || fileName.includes('기능대회') || fileName.includes('기능경기') || fileName.includes('4.기능');
    const isFieldSheet = sheetName.includes('현장실습') || sheetName.includes('도제') || sheetName.includes('취업명단') || fileName.includes('현장실습') || fileName.includes('도제') || fileName.includes('취업') || fileName.includes('5.현장');

    // 주요 컬럼 인덱스 매핑
    const colMap = {
      grade: headers.findIndex(h => h === '학년' || h === '현재학년' || h === '학년도학년'),
      majorClass: headers.findIndex(h => h.includes('과반') || (h.includes('학과') && h.includes('반')) || h === '학급' || h === '과'),
      major: headers.findIndex(h => h === '학과' || h === '전공'),
      classNum: headers.findIndex(h => h === '반' || h === '학급'),
      studentNum: headers.findIndex(h => h === '번호' || h === '번'),
      studentName: headers.findIndex(h => h === '이름' || h === '성명' || h === '학생명'),
      
      // 1. 산학교육
      edu1: isEduSheet || (!isCourseSheet && !isClubSheet && !isContestSheet && !isFieldSheet)
        ? headers.findIndex(h => h === '교육행사명' || h.includes('교육행사명') || h.includes('교육') || h.includes('산학교육') || h.includes('행사'))
        : -1,
      eduDate: headers.findIndex(h => h.includes('이수일자') || h.includes('일자') || h.includes('일시') || h.includes('날짜')),
      
      // 2. 취업진로코스 (현장실습 시트에서는 참여학기를 코스로 오인하지 않도록 방지)
      courseTerm: !isFieldSheet && (isCourseSheet || (!isEduSheet && !isClubSheet && !isContestSheet))
        ? headers.findIndex(h => (h.includes('코스') && h.includes('학기')) || (isCourseSheet && (h === '참여학기' || h.includes('학기'))) || (h.includes('학기') && !h.includes('실적') && !h.includes('구분')))
        : -1,
      courseName: headers.findIndex(h => h === '코스명' || h.includes('코스명') || (h.includes('진로코스') && !h.includes('학기')) || h === '코스'),
      
      // 개별 학기 컬럼 지원 (코스 1-1, 코스 1-2 ...)
      c11: headers.findIndex(h => h.includes('1-1') && (h.includes('코스') || h.includes('청솔') || h.includes('진로'))),
      c12: headers.findIndex(h => h.includes('1-2') && (h.includes('코스') || h.includes('청솔') || h.includes('진로'))),
      c21: headers.findIndex(h => h.includes('2-1') && (h.includes('코스') || h.includes('맞춤') || h.includes('진로'))),
      c22: headers.findIndex(h => h.includes('2-2') && (h.includes('코스') || h.includes('맞춤') || h.includes('진로'))),
      c31: headers.findIndex(h => h.includes('3-1') && (h.includes('코스') || h.includes('진로'))),
      c32: headers.findIndex(h => h.includes('3-2') && (h.includes('코스') || h.includes('진로'))),

      // 3. 전공동아리 (참여학년, 동아리명 등 지원)
      clubGrade: isClubSheet || (!isCourseSheet && !isEduSheet && !isContestSheet && !isFieldSheet)
        ? headers.findIndex(h => h === '참여학년' || h.includes('참여학년') || h === '활동학년' || (h.includes('동아리') && h.includes('학년')))
        : -1,
      clubName: headers.findIndex(h => h === '동아리명' || h.includes('동아리명') || (h.includes('동아리') && !h.includes('학년'))),
      club1: headers.findIndex(h => (h.includes('동아리') && h.includes('1')) || h === '1학년' || h === '1학년 참여' || h === '1학년동아리'),
      club2: headers.findIndex(h => (h.includes('동아리') && h.includes('2')) || h === '2학년' || h === '2학년 참여' || h === '2학년동아리'),
      club3: headers.findIndex(h => (h.includes('동아리') && h.includes('3')) || h === '3학년' || h === '3학년 참여' || h === '3학년동아리'),

      // 4. 기능경기대회
      contestLevel: isContestSheet || (!isCourseSheet && !isEduSheet && !isClubSheet && !isFieldSheet)
        ? headers.findIndex(h => h === '대회구분' || h.includes('대회구분') || h.includes('기능대회') || h.includes('훈격') || h.includes('대회'))
        : -1,
      contestAward: headers.findIndex(h => h === '입상내역' || h.includes('입상내역') || h.includes('입상') || h.includes('상명') || h.includes('수상')),
      contestJob: headers.findIndex(h => h === '직종' || h.includes('직종') || h.includes('종목')),
      contestYear: headers.findIndex(h => h === '수상연도' || h.includes('수상연도') || h.includes('연도') || h.includes('년도')),

      // 5. 현장실습 / 도제 / 취업확정
      fieldCategory: headers.findIndex(h => h === '구분' || h.includes('실습구분') || h.includes('활동구분')),
      fieldCompany: headers.findIndex(h => h === '업체명(기업명)' || h.includes('업체명') || h.includes('기업명') || h.includes('회사명') || h.includes('실습처')),
      fieldTerm: headers.findIndex(h => (h.includes('학기') && !h.includes('코스')) || h === '참여학기' || h.includes('참여학기')),

      fieldTraining: headers.findIndex(h => h.includes('현장실습') && !h.includes('구분')),
      apprTerm: headers.findIndex(h => h.includes('도제') && h.includes('학기')),
      apprCompany: headers.findIndex(h => h.includes('도제') && !h.includes('학기')),
      appr21: headers.findIndex(h => h.includes('도제') && h.includes('2-1')),
      appr22: headers.findIndex(h => h.includes('도제') && h.includes('2-2')),
      appr31: headers.findIndex(h => h.includes('도제') && h.includes('3-1')),
      appr32: headers.findIndex(h => h.includes('도제') && h.includes('3-2')),
      employedEarly: headers.findIndex(h => h.includes('취업확정') || h.includes('조기취업') || h.includes('취업처')),
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

      // 학과 및 반 추출 (학과, 반 컬럼 분리 우선 처리)
      let major = '';
      let classNumber = 0;

      if (colMap.major !== -1 && row[colMap.major]) {
        major = String(row[colMap.major] || '').trim();
      }
      if (colMap.classNum !== -1 && row[colMap.classNum] !== undefined) {
        const cnVal = parseInt(String(row[colMap.classNum]).replace(/\D/g, ''), 10);
        if (!isNaN(cnVal)) classNumber = cnVal;
      }

      // 과반 컬럼 병합 형태인 경우 보조 처리
      if (colMap.majorClass !== -1 && (!major || classNumber === 0)) {
        const mcStr = String(row[colMap.majorClass] || '').trim();
        if (!parsedGrade) {
          const gMatch = mcStr.match(/(\d)학년/);
          if (gMatch) parsedGrade = parseInt(gMatch[1], 10);
        }
        if (!major) {
          const mMatch = mcStr.match(/([가-힣a-zA-Z]+과?)/);
          if (mMatch) major = mMatch[1];
        }
        if (classNumber === 0) {
          const cMatch = mcStr.match(/(\d+)반/);
          if (cMatch) classNumber = parseInt(cMatch[1], 10);
        }
      }

      let studentNumber = 0;
      if (colMap.studentNum !== -1) {
        const snVal = parseInt(String(row[colMap.studentNum]).replace(/\D/g, ''), 10);
        if (!isNaN(snVal)) studentNumber = snVal;
      }

      const recId = `emp_${fileName}_${sheetName}_${r}`;

      // A. 취업진로코스 학기별 파싱 (코스명 컬럼이 존재하거나 코스 전용 시트일 때만 파싱)
      if ((isCourseSheet || colMap.courseName !== -1) && colMap.courseTerm !== -1 && row[colMap.courseTerm]) {
        const term = normalizeTerm(row[colMap.courseTerm]);
        const courseName = normalizeCourseName(row[colMap.courseName !== -1 ? colMap.courseName : colMap.courseTerm]);
        if (term && courseName) {
          records.push({
            id: `${recId}_course_${term}`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            careerCourse: { term, courseName }
          });
        }
      }
      const termCols: [StandardTerm, number][] = [
        ['1-1', colMap.c11], ['1-2', colMap.c12],
        ['2-1', colMap.c21], ['2-2', colMap.c22],
        ['3-1', colMap.c31], ['3-2', colMap.c32]
      ];
      for (const [t, cIdx] of termCols) {
        if (cIdx !== -1 && row[cIdx]) {
          const cName = normalizeCourseName(row[cIdx]);
          if (cName) {
            records.push({
              id: `${recId}_course_${t}`,
              sourceFile: fileName,
              grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
              careerCourse: { term: t, courseName: cName }
            });
          }
        }
      }

      // B. 전공동아리 파싱 (참여학년 + 동아리명 또는 개별 학년 컬럼 지원)
      if (colMap.clubGrade !== -1 && row[colMap.clubGrade]) {
        const gr = normalizeClubGrade(row[colMap.clubGrade]) || parsedGrade;
        const cName = String(row[colMap.clubName !== -1 ? colMap.clubName : colMap.clubGrade] || '전공심화동아리').trim();
        if (gr && cName && cName !== 'X' && cName !== '미참여') {
          records.push({
            id: `${recId}_club_${gr}`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            majorClub: { grade: gr, clubName: cName }
          });
        }
      } else if (isClubSheet && colMap.clubName !== -1 && row[colMap.clubName]) {
        const cName = String(row[colMap.clubName]).trim();
        const gr = parsedGrade || 3;
        if (cName && cName !== 'X' && cName !== '미참여') {
          records.push({
            id: `${recId}_club_${gr}`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            majorClub: { grade: gr, clubName: cName }
          });
        }
      }

      const clubCols: [number, number][] = [[1, colMap.club1], [2, colMap.club2], [3, colMap.club3]];
      for (const [gr, cIdx] of clubCols) {
        if (cIdx !== -1 && row[cIdx]) {
          const cName = String(row[cIdx]).trim();
          if (cName && cName !== 'X' && cName !== '미참여') {
            records.push({
              id: `${recId}_club_${gr}`,
              sourceFile: fileName,
              grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
              majorClub: { grade: gr, clubName: cName }
            });
          }
        }
      }

      // C. 기능경기대회 파싱
      if (colMap.contestLevel !== -1 && row[colMap.contestLevel]) {
        const lvlStr = String(row[colMap.contestLevel]);
        const level = normalizeContestLevel(lvlStr);
        const award = colMap.contestAward !== -1 ? String(row[colMap.contestAward] || '').trim() : '';
        const job = colMap.contestJob !== -1 ? String(row[colMap.contestJob] || '').trim() : '';
        const year = colMap.contestYear !== -1 ? String(row[colMap.contestYear] || '').trim() : '';
        const fullContestName = [year, lvlStr, job, award].filter(Boolean).join(' ');

        if (level !== 'none') {
          records.push({
            id: `${recId}_contest`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            skillsContest: { level, name: fullContestName, award }
          });
        }
      }

      // D. 현장실습 / 도제 / 취업확정 (5번 서식 구분 컬럼 형태)
      if (colMap.fieldCategory !== -1 && row[colMap.fieldCategory]) {
        const catStr = String(row[colMap.fieldCategory]).trim();
        const companyStr = colMap.fieldCompany !== -1 ? String(row[colMap.fieldCompany] || '').trim() : '';
        const termStr = colMap.fieldTerm !== -1 ? normalizeTerm(row[colMap.fieldTerm]) : undefined;

        if (catStr.includes('현장실습')) {
          records.push({
            id: `${recId}_field`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            fieldTraining: { completed: true, company: companyStr || '현장실습 이수' }
          });
        } else if (catStr.includes('도제') || catStr.includes('OJT')) {
          if (termStr) {
            records.push({
              id: `${recId}_appr_${termStr}`,
              sourceFile: fileName,
              grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
              apprenticeship: { term: termStr, company: companyStr || '도제 OJT' }
            });
          }
        } else if (catStr.includes('취업확정') || catStr.includes('조기취업') || catStr.includes('취업')) {
          records.push({
            id: `${recId}_employed`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            employedEarly: { confirmed: true, company: companyStr || '취업 확정' }
          });
        }
      }

      // E. 현장실습 파싱 (단일 컬럼)
      if (colMap.fieldTraining !== -1 && row[colMap.fieldTraining]) {
        const val = row[colMap.fieldTraining];
        const isComp = normalizeBoolean(val);
        const compName = typeof val === 'string' && val.length > 1 && !normalizeBoolean(val) ? val : '현장실습 이수';
        if (isComp) {
          records.push({
            id: `${recId}_field`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            fieldTraining: { completed: true, company: compName }
          });
        }
      }

      // F. 도제 OJT 파싱
      if (colMap.apprTerm !== -1 && row[colMap.apprTerm]) {
        const term = normalizeTerm(row[colMap.apprTerm]);
        const comp = String(row[colMap.apprCompany !== -1 ? colMap.apprCompany : colMap.apprTerm] || '').trim();
        if (term) {
          records.push({
            id: `${recId}_appr_${term}`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            apprenticeship: { term, company: comp || '도제 OJT' }
          });
        }
      }
      const apprCols: [StandardTerm, number][] = [
        ['2-1', colMap.appr21], ['2-2', colMap.appr22],
        ['3-1', colMap.appr31], ['3-2', colMap.appr32]
      ];
      for (const [t, cIdx] of apprCols) {
        if (cIdx !== -1 && row[cIdx]) {
          const comp = String(row[cIdx]).trim();
          if (comp && comp !== 'X' && comp !== '미참여') {
            records.push({
              id: `${recId}_appr_${t}`,
              sourceFile: fileName,
              grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
              apprenticeship: { term: t, company: comp }
            });
          }
        }
      }

      // G. 조기취업 확정 파싱
      if (colMap.employedEarly !== -1 && row[colMap.employedEarly]) {
        const val = row[colMap.employedEarly];
        const isEmp = normalizeBoolean(val) || (typeof val === 'string' && val.trim().length > 0 && val !== '미확정' && val !== 'X');
        if (isEmp) {
          records.push({
            id: `${recId}_employed`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            employedEarly: { confirmed: true, company: String(val).trim() }
          });
        }
      }

      // G. 산학교육 이수 파싱
      if (colMap.edu1 !== -1 && row[colMap.edu1]) {
        const eduTitle = String(row[colMap.edu1]).trim();
        const eduDate = colMap.eduDate !== -1 ? String(row[colMap.eduDate] || '').trim() : '';
        if (eduTitle && eduTitle !== 'X' && eduTitle !== '미이수') {
          records.push({
            id: `${recId}_edu`,
            sourceFile: fileName,
            grade: parsedGrade, major, classNumber, studentNumber, studentName: rawName,
            industryEdu: { title: eduTitle, dateOrTerm: eduDate }
          });
        }
      }
    }
  }

  return records;
}

/**
 * 엑셀 파일에 등장한 학생 단위 행 데이터 (업로드된 학생들만 표시)
 */
export interface UploadedStudentEmploymentRow {
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
  selectedStudentId?: string; // 드롭다운으로 선택된 학생 ID

  // 매칭된 실제 DB 학적 (있을 경우)
  studentId?: string;
  studentName: string;
  currentGrade?: number;
  currentClass?: number;
  currentNumber?: number;
  currentMajor?: string;

  // 슬롯 기반 정형화 데이터
  industryEduList: { id: string; title: string; dateOrTerm?: string }[];
  careerCourses: Record<string, string>; // { "1-1": "청솔반", "2-1": "취업맞춤반" }
  majorClubs: Record<string, string>;    // { "1": "로봇제어반", "2": "로봇제어반" }
  skillsContest?: { level: 'national' | 'regional' | 'none'; name: string };
  fieldTraining?: { completed: boolean; company?: string };
  apprenticeship: Record<string, string>; // { "2-1": "(주)한화솔루션" }
  employedEarly?: { confirmed: boolean; company?: string };

  // 실시간 계산 점수
  industryEduCount: number;
  industryEduScore: number;
  careerCourseSemesters: number;
  careerCourseScore: number;
  majorClubYears: number;
  majorClubScore: number;
  skillsContestScore: number;
  enhancementScore: number;
  
  fieldTrainingScore: number;
  apprenticeshipScore: number;
  employedEarlyScore: number;
  fieldParticipationScore: number;

  totalEmploymentScore: number;
}

/**
 * 점수 계산 헬퍼
 */
export function calcCourseScore(semesters: number): number {
  if (semesters >= 4) return 10.0;
  if (semesters === 3) return 8.0;
  if (semesters === 2) return 6.0;
  if (semesters === 1) return 4.0;
  return 0.0;
}

export function calcClubScore(years: number): number {
  if (years >= 3) return 5.0;
  if (years === 2) return 4.0;
  if (years === 1) return 3.0;
  return 0.0;
}

export function calcApprScore(semesters: number): number {
  if (semesters >= 4) return 5.0;
  if (semesters === 3) return 4.0;
  if (semesters === 2) return 3.0;
  if (semesters === 1) return 2.0;
  return 0.0;
}

/**
 * 업로드된 엑셀에 등장하는 학생들만 추출하여 DB 대조 및 누적 병합하는 엔진
 */
export function buildUploadedOnlyEmploymentRows(
  activeStudents: any[],
  existingStore: Record<string, any>,
  uploadedRecords: RawEmploymentRecord[],
  manualSelections: Record<string, string> = {},
  baseYear: number = 2026
): UploadedStudentEmploymentRow[] {
  if (uploadedRecords.length === 0) return [];

  // 1. 엑셀에 등장하는 고유 학생 그룹핑 (이름 + 학년/과/반/번호 기준)
  const studentGroups = new Map<string, RawEmploymentRecord[]>();

  for (const r of uploadedRecords) {
    const key = `${r.grade || ''}_${r.major}_${r.classNumber}_${r.studentNumber}_${r.studentName}`;
    if (!studentGroups.has(key)) {
      studentGroups.set(key, []);
    }
    studentGroups.get(key)!.push(r);
  }

  const resultRows: UploadedStudentEmploymentRow[] = [];

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
    const toNum = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const parsed = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) ? null : parsed;
    };
    const toMajor = (m: any) => String(m || '').trim().replace(/\s+/g, '').replace(/과$/, '').replace(/계열$/, '');

    const excelGrade = toNum(rawGrade);
    const excelClass = toNum(rawClass);
    const excelNum = toNum(rawNum);
    const excelMajor = toMajor(rawMajor);

    // 수동 선택이 있으면 최우선 적용
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
        
        // 학년/반/번호/학과가 명시되어 있을 때 불일치 검증
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
        // 동명이인 다수 존재 -> 학년, 반, 번호, 학과로 좁히기
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

    // 3. 업로드된 파일 내의 순수 데이터만 추출 (기존 DB 데이터와 혼합하지 않고, 업로드 파일의 실적만 정확히 반영)
    const industryEduList: { id: string; title: string; dateOrTerm?: string }[] = [];
    const careerCourses: Record<string, string> = {};
    const majorClubs: Record<string, string> = {};
    let skillsContest: { level: 'national' | 'regional' | 'none'; name: string; award?: string } | undefined = undefined;
    let fieldTraining: { completed: boolean; company?: string } | undefined = undefined;
    const apprenticeship: Record<string, string> = {};
    let employedEarly: { confirmed: boolean; company?: string } | undefined = undefined;

    // 엑셀에서 올라온 레코드들을 슬롯에 누적 병합
    for (const r of records) {
      if (r.industryEdu) {
        const eduId = `${r.industryEdu.dateOrTerm || ''}_${r.industryEdu.title}`;
        if (!industryEduList.some(e => e.id === eduId)) {
          industryEduList.push({ id: eduId, title: r.industryEdu.title, dateOrTerm: r.industryEdu.dateOrTerm });
        }
      }
      if (r.careerCourse) {
        careerCourses[r.careerCourse.term] = r.careerCourse.courseName;
      }
      if (r.majorClub) {
        majorClubs[String(r.majorClub.grade)] = r.majorClub.clubName;
      }
      if (r.skillsContest && r.skillsContest.level !== 'none') {
        if (!skillsContest || (r.skillsContest.level === 'national' && skillsContest.level !== 'national')) {
          skillsContest = r.skillsContest;
        }
      }
      if (r.fieldTraining && r.fieldTraining.completed) {
        fieldTraining = r.fieldTraining;
      }
      if (r.apprenticeship) {
        apprenticeship[r.apprenticeship.term] = r.apprenticeship.company || '도제 OJT';
      }
      if (r.employedEarly && r.employedEarly.confirmed) {
        employedEarly = r.employedEarly;
      }
    }

    // 4. 점수 계산 (이번 업로드 파일 기준 점수)
    const industryEduCount = industryEduList.length;
    const industryEduScore = Math.min(10.0, industryEduCount * 1.0);

    const careerCourseSemesters = Object.keys(careerCourses).length;
    const careerCourseScore = calcCourseScore(careerCourseSemesters);

    const majorClubYears = Object.keys(majorClubs).length;
    const majorClubScore = calcClubScore(majorClubYears);

    const skillsContestScore = skillsContest?.level === 'national' ? 5.0 : (skillsContest?.level === 'regional' ? 2.0 : 0.0);
    const enhancementScore = Math.min(10.0, Math.max(careerCourseScore, majorClubScore, skillsContestScore));

    const fieldTrainingScore = fieldTraining?.completed ? 5.0 : 0.0;
    const apprenticeshipSemesters = Object.keys(apprenticeship).length;
    const apprenticeshipScore = calcApprScore(apprenticeshipSemesters);
    const employedEarlyScore = employedEarly?.confirmed ? 5.0 : 0.0;
    const fieldParticipationScore = Math.min(5.0, Math.max(fieldTrainingScore, apprenticeshipScore, employedEarlyScore));

    const totalEmploymentScore = Math.round((industryEduScore + enhancementScore + fieldParticipationScore) * 10) / 10;

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

      industryEduList,
      careerCourses,
      majorClubs,
      skillsContest,
      fieldTraining,
      apprenticeship,
      employedEarly,

      industryEduCount,
      industryEduScore,
      careerCourseSemesters,
      careerCourseScore,
      majorClubYears,
      majorClubScore,
      skillsContestScore,
      enhancementScore,

      fieldTrainingScore,
      apprenticeshipScore,
      employedEarlyScore,
      fieldParticipationScore,

      totalEmploymentScore,
    });
  });

  return resultRows;
}

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
 * 엑셀 표준 세부 서식 5종 생성기 (드롭다운 유효성 검사 및 스타일 탑재)
 */
export async function generateEmploymentTemplate(
  type: 'course' | 'club' | 'contest' | 'field' | 'edu' = 'course',
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

  if (type === 'course') {
    const ws = wb.addWorksheet('취업진로코스명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 취업진로코스 참여 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [참여학기], [코스명] 셀을 클릭하시면 드롭다운 목록이 나타납니다. 목록에 있는 표준 항목만 선택해주세요.']);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '참여학기', '코스명', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '2-1', '취업맞춤반', ''],
      [2, '스마트전기과', 1, 2, '김철수', '2-1', '중견기업반', ''],
      [1, '자동화기계과', 1, 1, '박지민', '1-2', '청솔반', ''],
      [3, '바이오화학과', 1, 1, '정우성', '2-2', '반도체아카데미반', ''],
      [2, '친환경자동차과', 1, 1, '강민수', '3-1', '부사관반', '']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 14 }, // 참여학기
      { width: 22 }, // 코스명
      { width: 18 }, // 비고
    ];

    // 드롭다운 검사 적용
    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'], '학기 선택 오류', '1-1, 1-2, 2-1, 2-2, 3-1, 3-2 중 선택해주세요.');
    applyDropdownValidation(ws, 7, [
      '청솔반', '취업맞춤반', '중견기업반', '반도체아카데미반', '혁신인재반', '부사관반', '군특성화반', '산학일체도제반'
    ], '코스명 선택 오류', '공식 취업진로코스 목록에서 선택해주세요.');

  } else if (type === 'edu') {
    const ws = wb.addWorksheet('산학교육이수명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 산학협력 교육이수 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과] 셀을 클릭하시면 드롭다운 목록이 나타납니다. (1회당 1점씩 자동 누적)']);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '교육행사명', '이수일자(또는 학기)', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '우수기업 채용설명회', `${academicYear}-05-12`, ''],
      [2, '스마트전기과', 1, 2, '김철수', '우수기업 채용설명회', `${academicYear}-05-12`, ''],
      [1, '자동화기계과', 1, 1, '강민수', '충남 직업교육 취업박람회', `${academicYear}-10-15`, '']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 28 }, // 교육행사명
      { width: 20 }, // 이수일자
      { width: 18 }, // 비고
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');

  } else if (type === 'club') {
    const ws = wb.addWorksheet('전공동아리명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 전공심화동아리 참여 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [참여학년] 셀을 클릭하시면 드롭다운 목록이 나타납니다.']);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '참여학년', '동아리명', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '2학년', '전공심화 로봇제어반', ''],
      [2, '자동화기계과', 1, 1, '김철수', '2학년', '전공심화 기계가공반', '']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 14 }, // 참여학년
      { width: 24 }, // 동아리명
      { width: 18 }, // 비고
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['1학년', '2학년', '3학년'], '참여학년 선택 오류', '1학년, 2학년, 3학년 중 선택해주세요.');

  } else if (type === 'contest') {
    const ws = wb.addWorksheet('기능대회입상명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 기능경기대회 입상 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [대회구분], [입상내역] 셀을 클릭하시면 드롭다운 목록이 나타납니다.']);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '대회구분', '직종', '입상내역', '수상연도']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '전국기능경기대회', '산업제어', '동상', `${academicYear}`],
      [2, '자동화기계과', 1, 1, '김철수', '지방기능경기대회', 'CNC선반', '금상', `${academicYear}`]
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 20 }, // 대회구분
      { width: 16 }, // 직종
      { width: 14 }, // 입상내역
      { width: 12 }, // 수상연도
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['전국기능경기대회', '지방기능경기대회'], '대회구분 선택 오류', '전국기능경기대회 또는 지방기능경기대회 중 선택해주세요.');
    applyDropdownValidation(ws, 8, ['금상', '은상', '동상', '우수상', '장려상'], '입상내역 선택 오류', '금상, 은상, 동상, 우수상, 장려상 중 선택해주세요.');

  } else if (type === 'field') {
    const ws = wb.addWorksheet('현장실습_도제_취업명단');
    ws.views = [{ showGridLines: true }];

    ws.addRow([`${academicYear}학년도 현장실습 / 도제OJT / 취업확정 명단 일괄 등록 서식`]);
    ws.addRow(['※ [학년], [학과], [구분], [참여학기] 셀을 클릭하시면 드롭다운 목록이 나타납니다.']);
    ws.addRow([]);
    
    const headerRow = ws.addRow(['학년', '학과', '반', '번호', '이름', '구분', '참여학기', '업체명(기업명)', '비고']);
    applyHeaderStyle(headerRow);

    const sampleRows = [
      [3, '스마트전기과', 1, 1, '홍길동', '현장실습', '3-2', '(주)삼성전기', '이수완료'],
      [3, '스마트전기과', 1, 1, '홍길동', '취업확정', '3-2', '(주)한화솔루션', '조기취업'],
      [2, '자동화기계과', 1, 1, '김철수', '도제OJT', '2-1', '(주)한화솔루션', 'OJT 참여']
    ];
    sampleRows.forEach(r => ws.addRow(r));

    ws.columns = [
      { width: 10 }, // 학년
      { width: 18 }, // 학과
      { width: 8 },  // 반
      { width: 8 },  // 번호
      { width: 14 }, // 이름
      { width: 16 }, // 구분
      { width: 14 }, // 참여학기
      { width: 24 }, // 업체명
      { width: 18 }, // 비고
    ];

    applyDropdownValidation(ws, 1, ['1', '2', '3'], '학년 선택 오류', '1, 2, 3 중 선택해주세요.');
    applyDropdownValidation(ws, 2, STANDARD_MAJORS, '학과 선택 오류', '학교 공식 학과 목록에서 선택해주세요.');
    applyDropdownValidation(ws, 6, ['현장실습', '도제OJT', '취업확정'], '구분 선택 오류', '현장실습, 도제OJT, 취업확정 중 선택해주세요.');
    applyDropdownValidation(ws, 7, ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'], '학기 선택 오류', '1-1, 1-2, 2-1, 2-2, 3-1, 3-2 중 선택해주세요.');
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

