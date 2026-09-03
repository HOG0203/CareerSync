'use server';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/actions.ts
// 시간표 관리 및 조회 Server Actions
// ==============================================================================

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { 
  parseTimetableExcel, 
  ParsedTimetableResult 
} from '@/lib/timetable/parser';
import { 
  ActivityWeightConfig, 
  DEFAULT_ACTIVITY_WEIGHTS 
} from '@/lib/timetable/constants';

const TIMETABLE_SCHEDULES_KEY = 'timetable_schedules_list';
const TIMETABLE_WEIGHTS_KEY = 'timetable_activity_weights';

export interface ScheduleListItem {
  id: string;
  academicYear: number;
  semester: number;
  title: string;
  effectiveDate: string;
  totalTeachers: number;
  totalClasses: number;
  totalSlots: number;
  updatedAt: string;
}

/**
 * 1. 시수 가중치 설정 조회
 */
export async function getWeightSettings(): Promise<ActivityWeightConfig> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', TIMETABLE_WEIGHTS_KEY)
      .maybeSingle();

    if (data && data.value && typeof data.value === 'object') {
      return { ...DEFAULT_ACTIVITY_WEIGHTS, ...(data.value as ActivityWeightConfig) };
    }
  } catch (err) {
    console.error('Error fetching weight settings:', err);
  }
  return DEFAULT_ACTIVITY_WEIGHTS;
}

/**
 * 2. 시수 가중치 설정 저장
 */
