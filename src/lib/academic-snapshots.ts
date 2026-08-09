'use server';

import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getFilteredStudentData, getCurrentUserProfile } from '@/lib/data';
import { logAuditAction } from './audit-logger';

export interface AcademicSnapshotItem {
  id: string;
  base_year: number;
  snapshot_name: string;
  student_count: number;
  snapshot_data: any[];
  created_by: string;
  created_at: string;
}

const SNAPSHOT_SETTINGS_KEY = 'academic_snapshots_store';

async function getFullStudentSnapshotDataForGrade(graduationYear: string, baseYear: number) {
  const supabase = createAdminClient();
  const gradYearInt = parseInt(graduationYear);

  // 1. 해당 졸업년도의 모든 학생 기본 정보 select('*') 전수 조회
  const { data: students, error: studentsErr } = await supabase
    .from('students')
    .select('*')
    .eq('graduation_year', gradYearInt)
    .order('major')
    .order('class_info')
    .order('student_number')
    .range(0, 5000);

  if (studentsErr || !students || students.length === 0) {
    return [];
  }

  const studentIds = students.map(s => s.id).filter(Boolean);

  // 2. 관련된 6개 테이블 전수 병렬 쿼리 백업
  const [empRes, scoresRes, attRes, trainingRes, historyRes, counselRes] = await Promise.all([
    studentIds.length > 0
      ? supabase.from('student_employments').select('*').in('id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    studentIds.length > 0
      ? supabase.from('student_scores').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    studentIds.length > 0
      ? supabase.from('student_attendance').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    studentIds.length > 0
      ? supabase.from('field_training_records').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    studentIds.length > 0
      ? supabase.from('student_academic_history').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    studentIds.length > 0
      ? supabase.from('student_counseling_logs').select('*').in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const employments = empRes.data || [];
  const scores = scoresRes.data || [];
  const attendance = attRes.data || [];
  const trainings = trainingRes.data || [];
  const histories = historyRes.data || [];
  const counselings = counselRes.data || [];

  // 3. 학생별 객체로 전수 결합 (100% 원형 보존)
  return students.map(s => {
    const studentEmp = employments.find(e => e.id === s.id) || null;
    const studentScores = scores.filter(sc => sc.student_id === s.id);
    const studentAtt = attendance.filter(at => at.student_id === s.id);
    const studentTrainings = trainings.filter(tr => tr.student_id === s.id);
    const studentHistories = histories.filter(hi => hi.student_id === s.id);
    const studentCounselings = counselings.filter(co => co.student_id === s.id);

    const empObj = studentEmp || {
      id: s.id,
      is_desiring_employment: s.is_desiring_employment,
      employment_status: s.employment_status,
      company_type: s.company_type,
      business_type: s.business_type,
      company: s.company,
      remarks: s.remarks
    };

    return {
      ...s,
      // 백업 관계 데이터 명시적 100% 바인딩
      student_employments_backup: empObj,
      student_scores_backup: studentScores,
      student_attendance_backup: studentAtt,
      field_training_backup: studentTrainings,
      academic_history_backup: studentHistories,
      counseling_logs_backup: studentCounselings,
      // 리스트 표시 및 하위 호환 필드 강제 채움
      is_desiring_employment: s.is_desiring_employment ?? empObj.is_desiring_employment,
      employment_status: s.employment_status || empObj.employment_status || '',
      company_type: s.company_type || empObj.company_type || '',
      business_type: s.business_type || empObj.business_type || '',
      company: s.company || empObj.company || '',
      remarks: s.remarks || empObj.remarks || ''
    };
  });
}

/**
 * 학사학년도 최종 학적 스냅샷 백업 생성
 */
export async function createAcademicHistorySnapshot(params: {
  baseYear: number;
  snapshotName?: string;
  createdBy?: string;
}) {
  try {
    const supabase = createAdminClient();

    // 생성자 정보 결정
    let creator = params.createdBy;
    if (!creator) {
      const userProfile = await getCurrentUserProfile();
      creator = userProfile ? userProfile.full_name : '시스템';
    }

    const defaultName = `${params.baseYear}학년도 학적 및 취업이력 최종 마감 백업`;
    const snapshotName = params.snapshotName || defaultName;

    // 해당 학사학년도 기준 1, 2, 3학년 전교생 (인적사항, 성적, 출결, 취업, 실습, 학적, 상담) 전수 데이터 통합 백업
    const gradYear3 = (params.baseYear + 1).toString(); // 3학년 (예: 2027)
    const gradYear2 = (params.baseYear + 2).toString(); // 2학년 (예: 2028)
    const gradYear1 = (params.baseYear + 3).toString(); // 1학년 (예: 2029)

    const [dataGrade3, dataGrade2, dataGrade1] = await Promise.all([
      getFullStudentSnapshotDataForGrade(gradYear3, params.baseYear),
      getFullStudentSnapshotDataForGrade(gradYear2, params.baseYear),
      getFullStudentSnapshotDataForGrade(gradYear1, params.baseYear),
    ]);

    const studentsData = [...dataGrade3, ...dataGrade2, ...dataGrade1];

    const snapshotId = `snap_${Date.now()}_${params.baseYear}`;
    const newSnapshot: AcademicSnapshotItem = {
      id: snapshotId,
      base_year: params.baseYear,
      snapshot_name: snapshotName,
      student_count: studentsData.length,
      snapshot_data: studentsData,
      created_by: creator || '관리자',
      created_at: new Date().toISOString()
    };

    // 1. 전용 테이블 시도
    const { error: tableErr } = await supabase
      .from('academic_history_snapshots')
      .insert({
        id: snapshotId,
        base_year: params.baseYear,
        snapshot_name: snapshotName,
        student_count: studentsData.length,
        snapshot_data: studentsData,
        created_by: creator || '관리자',
        created_at: newSnapshot.created_at
      });

    // 2. 만약 전용 테이블이 없으면 system_settings에 백업 저장
    if (tableErr) {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SNAPSHOT_SETTINGS_KEY)
        .single();

      let currentSnaps: AcademicSnapshotItem[] = existing?.value ? (existing.value as any).snapshots || [] : [];
      currentSnaps = [newSnapshot, ...currentSnaps];

      await supabase.from('system_settings').upsert({
        key: SNAPSHOT_SETTINGS_KEY,
        value: { snapshots: currentSnaps },
        updated_at: new Date().toISOString()
      });
    }

    // Audit Log 기록
    await logAuditAction({
      actor_name: creator,
      action_type: 'BASE_YEAR_SNAPSHOT',
      target_name: `${params.baseYear}학년도 학적 스냅샷`,
      details: { snapshot_name: snapshotName, student_count: studentsData.length }
    });

    revalidateTag('snapshots');
    revalidatePath('/admin/settings');
    return { success: true, count: studentsData.length, snapshotName };
  } catch (error: any) {
    console.error('Error creating academic history snapshot:', error);
    return { error: error.message || '스냅샷 백업 실패' };
  }
}

/**
 * [캐싱] 학 학적 백업 스냅샷 목록 서버 메모리 캐싱 조회
 */
export async function getCachedAcademicSnapshots(): Promise<AcademicSnapshotItem[]> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // 1. 테이블에서 시도
      const { data: tableSnaps, error: tableErr } = await supabase
        .from('academic_history_snapshots')
        .select('id, base_year, snapshot_name, student_count, created_by, created_at')
        .order('created_at', { ascending: false });

      if (!tableErr && tableSnaps) {
        return tableSnaps.map(s => ({
          ...s,
          snapshot_data: [] // 목록 조회 시 무게를 줄이기 위해 data 배열은 비움
        }));
      }

      // 폴백: system_settings 조회
      const { data: fallbackData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SNAPSHOT_SETTINGS_KEY)
        .single();

      const snapshots: AcademicSnapshotItem[] = fallbackData?.value ? (fallbackData.value as any).snapshots || [] : [];
      return snapshots.map(s => ({
        ...s,
        snapshot_data: []
      }));
    },
    ['academic-snapshots-list'],
    {
      revalidate: 3600,
      tags: ['snapshots']
    }
  )();
}

