import { StudentEmploymentData } from '@/lib/data';
import { CustomRule } from '@/types/custom-rule';

/**
 * 학생 1명에 대해 CustomRule 조건 일치 여부를 판별하는 공통 평가 함수
 */
export function evaluateCustomRuleMatch(
  student: StudentEmploymentData,
  customRule: CustomRule | null,
  rankingSummary?: any
): boolean {
  if (!customRule || !customRule.conditions || customRule.conditions.length === 0) return false;

  const certList = Array.isArray(student.certificates)
    ? student.certificates
    : (typeof student.certificates === 'string' ? [student.certificates] : []);
  const certCount = certList.length;

  const matches = customRule.conditions.map(cond => {
    // 0. 학과 대분류 (단일 및 다중 선택 지원)
    if (cond.mainCategory === 'major' || (cond as any).category === 'major') {
      if (!cond.value || cond.value.trim() === '') return true;
      const selectedMajors = cond.value.split(',').map(m => m.trim()).filter(Boolean);
      if (selectedMajors.length === 0) return true;
      const studentMajor = (student.major || '').trim();
      return selectedMajors.some(m => {
        const cleanM = m.replace(/과|공업계/g, '').trim();
        const cleanSM = studentMajor.replace(/과|공업계/g, '').trim();
        return (
          studentMajor === m ||
          studentMajor.includes(m) ||
          m.includes(studentMajor) ||
          (cleanM && cleanSM && (cleanSM.includes(cleanM) || cleanM.includes(cleanSM)))
        );
      });
    }

    // 0.1 희망진로코스 / 현재진로코스 대분류 (단일 및 다중 선택 지원)
    if (cond.mainCategory === 'course' || (cond as any).category === 'course') {
      if (!cond.value || cond.value.trim() === '') return false;
      const selectedCourses = cond.value.split(',').map(c => c.trim()).filter(Boolean);
      if (selectedCourses.length === 0) return false;
      const studentCourse = (student.career_course || '').trim();
      return selectedCourses.some(
        c => studentCourse === c || (c && studentCourse.includes(c))
      );
    }

    // 0.2 현재진로코스 대분류 (단일 및 다중 선택 지원)
    if (cond.mainCategory === 'current_course' || (cond as any).category === 'current_course') {
      if (!cond.value || cond.value.trim() === '') return false;
      const selectedCourses = cond.value.split(',').map(c => c.trim()).filter(Boolean);
      if (selectedCourses.length === 0) return false;
      const studentCurrentCourse = (student.employment_status || '').trim();
      return selectedCourses.some(
        c => studentCurrentCourse === c || (c && studentCurrentCourse.includes(c))
      );
    }

    // 1. 자격증 대분류
    if (
      cond.mainCategory === 'cert' ||
      (cond as any).category === 'cert_name' ||
      (cond as any).category === 'cert_count'
    ) {
      const isName = cond.subType === 'name' || (cond as any).category === 'cert_name';
      if (isName) {
        const query = (cond.value || '').toLowerCase().trim();
        if (!query) return true;
        return certList.some((c: string) => c.toLowerCase().includes(query));
      } else {
        if (cond.value === '1+') return certCount >= 1;
        if (cond.value === '2+') return certCount >= 2;
        if (cond.value === '3+') return certCount >= 3;
        if (cond.value === '0') return certCount === 0;
        return true;
      }
    }

    // 2. 출결 대분류
    const attn = rankingSummary?.attendance;
    const unexcusedTotal =
      (attn?.unexcused?.absent || 0) +
      (attn?.unexcused?.late || 0) +
      (attn?.unexcused?.early || 0) +
      (attn?.unexcused?.out || 0) +
      (rankingSummary?.unexcused_absent_count || 0) +
      (rankingSummary?.unexcused_late_count || 0);
    const diseaseTotal =
      (attn?.disease?.absent || 0) +
      (attn?.disease?.late || 0) +
      (attn?.disease?.early || 0) +
      (attn?.disease?.out || 0);
    const otherTotal =
      (attn?.other?.absent || 0) +
      (attn?.other?.late || 0) +
      (attn?.other?.early || 0) +
      (attn?.other?.out || 0);

    if (
      cond.mainCategory === 'attendance' ||
      (cond as any).category?.startsWith('attendance')
    ) {
      const sub = cond.subType || (cond as any).category?.replace('attendance_', '');
      if (sub === 'perfect' || sub === 'attendance_perfect') {
        return unexcusedTotal === 0 && diseaseTotal === 0 && otherTotal === 0;
      }
      if (sub === 'unexcused' || sub === 'attendance_unexcused') {
        const limit = parseInt(String(cond.value).replace('le_', '')) || 0;
        return unexcusedTotal <= limit;
      }
      if (sub === 'disease' || sub === 'attendance_disease') {
        const limit = parseInt(String(cond.value).replace('le_', '')) || 0;
        return diseaseTotal <= limit;
      }
    }

    // 3. 취업/진로 대분류
    if (cond.mainCategory === 'status' || (cond as any).category === 'status') {
      const status = student.employment_status || '';
      const bType = student.business_type || '';
      const aspiration = student.career_aspiration || '';
      const val = cond.value;

      if (val === '미취업') {
        if (bType === '진학' || status === '진학' || aspiration === '진학') return false;
        if (bType === '제외인정자' || status === '제외인정자' || aspiration === '제외인정자') return false;
        if (['취업', '현장실습중', '도제OJT', '채용진행중'].includes(bType) || status === '취업') return false;
        return (
          bType === '미취업' ||
          bType === '아니오' ||
          status === '미취업' ||
          status === '미설정' ||
          (!bType && !status)
        );
      }
      if (val === '취업') return bType === '취업' || status === '취업';
      if (val === '현장실습/도제OJT' || val === '현장실습중' || val === '도제OJT') {
        const isTrainingType = ['현장실습중', '현장실습', '도제OJT', '도제'].some(k => bType.includes(k));
        const hasRecord =
          student.has_field_training === 'O' ||
          (student.training_records && student.training_records.length > 0);
        const isDojeCourse = (student.career_course || '').includes('도제');
        return isTrainingType || hasRecord || isDojeCourse;
      }
      if (val === '채용진행중') return bType === '채용진행중';
      if (val === '진학') return status === '진학' || bType === '진학' || aspiration === '진학';
      if (val === '제외인정자') return bType === '제외인정자' || status === '제외인정자' || aspiration === '제외인정자';
      return true;
    }

    // 4. 성적/석차 대분류
    if (cond.mainCategory === 'rank' || (cond as any).category === 'rank') {
      const pct = rankingSummary?.rank_percentile;
      if (pct === undefined || pct === null) return false;
      if (cond.value === 'top30') return pct <= 30;
      if (cond.value === 'top50') return pct <= 50;
      return true;
    }

    return true;
  });

  if (customRule.operator === 'OR') {
    return matches.some(m => m === true);
  }
  return matches.every(m => m === true);
}
