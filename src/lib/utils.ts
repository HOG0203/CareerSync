import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 학과명을 표준 약칭으로 변환
 * - 자동화기계과 -> 기계
 * - 친환경자동차과 -> 자동차
 * - 스마트공간과 -> 공간
 * - 건설과 -> 건설
 * - 스마트공간건축과 -> 건축
 * - 스마트전기과 / 전기과 -> 전기
 * - 바이오화학과 -> 화공
 * - 스마트융합섬유과 / 섬유소재과 -> 섬유
 */
export function getShortMajorName(major?: string): string {
  if (!major) return '';
  const m = major.trim();
  if (m === '친환경자동차과' || m === '친환경자동차') return '자동차';
  if (m.includes('자동화기계') || m.includes('기계')) return '기계';
  if (m.includes('자동차')) return '자동차';
  if (m.includes('건축')) return '건축';
  if (m.includes('공간')) return '공간';
  if (m.includes('건설')) return '건설';
  if (m.includes('전기')) return '전기';
  if (m.includes('화학') || m.includes('화공') || m.includes('바이오')) return '화공';
  if (m.includes('섬유')) return '섬유';
  return m.replace(/과$/, '').replace(/^스마트/, '');
}

/**
 * 학생의 학과학년-반 표기 생성 (예: 기계3-1, 자동차2-2, 화공1-1)
 */
export function formatStudentClassTag(student: { grade?: number; major?: string; class_info?: string; classInfo?: string }): string {
  const grade = student.grade || 3;
  const shortMajor = getShortMajorName(student.major);
  const rawClass = (student.class_info || (student as any).classInfo || '').toString().replace(/반$/, '').trim();
  return `${shortMajor}${grade}-${rawClass}`;
}