/**
 * 특정 스냅샷의 전체 학생 데이터 상세 조회 (엑셀 출력 및 상세 보기용)
 */
export async function getSnapshotDetails(snapshotId: string): Promise<AcademicSnapshotItem | null> {
  const supabase = createAdminClient();

  // 1. 테이블에서 시도
  const { data: tableSnap, error: tableErr } = await supabase
    .from('academic_history_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (!tableErr && tableSnap) {
    return tableSnap;
  }

  // 폴백: system_settings에서 시도
  const { data: fallbackData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', SNAPSHOT_SETTINGS_KEY)
    .single();

  const snapshots: AcademicSnapshotItem[] = fallbackData?.value ? (fallbackData.value as any).snapshots || [] : [];
  const target = snapshots.find(s => s.id === snapshotId);
  return target || null;
}

/**
 * 학적 백업 스냅샷 항목 삭제
 */
export async function deleteAcademicSnapshot(snapshotId: string) {
  try {
    const supabase = createAdminClient();
    const userProfile = await getCurrentUserProfile();
    const creator = userProfile ? userProfile.full_name : '관리자';

    // 1. 테이블 삭제 시도
    await supabase
      .from('academic_history_snapshots')
      .delete()
      .eq('id', snapshotId);

    // 2. system_settings 폴백 삭제 시도
    const { data: existing } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', SNAPSHOT_SETTINGS_KEY)
      .single();

    if (existing?.value) {
      let currentSnaps: AcademicSnapshotItem[] = (existing.value as any).snapshots || [];
      currentSnaps = currentSnaps.filter(s => s.id !== snapshotId);
      await supabase.from('system_settings').upsert({
        key: SNAPSHOT_SETTINGS_KEY,
        value: { snapshots: currentSnaps },
        updated_at: new Date().toISOString()
      });
    }

    await logAuditAction({
      actor_name: creator,
      action_type: 'BASE_YEAR_SNAPSHOT_DELETE',
      target_name: `스냅샷 삭제 (${snapshotId})`,
      details: { snapshotId }
    });

    revalidateTag('snapshots');
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting academic snapshot:', error);
    return { error: error.message || '스냅샷 삭제 실패' };
  }
}

/**
 * 학적 백업 스냅샷 데이터 원복 (Restore)
 */
export async function restoreAcademicSnapshot(snapshotId: string) {
  try {
    const detail = await getSnapshotDetails(snapshotId);
    if (!detail || !detail.snapshot_data || detail.snapshot_data.length === 0) {
      return { error: '스냅샷 백업 데이터를 찾을 수 없거나 데이터가 비어 있습니다.' };
    }

    const supabase = createAdminClient();
    const userProfile = await getCurrentUserProfile();
    const creator = userProfile ? userProfile.full_name : '관리자';

    const students = detail.snapshot_data;
    let restoredCount = 0;

    // 1. 학생 기본 정보, 자격증, 취업 상태 복원
    for (const item of students) {
      // 1-1. students 테이블 전수 100% 컬럼 복원
      const { 
        id: studentId, 
        student_employments_backup, 
        student_scores_backup, 
        student_attendance_backup, 
        field_training_backup, 
        academic_history_backup, 
        counseling_logs_backup, 
        is_desiring_employment,
        employment_status,
        company_type,
        business_type,
        company,
        remarks,
        ...studentCore 
      } = item;

      if (!studentId) continue;

      if (Object.keys(studentCore).length > 0) {
        await supabase
          .from('students')
          .upsert({ id: studentId, ...studentCore }, { onConflict: 'id' });
      }

      // 1-2. student_employments 취업 데이터 100% 원형 복원
      if (student_employments_backup || item.employment_status || item.company) {
        const empPayload = {
          id: studentId,
          is_desiring_employment: student_employments_backup?.is_desiring_employment ?? item.is_desiring_employment ?? '예',
          employment_status: student_employments_backup?.employment_status || item.employment_status || '',
          company_type: student_employments_backup?.company_type || item.company_type || '',
          business_type: student_employments_backup?.business_type || item.business_type || '',
          company: student_employments_backup?.company || item.company || '',
          remarks: student_employments_backup?.remarks || item.remarks || ''
        };
        await supabase
          .from('student_employments')
          .upsert(empPayload, { onConflict: 'id' });
      }

      // 1-3. student_scores (교과 성적) 복원
      if (Array.isArray(student_scores_backup) && student_scores_backup.length > 0) {
        await supabase.from('student_scores').delete().eq('student_id', studentId);
        const scoresToInsert = student_scores_backup.map(({ id, created_at, ...rest }: any) => rest);
        if (scoresToInsert.length > 0) {
          await supabase.from('student_scores').insert(scoresToInsert);
        }
      }

      // 1-4. student_attendance (출결 현황) 복원
      if (Array.isArray(student_attendance_backup) && student_attendance_backup.length > 0) {
        await supabase.from('student_attendance').delete().eq('student_id', studentId);
        const attToInsert = student_attendance_backup.map(({ id, created_at, updated_at, ...rest }: any) => rest);
        if (attToInsert.length > 0) {
          await supabase.from('student_attendance').insert(attToInsert);
        }
      }

      // 1-5. field_training_records (현장 실습 이력) 복원
      if (Array.isArray(field_training_backup) && field_training_backup.length > 0) {
        await supabase.from('field_training_records').delete().eq('student_id', studentId);
        const trainingToInsert = field_training_backup.map(({ id, created_at, ...rest }: any) => rest);
        if (trainingToInsert.length > 0) {
          await supabase.from('field_training_records').insert(trainingToInsert);
        }
      }

      // 1-6. student_academic_history (학적 이력 - class-management) 복원
      if (Array.isArray(academic_history_backup) && academic_history_backup.length > 0) {
        await supabase.from('student_academic_history').delete().eq('student_id', studentId);
        const historyToInsert = academic_history_backup.map(({ id, created_at, ...rest }: any) => rest);
        if (historyToInsert.length > 0) {
          await supabase.from('student_academic_history').insert(historyToInsert);
        }
      }

      // 1-7. student_counseling_logs (상담 일지 - class-management) 복원
      if (Array.isArray(counseling_logs_backup) && counseling_logs_backup.length > 0) {
        await supabase.from('student_counseling_logs').delete().eq('student_id', studentId);
        const counselToInsert = counseling_logs_backup.map(({ id, created_at, ...rest }: any) => rest);
        if (counselToInsert.length > 0) {
          await supabase.from('student_counseling_logs').insert(counselToInsert);
        }
      }

      restoredCount++;
    }

    // 2. 복원된 스냅샷의 기준학년도로 system_settings 자동 동기화
    if (detail.base_year) {
      await supabase
        .from('system_settings')
        .upsert({ 
          key: 'base_year', 
          value: { year: detail.base_year },
          updated_at: new Date().toISOString()
        });
    }

    // 3. Audit Log 기록
    await logAuditAction({
      actor_name: creator,
      action_type: 'BASE_YEAR_SNAPSHOT_RESTORE',
      target_name: `${detail.base_year}학년도 스냅샷 복원 (${detail.snapshot_name})`,
      details: { snapshotId, restoredCount }
    });

    // 4. 전 시스템 태그 캐시 즉시 비우기 (students, class-management, labor-education 전 파트 동기화)
    revalidateTag('students');
    revalidateTag('student-data');
    revalidateTag('cert-grades');
    revalidateTag('cert-attendance');
    revalidateTag('cert-certificates');
    revalidateTag('academic-history');
    revalidateTag('counseling-logs');
    revalidateTag('labor-education');
    revalidateTag('settings');
    revalidateTag('snapshots');
    revalidatePath('/', 'layout');

    return { success: true, restoredCount, snapshotName: detail.snapshot_name };
  } catch (error: any) {
    console.error('Error restoring academic snapshot:', error);
    return { error: error.message || '스냅샷 복원 중 오류가 발생했습니다.' };
  }
}
