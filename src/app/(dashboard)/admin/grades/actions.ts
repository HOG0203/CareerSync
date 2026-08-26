'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ParsedGradeData = {
  studentId?: string; // 클라이언트에서 확정된 UUID
  studentName: string;
  studentNumber: string;
  subject: string;
  score: number | null;
  averageScore: number | null;
  standardDeviation: number | null;
  semester: number;
  gradeObtained: number;
  credits: number | null;
  achievement: string | null;
  rankGrade: string | null;
  major?: string;
  classInfo?: string;
  currentGrade: number;
}

/**
 * 이름/번호/학과/반을 기반으로 DB에서 실제 UUID(student_id)를 정확히 추출
 */
export async function matchStudents(
  studentKeys: { name: string; number: string; major?: string; classInfo?: string; currentGrade: number }[], 
  academicYear: number
) {
  const supabase = await createClient()
  const matchMap: Record<string, { id: string; major: string; classInfo: string }> = {};
  const allGradeStudents: { id: string; name: string; number: string; major: string; classInfo: string; currentGrade: number }[] = [];

  // 학년별로 키 그룹화하여 Supabase 쿼리 최소화 및 분기 처리
  const keysByGrade: Record<number, typeof studentKeys> = {};
  studentKeys.forEach(key => {
    if (!keysByGrade[key.currentGrade]) {
      keysByGrade[key.currentGrade] = [];
    }
    keysByGrade[key.currentGrade].push(key);
  });

  for (const gradeStr of Object.keys(keysByGrade)) {
    const currentGrade = parseInt(gradeStr);
    const gradYear = academicYear + (4 - currentGrade);

    // 해당 학년 전체 학생 명단 확보
    const { data: allStudents, error } = await supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info')
      .eq('graduation_year', gradYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true });

    if (error || !allStudents) continue;

    allStudents.forEach(s => {
      allGradeStudents.push({
        id: s.id,
        name: s.student_name,
        number: s.student_number,
        major: s.major,
        classInfo: s.class_info,
        currentGrade
      });
    });

    keysByGrade[currentGrade].forEach(key => {
      const targetNum = Number(key.number);
      const targetName = key.name.trim();
      const targetMajorKey = (key.major || '').replace('스마트', '').replace('자동화', '').replace('과', '').trim();
      const targetClassNum = Number(key.classInfo?.replace(/[^0-9]/g, ''));

      // 1순위: 학과, 반, 번호, 성명 완벽 일치
      let matched = allStudents.find(s => {
        const sName = (s.student_name || '').trim();
        const sNum = Number(s.student_number);
        const sMajor = (s.major || '');
        const sClassNum = Number(s.class_info?.replace(/[^0-9]/g, ''));

        return sName === targetName && 
               sNum === targetNum && 
               (targetMajorKey ? sMajor.includes(targetMajorKey) : true) &&
               (targetClassNum ? sClassNum === targetClassNum : true);
      });

      // 2순위: 학과 정보가 없는 경우 (전과목 성적 일람표 양식) 반, 번호, 성명 일치
      if (!matched && targetClassNum && targetNum) {
        matched = allStudents.find(s => {
          const sName = (s.student_name || '').trim();
          const sNum = Number(s.student_number);
          const sClassNum = Number(s.class_info?.replace(/[^0-9]/g, ''));
          return sName === targetName && sNum === targetNum && sClassNum === targetClassNum;
        });
      }

      // 3순위: 해당 학년에 동명이인이 없는 경우 성명 단독 일치
      if (!matched) {
        const nameMatches = allStudents.filter(s => (s.student_name || '').trim() === targetName);
        if (nameMatches.length === 1) {
          matched = nameMatches[0];
        }
      }

      if (matched) {
        // 학과_반_번호_이름 조합 키로 UUID 정보 전달
        const mapKey = `${key.major || ''}_${key.classInfo || ''}_${key.number}_${targetName}`;
        matchMap[mapKey] = {
          id: matched.id,
          major: matched.major || '미지정',
          classInfo: matched.class_info ? (matched.class_info.endsWith('반') ? matched.class_info : `${matched.class_info}반`) : '미지정'
        };
      }
    });
  }

  return { success: true, matchMap, gradeStudents: allGradeStudents };
}

/**
 * 전달받은 UUID(studentId)에 성적 데이터를 1:1로 저장
 */
