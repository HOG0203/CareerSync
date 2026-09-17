'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';

export interface AdmissionStudentUpdatePayload {
  middle_school?: string | null;
  admission_rank_percentile?: number | null;
  admission_type?: string | null;
}

export interface ExcelAdmissionRow {
  studentNumber?: string;
  studentName: string;
  major?: string;
  middleSchool?: string;
  admissionRankPercentile?: number | null;
  admissionType?: string;
}

/**
 * 학생 1명의 출신 중학교 및 입학 전형 성적 단일 업데이트
 */
export async function updateStudentAdmissionAction(
  studentId: string,
  payload: AdmissionStudentUpdatePayload
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role === 'student') {
    return { success: false, error: '권한이 없습니다.' };
  }

  const supabase = createAdminClient();

  const updateData: Record<string, any> = {};
  if (payload.middle_school !== undefined) updateData.middle_school = payload.middle_school?.trim() || null;
  if (payload.admission_rank_percentile !== undefined) updateData.admission_rank_percentile = payload.admission_rank_percentile;
  if (payload.admission_type !== undefined) updateData.admission_type = payload.admission_type?.trim() || null;

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', studentId);

  if (error) {
    console.error('Failed to update student admission info:', error);
    return { success: false, error: error.message };
  }

  // 감사 로그 기록
  void (async () => {
    try {
      const { logAuditAction } = await import('@/lib/audit-logger');
      const { data: st } = await supabase.from('students').select('student_name').eq('id', studentId).single();
      await logAuditAction({
        actor_name: profile.full_name || profile.username,
        action_type: 'STUDENT_UPDATE',
        target_name: `${st?.student_name || '학생'} - [입학정보/출신교]`,
        details: { student_id: studentId, updated_fields: updateData }
      });
    } catch (e) {}
  })();

  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  revalidatePath('/employment-status');
  return { success: true };
}

/**
 * 엑셀 파싱 데이터를 기반으로 학생들의 출신 중학교 및 입학성적 대량 일괄 반영 (배치 업데이트)
 */
export async function batchUpdateAdmissionFromExcelAction(
  records: ExcelAdmissionRow[],
  targetGraduationYear?: number
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role === 'student') {
    return { success: false, error: '권한이 없습니다.' };
  }

  if (!records || records.length === 0) {
    return { success: false, error: '업데이트할 데이터가 없습니다.' };
  }

  const supabase = createAdminClient();

  // 대상 연도의 학생 목록을 조회하여 학번/이름 기반으로 매칭
  let studentQuery = supabase
    .from('students')
    .select('id, student_number, student_name, major, graduation_year');

  if (targetGraduationYear) {
    studentQuery = studentQuery.eq('graduation_year', targetGraduationYear);
  }

  const { data: dbStudents, error: fetchErr } = await studentQuery.range(0, 5000);

  if (fetchErr || !dbStudents) {
    return { success: false, error: '재학생 목록을 불러오는 중 오류가 발생했습니다.' };
  }

  let matchedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  // 청크 단위(50건씩) 병렬 업데이트 처리
  const CHUNK_SIZE = 50;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(
      chunk.map(async (row) => {
        const cleanName = (row.studentName || '').trim();
        const cleanNumber = (row.studentNumber || '').trim();
        const cleanMajor = (row.major || '').trim();

        if (!cleanName) {
          skippedCount++;
          return;
        }

        // 매칭 1순위: 학번 + 이름
        let matched = dbStudents.find(
          s => cleanNumber && (s.student_number || '').trim() === cleanNumber && (s.student_name || '').trim() === cleanName
        );

        // 매칭 2순위: 학번이 없는 경우 이름 + 학과
        if (!matched && cleanMajor) {
          matched = dbStudents.find(
            s => (s.student_name || '').trim() === cleanName && (s.major || '').trim().includes(cleanMajor)
          );
        }

        // 매칭 3순위: 동명이인이 없는 고유 이름
        if (!matched) {
          const sameNameStudents = dbStudents.filter(s => (s.student_name || '').trim() === cleanName);
          if (sameNameStudents.length === 1) {
            matched = sameNameStudents[0];
          }
        }

        if (!matched) {
          skippedCount++;
          errors.push(`[미매칭] ${cleanName}(${cleanNumber || cleanMajor || '정보없음'}) 학생을 시스템에서 찾을 수 없습니다.`);
          return;
        }

        const updateData: Record<string, any> = {};
        if (row.middleSchool !== undefined) updateData.middle_school = row.middleSchool?.trim() || null;
        if (row.admissionRankPercentile !== undefined) updateData.admission_rank_percentile = row.admissionRankPercentile;
        if (row.admissionType !== undefined) updateData.admission_type = row.admissionType?.trim() || null;

        let { error: updateErr } = await supabase
          .from('students')
          .update(updateData)
          .eq('id', matched.id);

        if (updateErr && (updateErr.message.includes('middle_school') || updateErr.message.includes('admission_rank_percentile') || updateErr.message.includes('admission_type'))) {
          delete updateData.middle_school;
          delete updateData.admission_rank_percentile;
          delete updateData.admission_type;
          if (Object.keys(updateData).length > 0) {
            const retry = await supabase
              .from('students')
              .update(updateData)
              .eq('id', matched.id);
            updateErr = retry.error;
          } else {
            updateErr = null;
          }
        }

        if (updateErr) {
          errors.push(`[업데이트 실패] ${cleanName}: ${updateErr.message}`);
        } else {
          matchedCount++;
        }
      })
    );
  }

  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  revalidatePath('/employment-status');

  return {
    success: true,
    matchedCount,
    skippedCount,
    errors: errors.slice(0, 10), // 화면 표시용 상위 10건
    totalErrors: errors.length,
  };
}

