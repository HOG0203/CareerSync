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
}

/**
 * 이름/번호/학과/반을 기반으로 DB에서 실제 UUID(student_id)를 정확히 추출
 */
export async function matchStudents(
  studentKeys: { name: string; number: string; major?: string; classInfo?: string }[], 
  academicYear: number, 
  grade: number
) {
  const supabase = await createClient()
  const gradYear = academicYear + (4 - grade);

  // 해당 학년 전체 학생 명단 확보
  const { data: allStudents, error } = await supabase
    .from('students')
    .select('id, student_name, student_number, major, class_info')
    .eq('graduation_year', gradYear);

  if (error) return { error: error.message };

  const matchMap: Record<string, { id: string; major: string; classInfo: string }> = {};
  
  studentKeys.forEach(key => {
    const targetNum = Number(key.number);
    const targetName = key.name.trim();
    const targetMajorKey = (key.major || '').replace('스마트', '').replace('자동화', '').replace('과', '').trim();
    const targetClassNum = Number(key.classInfo?.replace(/[^0-9]/g, ''));

    // [절대 원칙] 학과 키워드와 반 번호가 완벽히 일치하는 학생만 UUID 매칭
    const matched = allStudents?.find(s => {
      const sName = (s.student_name || '').trim();
      const sNum = Number(s.student_number);
      const sMajor = (s.major || '');
      const sClassNum = Number(s.class_info?.replace(/[^0-9]/g, ''));

      return sName === targetName && 
             sNum === targetNum && 
             (targetMajorKey ? sMajor.includes(targetMajorKey) : true) &&
             (targetClassNum ? sClassNum === targetClassNum : true);
    });

    if (matched) {
      // 학과_반_번호_이름 조합 키로 UUID 정보 전달
      const mapKey = `${key.major}_${key.classInfo}_${key.number}_${targetName}`;
      matchMap[mapKey] = {
        id: matched.id,
        major: matched.major || '미지정',
        classInfo: matched.class_info || '미지정'
      };
    }
  });

  return { success: true, matchMap };
}

/**
 * 전달받은 UUID(studentId)에 성적 데이터를 1:1로 저장
 */
export async function uploadStudentScores(
  data: ParsedGradeData[], 
  academicYear: number, 
  grade: number
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

    const actualYear = academicYear - (grade - item.gradeObtained);
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

  revalidatePath('/admin/grades');
  revalidatePath('/admin/grades/summary/grades');
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
    revalidatePath('/admin/grades/summary');
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
    revalidatePath('/admin/grades');
    revalidatePath('/admin/grades/summary');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