export async function uploadStudentScores(
  data: ParsedGradeData[], 
  academicYear: number
) {
  const supabase = await createClient()

  const results = { total: data.length, success: 0, failed: 0, notMatched: [] as string[] };
  const scoresToInsert = [];
  const deleteTargets = new Set<string>();

  for (const item of data) {
    // [보안] UUID가 없는 데이터는 절대로 저장하지 않음 (오매칭 방지)
    if (!item.studentId) {
      const failKey = `${item.studentName}(${item.studentNumber}번)`;
      if (!results.notMatched.includes(failKey)) results.notMatched.push(failKey);
      results.failed++;
      continue;
    }

    // [보안] 점수(원점수)도 없고 성취도(A~E, P)도 없는 완전 빈칸/미이수 데이터만 건너뜀
    // (체육/음악 등 성취도만 부여되는 예체능 과목은 점수가 null이어도 성취도가 있으면 정상 저장)
    const hasScore = item.score !== null && item.score !== undefined && String(item.score).trim() !== '' && !isNaN(Number(item.score));
    const hasAchievement = item.achievement !== null && item.achievement !== undefined && String(item.achievement).trim() !== '';

    if (!hasScore && !hasAchievement) {
      continue;
    }

    // 실제 발생 연도 계산 (개별 학생의 업로드 시점 학년 item.currentGrade 기준 적용)
    const actualYear = academicYear - (item.currentGrade - item.gradeObtained);
    // 현재 업로드 대상 학생의 특정 학기 데이터만 정밀 삭제 타겟팅
    deleteTargets.add(`${item.studentId}_${actualYear}_${item.gradeObtained}_${item.semester}`);

    scoresToInsert.push({
      student_id: item.studentId,
      academic_year: actualYear,
      grade: item.gradeObtained,
      semester: item.semester,
      subject: item.subject.trim(),
      score: item.score,
      average_score: item.averageScore,
      standard_deviation: item.standardDeviation,
      credits: item.credits,
      achievement: item.achievement,
      rank_grade: item.rankGrade
    });
  }

  if (scoresToInsert.length > 0) {
    // 1. 타겟팅된 UUID/학기 데이터 삭제
    for (const target of Array.from(deleteTargets)) {
      const [sid, y, g, sem] = target.split('_');
      await supabase
        .from('student_scores')
        .delete()
        .eq('student_id', sid)
        .eq('academic_year', parseInt(y))
        .eq('grade', parseInt(g))
        .eq('semester', parseInt(sem));
    }

    // 2. 새로운 데이터 삽입 (최종 중복 방지)
    const finalScores: any[] = [];
    const seen = new Set<string>();
    for (let i = scoresToInsert.length - 1; i >= 0; i--) {
      const s = scoresToInsert[i];
      const key = `${s.student_id}_${s.academic_year}_${s.grade}_${s.semester}_${s.subject}`;
      if (!seen.has(key)) {
        finalScores.unshift(s);
        seen.add(key);
      }
    }

    const { error: insertError } = await supabase.from('student_scores').insert(finalScores);
    if (insertError) return { error: `성적 저장 실패: ${insertError.message}` };
    results.success = finalScores.length;
  }

  const { revalidateTag } = await import('next/cache');
  const { clearYearlyRankingsCache } = await import('@/lib/data');
  revalidateTag('student_scores');
  revalidateTag('students');
  revalidateTag('rankings-2027');
  revalidateTag('rankings-2028');
  revalidateTag('rankings-2029');
  clearYearlyRankingsCache();

  revalidatePath('/admin/grades');
  revalidatePath('/admin/certification/grades');
  revalidatePath('/employment-status');
  revalidatePath('/class-management');
  return { success: true, results };
}

export async function getAchievementScores(): Promise<Record<string, number>> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'achievement_scores').single();
    if (error) throw error;
    return data.value as Record<string, number>;
  } catch (error) {
    return { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 };
  }
}

export async function updateAchievementScores(scores: Record<string, number>) {
  const supabase = await createClient()
  try {
    const { error } = await supabase.from('system_settings').upsert({ 
      key: 'achievement_scores', value: scores, updated_at: new Date().toISOString()
    });
    if (error) throw error;
    const { revalidateTag } = await import('next/cache');
    const { clearYearlyRankingsCache } = await import('@/lib/data');
    revalidateTag('settings');
    revalidateTag('achievement-scores');
    revalidateTag('student_scores');
    clearYearlyRankingsCache();
    revalidatePath('/admin/certification/grades');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteAllStudentScores() {
  const supabase = await createClient()
  try {
    const { error } = await supabase.from('student_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    const { revalidateTag } = await import('next/cache');
    const { clearYearlyRankingsCache } = await import('@/lib/data');
    revalidateTag('student_scores');
    revalidateTag('students');
    clearYearlyRankingsCache();
    revalidatePath('/admin/grades');
    revalidatePath('/admin/certification/grades');
    revalidatePath('/employment-status');
    revalidatePath('/class-management');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
