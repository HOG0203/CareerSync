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

    // 해당 학사학년도 기준 3학년 졸업연도 데이터 패칭
    const targetGradYear = (params.baseYear + 1).toString();
    const studentsData = await getFilteredStudentData(targetGradYear, params.baseYear);

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
