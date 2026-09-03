import { DEPARTMENT_CODE_MAP } from '@/lib/timetable/constants';

export function formatDeptFullName(rawDept?: string, rawClassCode?: string): string {
  const code = (rawClassCode || '').trim();
  const firstChar = code[0];
  if (firstChar && DEPARTMENT_CODE_MAP[firstChar]) {
    return DEPARTMENT_CODE_MAP[firstChar];
  }
  if (rawDept && rawDept.trim()) {
    const trimmed = rawDept.trim();
    if (trimmed.length > 2) return trimmed;
  }

  if (code.startsWith('기')) return '자동화기계과';
  if (code.startsWith('차') || code.startsWith('자')) return '친환경자동차과';
  if (code.startsWith('전')) return '스마트전기과';
  if (code.startsWith('화') || code.startsWith('바')) return '바이오화학과';
  if (code.startsWith('섬') || code.startsWith('융')) return '스마트융합섬유과';
  if (code.startsWith('건')) return '건설과';
  if (code.startsWith('축')) return '스마트공간건축과';
  if (code.startsWith('공')) return '스마트공간과';
  if (code.startsWith('도')) return '도제학급';

  return rawDept?.trim() || '';
}

export function formatClassGradeAndRoom(rawClassCode?: string): string {
  if (!rawClassCode) return '';
  const trimmed = rawClassCode.trim();
  if (!trimmed) return '';

  if (/^\d+-\d+$/.test(trimmed)) return trimmed;

  const matchWithDept = trimmed.match(/[가-힣]*(\d)[-\s_]?(\d+)/);
  if (matchWithDept) return `${matchWithDept[1]}-${matchWithDept[2]}`;

  const matchKorean = trimmed.match(/(\d+)\s*학년\s*(\d+)\s*반/);
  if (matchKorean) return `${matchKorean[1]}-${matchKorean[2]}`;

  if (/^\d{2}$/.test(trimmed)) return `${trimmed[0]}-${trimmed[1]}`;

  return trimmed;
}
