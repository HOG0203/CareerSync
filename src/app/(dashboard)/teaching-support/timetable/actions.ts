'use server';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/actions.ts
// 시간표 관리 및 조회 Server Actions
// ==============================================================================

import { revalidatePath } from 'next/cache';
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
    revalidatePath('/teaching-support/timetable');
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
 * 4. 특정 학년도/학기의 시간표 전체 데이터 조회
 */
export async function getTimetableData(
  academicYear?: number,
  semester?: number
): Promise<{ success: boolean; data?: ParsedTimetableResult; error?: string }> {
  try {
    const supabase = createAdminClient();
    const schedules = await getSchedulesList();

    let targetYear = academicYear;
    let targetSem = semester;

    if (!targetYear || !targetSem) {
      if (schedules.length > 0) {
        targetYear = schedules[0].academicYear;
        targetSem = schedules[0].semester;
      } else {
        targetYear = new Date().getFullYear();
        targetSem = 2;
      }
    }

    const storeKey = `timetable_store_${targetYear}_${targetSem}`;
    const { data: storeData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', storeKey)
      .maybeSingle();

    if (storeData && storeData.value) {
      const parsed = storeData.value as ParsedTimetableResult;
      // 최신 가중치 적용하여 시수 재계산
      const weights = await getWeightSettings();
      parsed.teachers.forEach(t => {
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

      return { success: true, data: parsed };
    }

    return { success: true, data: undefined };
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

    revalidatePath('/teaching-support/timetable');

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

    revalidatePath('/teaching-support/timetable');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting timetable:', err);
    return { success: false, error: err.message || '시간표 삭제 중 오류가 발생했습니다.' };
  }
}