/**
 * 인라인 일괄 입력 모드에서 여러 학생의 출신 중학교 및 성적 변경사항을 한 번에 저장
 */
export async function batchUpdateMultipleStudentsInlineAction(
  updates: Array<{
    id: string;
    middle_school?: string | null;
    admission_rank_percentile?: number | null;
    admission_type?: string | null;
  }>
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role === 'student') {
    return { success: false, error: '권한이 없습니다.' };
  }

  if (!updates || updates.length === 0) {
    return { success: true, count: 0 };
  }

  const supabase = createAdminClient();

  let successCount = 0;
  for (const item of updates) {
    const updateData: Record<string, any> = {};
    if (item.middle_school !== undefined) updateData.middle_school = item.middle_school?.trim() || null;
    if (item.admission_rank_percentile !== undefined) updateData.admission_rank_percentile = item.admission_rank_percentile;
    if (item.admission_type !== undefined) updateData.admission_type = item.admission_type?.trim() || null;

    const { error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', item.id);

    if (!error) successCount++;
  }

  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  revalidatePath('/employment-status');
  return { success: true, count: successCount };
}

/**
 * 등록된 출신 중학교 고유 목록(Distinct List) 조회
 */
export async function getRegisteredMiddleSchoolsAction(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('students')
    .select('middle_school')
    .not('middle_school', 'is', null);

  if (error || !data) return [];
  const schools = Array.from(
    new Set(
      data
        .map(d => (d.middle_school || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ko'));

  return schools;
}

/**
 * 다수 학생의 출신 중학교 일괄 변경 (빠른 할당)
 */
export async function bulkAssignMiddleSchoolAction(
  studentIds: string[],
  middleSchool: string
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role === 'student') {
    return { success: false, error: '권한이 없습니다.' };
  }

  if (!studentIds || studentIds.length === 0) {
    return { success: false, error: '선택된 학생이 없습니다.' };
  }

  const supabase = createAdminClient();
  const cleanSchool = middleSchool.trim();

  const { error, count } = await supabase
    .from('students')
    .update({ middle_school: cleanSchool || null })
    .in('id', studentIds);

  if (error) {
    console.error('Failed bulkAssignMiddleSchoolAction:', error);
    return { success: false, error: error.message };
  }

  revalidateTag('students');
  revalidateTag('middle-school-employment');
  revalidatePath('/admission/middle-school-employment');
  revalidatePath('/share/admission/middle-school-employment');
  revalidatePath('/employment-status');
  return { success: true, count: count || studentIds.length };
}