export async function saveWeightSettings(weights: ActivityWeightConfig) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: TIMETABLE_WEIGHTS_KEY,
        value: weights,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) throw error;
    revalidateTag('timetable_cache');
    revalidatePath('/teaching-support/timetable');
    revalidatePath('/teaching-support/substitute');
    return { success: true };
  } catch (err: any) {
    console.error('Error saving weight settings:', err);
    return { success: false, error: err.message || '가중치 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 3. 등록된 시간표 목록(학년도/학기) 조회
 */
export async function getSchedulesList(): Promise<ScheduleListItem[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', TIMETABLE_SCHEDULES_KEY)
      .maybeSingle();

    if (data && Array.isArray(data.value)) {
      return data.value as ScheduleListItem[];
    }
  } catch (err) {
    console.error('Error fetching schedules list:', err);
  }
  return [];
}

/**
 * 시간표 마스터 데이터 (스케줄 목록, 가중치 설정, 시간표 본체) 통합 캐시 로더
 * - 단일 DB 배치 쿼리로 DB 왕복 지연시간 최소화
 * - Vercel Serverless Data Cache (unstable_cache) 적용으로 0ms 즉각 응답
 */
export const getCachedTimetablePageData = unstable_cache(
  async (targetYear?: number, targetSem?: number) => {
    try {
      const supabase = createAdminClient();

      // 1) 1차 배치 쿼리로 스케줄 목록과 가중치 동시 로드
      const { data: initialSettings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [TIMETABLE_SCHEDULES_KEY, TIMETABLE_WEIGHTS_KEY]);

      const settingsMap = new Map((initialSettings || []).map(i => [i.key, i.value]));

      const rawSchedules = settingsMap.get(TIMETABLE_SCHEDULES_KEY);
      const schedulesList: ScheduleListItem[] = Array.isArray(rawSchedules) ? rawSchedules : [];

      const rawWeights = settingsMap.get(TIMETABLE_WEIGHTS_KEY);
      const weights: ActivityWeightConfig = (rawWeights && typeof rawWeights === 'object')
        ? { ...DEFAULT_ACTIVITY_WEIGHTS, ...rawWeights }
        : DEFAULT_ACTIVITY_WEIGHTS;

      let y = targetYear;
      let s = targetSem;
      if (!y || !s) {
        if (schedulesList.length > 0) {
          y = schedulesList[0].academicYear;
          s = schedulesList[0].semester;
        } else {
          y = 2026;
          s = 2;
        }
      }

      // 2) 대상 학기 시간표 스토어 조회
      const storeKey = `timetable_store_${y}_${s}`;
      const { data: storeData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', storeKey)
        .maybeSingle();

      let parsedData: ParsedTimetableResult | undefined = undefined;
      if (storeData?.value) {
        parsedData = storeData.value as ParsedTimetableResult;
        parsedData.teachers.forEach(t => {
          let weighted = 0;
          Object.values(t.slots).forEach(slot => {
            const actName = slot.subjectName.trim();
            let w = 1.0;
            if (actName.includes('자율')) w = weights['자율'] ?? 1.5;
            else if (actName.includes('동아')) w = weights['동아'] ?? 0.5;
            else if (actName.includes('진로')) w = weights['진로'] ?? 1.0;
            else if (actName.includes('성직')) w = weights['성직'] ?? 1.0;
            slot.weight = w;
            weighted += w;
          });
          t.weightedHours = Math.round(weighted * 10) / 10;
        });
      }

      return {
        schedulesList,
        weights,
        timetableData: parsedData,
      };
    } catch (err) {
      console.error('getCachedTimetablePageData error:', err);
      return {
        schedulesList: [],
        weights: DEFAULT_ACTIVITY_WEIGHTS,
        timetableData: undefined,
      };
    }
  },
  ['timetable_full_page_cache'],
  {
    tags: ['timetable_cache'],
    revalidate: 86400, // 24시간 캐시 (데이터 갱신 시 revalidateTag로 즉시 갱신)
  }
);

/**
 * 4. 특정 학년도/학기의 시간표 전체 데이터 조회 (캐시 활용)
 */
export async function getTimetableData(
  academicYear?: number,
  semester?: number
): Promise<{ success: boolean; data?: ParsedTimetableResult; error?: string }> {
  try {
    const pageData = await getCachedTimetablePageData(academicYear, semester);
    return { success: true, data: pageData.timetableData };
  } catch (err: any) {
    console.error('Error getting timetable data:', err);
    return { success: false, error: err.message || '시간표 데이터 조회 중 오류가 발생했습니다.' };
  }
}

/**
 * 5. 시간표 엑셀 파일 업로드 및 데이터베이스 저장
 */
export async function uploadTimetableExcel(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: '업로드할 엑셀 파일을 선택해주세요.' };
    }

    const overrideYearStr = formData.get('academicYear') as string;
    const overrideSemStr = formData.get('semester') as string;
    const overrideYear = overrideYearStr ? parseInt(overrideYearStr) : undefined;
    const overrideSem = overrideSemStr ? parseInt(overrideSemStr) : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const weights = await getWeightSettings();
    const parsed = parseTimetableExcel(arrayBuffer, overrideYear, overrideSem, weights);

    const supabase = createAdminClient();
    const storeKey = `timetable_store_${parsed.academicYear}_${parsed.semester}`;

    // 1) 개별 학년도/학기 데이터 저장
    const { error: storeError } = await supabase
      .from('system_settings')
      .upsert({
        key: storeKey,
        value: parsed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (storeError) throw storeError;

    // 2) 시간표 마스터 목록 갱신
    const currentSchedules = await getSchedulesList();
    const newScheduleItem: ScheduleListItem = {
      id: `${parsed.academicYear}_${parsed.semester}`,
      academicYear: parsed.academicYear,
      semester: parsed.semester,
      title: parsed.title,
      effectiveDate: parsed.effectiveDate,
      totalTeachers: parsed.totalTeachers,
      totalClasses: parsed.totalClasses,
      totalSlots: parsed.totalSlots,
      updatedAt: new Date().toISOString()
    };

    const updatedSchedules = [
      newScheduleItem,
      ...currentSchedules.filter(s => !(s.academicYear === parsed.academicYear && s.semester === parsed.semester))
    ].sort((a, b) => {
      if (a.academicYear !== b.academicYear) return b.academicYear - a.academicYear;
      return b.semester - a.semester;
    });

    await supabase
      .from('system_settings')
      .upsert({
        key: TIMETABLE_SCHEDULES_KEY,
        value: updatedSchedules,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    revalidateTag('timetable_cache');
    revalidatePath('/teaching-support/timetable');
    revalidatePath('/teaching-support/substitute');

    return { 
      success: true, 
      data: parsed,
      message: `${parsed.academicYear}학년도 ${parsed.semester}학기 시간표(교사 ${parsed.totalTeachers}명, ${parsed.totalClasses}개 학반)가 성공적으로 등록되었습니다.` 
    };
  } catch (err: any) {
    console.error('Error uploading timetable:', err);
    return { success: false, error: err.message || '시간표 엑셀 업로드 중 오류가 발생했습니다.' };
  }
}

/**
 * 6. 시간표 데이터 삭제
 */
export async function deleteTimetable(academicYear: number, semester: number) {
  try {
    const supabase = createAdminClient();
    const storeKey = `timetable_store_${academicYear}_${semester}`;

    await supabase.from('system_settings').delete().eq('key', storeKey);

    const currentSchedules = await getSchedulesList();
    const updatedSchedules = currentSchedules.filter(
      s => !(s.academicYear === academicYear && s.semester === semester)
    );

    await supabase
      .from('system_settings')
      .upsert({
        key: TIMETABLE_SCHEDULES_KEY,
        value: updatedSchedules,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    revalidateTag('timetable_cache');
    revalidatePath('/teaching-support/timetable');
    revalidatePath('/teaching-support/substitute');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting timetable:', err);
    return { success: false, error: err.message || '시간표 삭제 중 오류가 발생했습니다.' };
  }
}
