import * as XLSX from 'xlsx';

export interface ParsedNeisVolunteerStudent {
  grade: number;
  classInfo: string;
  major: string;
  studentNumber: string;
  studentName: string;
  schoolHours: number;
  outsideHours: number;
  totalHours: number;
  calculatedScore: number;
  activityCount: number;
  details?: Array<{
    date: string;
    location: string;
    content: string;
    hours: number;
    isSchool: boolean;
  }>;
}

export interface ParseVolunteerResult {
  fileName: string;
  students: ParsedNeisVolunteerStudent[];
  totalActivities: number;
  error?: string;
}

/**
 * 나이스(NEIS) 학교생활기록부 봉사활동상황 엑셀 워크북을 파싱합니다.
 */
export function parseNeisVolunteerWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string = ''
): ParseVolunteerResult {
  try {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return { fileName, students: [], totalActivities: 0, error: '시트를 찾을 수 없습니다.' };
    }

    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length < 4) {
      return { fileName, students: [], totalActivities: 0, error: '유효한 나이스 봉사활동 데이터가 아닙니다.' };
    }

    let currentGrade = 3;
    let currentClass = '';
    let currentMajor = '';
    let currentNum = '';
    let currentName = '';

    const studentMap = new Map<string, ParsedNeisVolunteerStudent>();
    let totalActivities = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] || '').trim();

      // 1. 학급 헤더 감지: e.g. "공업계 스마트전기과 3학년 1반"
      if (firstCell.includes('학년') && firstCell.includes('반')) {
        const gMatch = firstCell.match(/(\d)\s*학년/);
        const cMatch = firstCell.match(/(\d+)\s*반/);
        const mMatch = firstCell.match(/([가-힣]+과)/);
        if (gMatch) currentGrade = parseInt(gMatch[1], 10);
        if (cMatch) currentClass = cMatch[1] + '반';
        if (mMatch) currentMajor = mMatch[1];
        continue;
      }

      // 2. 페이지 번호 푸터 (e.g. 1 / 23 대구공업고등학교) 또는 불필요한 행 스킵
      const rowStr = row.map(c => String(c || '').trim()).join(' ');
      if (
        rowStr.includes('대구공업고등학교') && rowStr.includes('/') ||
        firstCell === '번 호' ||
        firstCell === '번호' ||
        firstCell === '학교생활기록부 봉사활동상황' ||
        firstCell.includes('사용자명') ||
        String(row[1] || '').trim() === '성  명' ||
        String(row[1] || '').trim() === '성명'
      ) {
        continue;
      }

      // 3. 학생 번호 및 성명 추출 (새 학생 시작 시 업데이트, 병합 셀이면 유지)
      if (row[0] !== null && row[0] !== undefined && String(row[0]).trim() !== '' && !isNaN(Number(row[0]))) {
        currentNum = String(row[0]).trim();
      }
      if (row[1] !== null && row[1] !== undefined && String(row[1]).trim() !== '' && isNaN(Number(row[1]))) {
        currentName = String(row[1]).trim().replace(/\s+/g, '');
      }

      const dateStr = String(row[3] || '').trim();
      const locationStr = String(row[4] || '').trim();
      const contentStr = String(row[5] || '').trim();
      const hours = Number(row[6]) || 0;

      // 날짜 형식(YYYY.MM.DD)과 장소 정보가 있는 유효한 봉사활동 행인지 검증
      const hasValidDate = /\d{4}\.\d{2}\.\d{2}/.test(dateStr);
      if (currentName && currentNum && hasValidDate && hours > 0) {
        const studentKey = `${currentGrade}_${currentClass}_${currentNum}_${currentName}`;

        if (!studentMap.has(studentKey)) {
          studentMap.set(studentKey, {
            grade: currentGrade,
            classInfo: currentClass,
            major: currentMajor,
            studentNumber: currentNum,
            studentName: currentName,
            schoolHours: 0,
            outsideHours: 0,
            totalHours: 0,
            calculatedScore: 0,
            activityCount: 0,
            details: [],
          });
        }

        const student = studentMap.get(studentKey)!;
        const isSchool = locationStr.startsWith('(학교)') || locationStr.includes('대구공업고등학교');

        if (isSchool) {
          student.schoolHours += hours;
        } else {
          student.outsideHours += hours;
        }

        student.activityCount += 1;
        student.details?.push({
          date: dateStr,
          location: locationStr,
          content: contentStr,
          hours,
          isSchool,
        });

        totalActivities += 1;
      }
    }

    // 4. 학생별 총 시간 및 옥저인재인증제 점수 최종 산출
    const students: ParsedNeisVolunteerStudent[] = Array.from(studentMap.values()).map(st => {
      const totalHours = st.schoolHours + st.outsideHours;
      let calculatedScore = 0;
      if (totalHours >= 200) {
        calculatedScore = 5.0;
      } else {
        const raw = (st.schoolHours * 0.025) + (st.outsideHours * 0.05);
        calculatedScore = Math.min(5, Math.max(0, Math.round(raw * 10) / 10));
      }

      return {
        ...st,
        totalHours,
        calculatedScore,
      };
    });

    return {
      fileName,
      students,
      totalActivities,
    };
  } catch (err: any) {
    return {
      fileName,
      students: [],
      totalActivities: 0,
      error: err.message || '엑셀 분석 중 오류가 발생했습니다.',
    };
  }
}
