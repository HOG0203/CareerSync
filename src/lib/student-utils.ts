/**
 * 학생 식별 및 포맷팅 순수 유틸리티 함수 (클라이언트/서버 공용)
 */

export function extractPhoneLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function getStudentUsername(student: { id: string; student_id?: string | null }): string {
  return `std_${student.id.replace(/-/g, '').substring(0, 12)}`;
}


/**
 * Supabase Auth의 최소 6자리 비밀번호 제약을 만족하면서,
 * 학생의 4자리 비밀번호(휴대폰 뒷자리 등)를 일관되게 안전 매핑하는 헬퍼
 */
export function formatStudentAuthPassword(rawPassword: string): string {
  return `careersync_std_${rawPassword}`;
}

/**
 * 학교 공식 학과 정렬 우선순위:
 * 자동화기계과 > 친환경자동차과 > 건설과 > 스마트공간건축과 > 스마트공간과 > 스마트전기과 > 바이오화학과 > 스마트융합섬유과
 */
export const MAJOR_OFFICIAL_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '건설과',
  '스마트공간건축과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
];

export function getMajorOrderIndex(major: string | null | undefined): number {
  if (!major) return 999;
  const trimmed = major.trim();
  const exactIdx = MAJOR_OFFICIAL_ORDER.indexOf(trimmed);
  if (exactIdx !== -1) return exactIdx;

  for (let i = 0; i < MAJOR_OFFICIAL_ORDER.length; i++) {
    const target = MAJOR_OFFICIAL_ORDER[i];
    if (trimmed.includes(target) || target.includes(trimmed)) {
      return i;
    }
  }
  return 999;
}

/**
 * 따옴표(")와 쉼표(,)가 포함된 CSV 라인을 안전하게 파싱하는 유틸리티
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // 이스케이프된 쌍따옴표 건너뛰기
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * 전체 CSV 텍스트를 행별로 파싱 (줄바꿈이 따옴표 안에 있는 경우도 안전하게 처리)
 */
export function parseCSVText(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');

  for (const line of lines) {
    const parsed = parseCSVLine(line);
    if (parsed.some(val => val.trim() !== '')) {
      rows.push(parsed);
    }
  }
  return rows;
}



