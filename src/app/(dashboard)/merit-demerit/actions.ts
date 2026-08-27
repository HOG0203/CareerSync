'use server';

import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile, MAJOR_SORT_ORDER } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';

export interface MeritDemeritRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  major: string;
  class_info: string;
  grade: number;
  academic_year: number;
  rule_id: string;
  rule_name: string;
  type: 'merit' | 'demerit';
  points: number;
  date: string;
  memo?: string;
  granted_by: {
    userId: string;
    userName: string;
    role: string;
    at: string;
  };
  created_at: string;
}

export interface MeritDemeritRecordSummary {
  id: string;
  type: 'merit' | 'demerit';
  rule_name: string;
  points: number;
  date: string;
  memo?: string;
  granted_by_name: string;
}

export interface StudentMeritDemeritSummary {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  major: string;
  class_info: string;
  grade: number;
  academic_year: number;
  totalMeritPoints: number;
  totalDemeritPoints: number;
  netPoints: number;
  recentRecords: MeritDemeritRecordSummary[];
  recordsCount: number;
}

/**
 * 상벌점 레코드 전체 스토어 조회 (DB Key: merit_demerit_records_store)
 */
export async function getMeritDemeritRecordsStore(): Promise<Record<string, MeritDemeritRecord[]>> {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'merit_demerit_records_store')
      .maybeSingle();

    if (error) throw error;
    if (data?.value && typeof data.value === 'object') {
      return data.value as Record<string, MeritDemeritRecord[]>;
    }
    return {};
  } catch (error) {
    console.error('Error fetching merit_demerit_records_store:', error);
    return {};
  }
}

/**
 * [캐싱] 상벌점 레코드 전체 스토어 메모리 캐시 (0.001초 응답)
 */
export async function getCachedMeritDemeritRecordsStore(): Promise<Record<string, MeritDemeritRecord[]>> {
  return unstable_cache(
    async () => getMeritDemeritRecordsStore(),
    ['merit-demerit-records-store-cache'],
    {
      revalidate: 86400,
      tags: ['merit-demerit', 'merit-records-store']
    }
  )();
}

async function fetchMeritDemeritSummaryList(
  gradeNum: number, 
  baseYear: number,
  customStore?: Record<string, MeritDemeritRecord[]>
): Promise<StudentMeritDemeritSummary[]> {
  const supabase = createAdminClient();
  const targetGradYear = baseYear + (4 - gradeNum);

  const [studentsRes, store] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('graduation_year', targetGradYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true }),
    customStore ? Promise.resolve(customStore) : getCachedMeritDemeritRecordsStore()
  ]);

  const students = studentsRes.data || [];
  if (students.length === 0) return [];

  const summaries: StudentMeritDemeritSummary[] = students.map(s => {
    const studentRecords = store[s.id] || [];
    const sorted = [...studentRecords].sort((a, b) => 
      b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
    );

    let totalMeritPoints = 0;
    let totalDemeritPoints = 0;

    sorted.forEach(r => {
      if (r.type === 'merit') {
        totalMeritPoints += r.points;
      } else if (r.type === 'demerit') {
        totalDemeritPoints += r.points;
      }
    });

    const recentRecords: MeritDemeritRecordSummary[] = sorted.slice(0, 3).map(r => ({
      id: r.id,
      type: r.type,
      rule_name: r.rule_name,
      points: r.points,
      date: r.date,
      memo: r.memo,
      granted_by_name: r.granted_by?.userName || '교사'
    }));

    return {
      id: s.id,
      student_id: s.id,
      student_name: s.student_name,
      student_number: s.student_number || '',
      major: s.major || '',
      class_info: s.class_info || '',
      grade: gradeNum,
      academic_year: baseYear,
      totalMeritPoints,
      totalDemeritPoints,
      netPoints: totalMeritPoints - totalDemeritPoints,
      recentRecords,
      recordsCount: sorted.length
    };
  });

  // 자연스러운 번호 순서(1 > 2 > 3 ... > 10 > 11) 및 학과/반 정렬
  summaries.sort((a, b) => {
    // 1. 학과 정렬
    const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
    const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
    const majorDiff = (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    if (majorDiff !== 0) return majorDiff;

    // 2. 반 정렬 (숫자 우선: 1반, 2반 ... 10반)
    const classA = parseInt(a.class_info) || 0;
    const classB = parseInt(b.class_info) || 0;
    if (classA !== classB) return classA - classB;
    const classComp = a.class_info.localeCompare(b.class_info, 'ko', { numeric: true });
    if (classComp !== 0) return classComp;

    // 3. 번호 정렬 (숫자 우선: 1번, 2번, 3번 ... 10번, 11번)
    const numA = parseInt(a.student_number) || 0;
    const numB = parseInt(b.student_number) || 0;
    if (numA !== numB) return numA - numB;
    const numComp = a.student_number.localeCompare(b.student_number, 'ko', { numeric: true });
    if (numComp !== 0) return numComp;

    // 4. 이름 정렬
    return a.student_name.localeCompare(b.student_name, 'ko');
  });

  return summaries;
}

const summaryCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

/**
 * [캐싱] 학년별 학생 상벌점 요약 데이터 목록 초고속 패칭 (0.05초)
 */
export async function getCachedMeritDemeritSummaryList(
  gradeNum: number, 
  preloadedBaseYear?: number
): Promise<StudentMeritDemeritSummary[]> {
  const baseYear = preloadedBaseYear || (await getSystemSettings()).baseYear;
  const cacheKey = `g${gradeNum}-${baseYear}`;

  if (!summaryCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => fetchMeritDemeritSummaryList(gradeNum, baseYear),
      [`merit-demerit-summary-${cacheKey}`],
      {
        revalidate: 86400,
        tags: ['merit-demerit', `merit-demerit-g${gradeNum}`]
      }
    );
    summaryCacheMap.set(cacheKey, cachedFn);
  }

  return summaryCacheMap.get(cacheKey)!();
}

/**
 * [1-Shot 동시 패칭] 전 학년(1, 2, 3학년) 상벌점 데이터 1번에 동시 병렬 패칭
 */
export async function getAllGradesMeritDemeritSummary(
  baseYear: number
): Promise<Record<number, StudentMeritDemeritSummary[]>> {
  const [g1, g2, g3] = await Promise.all([
    getCachedMeritDemeritSummaryList(1, baseYear),
    getCachedMeritDemeritSummaryList(2, baseYear),
    getCachedMeritDemeritSummaryList(3, baseYear)
  ]);
  return { 1: g1, 2: g2, 3: g3 };
}

/**
 * [실시간 동기화] DB에서 직접 최신 상벌점 레코드를 읽어 1·2·3학년 전체 데이터 즉시 반환
 */
export async function refreshAllGradesMeritDemeritAction(
  baseYear: number
): Promise<Record<number, StudentMeritDemeritSummary[]>> {
  const store = await getMeritDemeritRecordsStore();
  const [g1, g2, g3] = await Promise.all([
    fetchMeritDemeritSummaryList(1, baseYear, store),
    fetchMeritDemeritSummaryList(2, baseYear, store),
    fetchMeritDemeritSummaryList(3, baseYear, store)
  ]);

  revalidateTag('merit-demerit');
  revalidateTag('merit-records-store');
  revalidatePath('/merit-demerit');

  return { 1: g1, 2: g2, 3: g3 };
}

export interface GrantMeritDemeritPayload {
  studentIds: string[];
  studentsMeta: Array<{
    id: string;
    student_name: string;
    student_number: string;
    major: string;
    class_info: string;
    grade: number;
  }>;
  ruleId: string;
  ruleName: string;
  type: 'merit' | 'demerit';
  points: number;
  date: string;
  memo?: string;
  grade: number;
  academicYear: number;
}

/**
 * 상벌점 부여 액션 (단일 및 다중 학생 일괄 처리)
 */
export async function grantMeritDemeritAction(payload: GrantMeritDemeritPayload) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { error: '로그인이 필요합니다.' };
  }

  const supabase = createAdminClient();

  try {
    const store = await getMeritDemeritRecordsStore();
    const nowIso = new Date().toISOString();
    const grantedByName = (profile as any).full_name || (profile as any).username || (profile.role === 'admin' ? '관리자' : '교사');

    payload.studentIds.forEach(sid => {
      const meta = payload.studentsMeta.find(m => m.id === sid);
      const newRecord: MeritDemeritRecord = {
        id: `mdr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        student_id: sid,
        student_name: meta?.student_name || '',
        student_number: meta?.student_number || '',
        major: meta?.major || '',
        class_info: meta?.class_info || '',
        grade: meta?.grade || payload.grade,
        academic_year: payload.academicYear,
        rule_id: payload.ruleId,
        rule_name: payload.ruleName,
        type: payload.type,
        points: payload.points,
        date: payload.date,
        memo: payload.memo?.trim() || '',
        granted_by: {
          userId: profile.id,
          userName: grantedByName,
          role: profile.role,
          at: nowIso
        },
        created_at: nowIso
      };

      if (!store[sid]) {
        store[sid] = [];
      }
      store[sid].push(newRecord);
    });

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'merit_demerit_records_store',
        value: store,
        updated_at: nowIso
      });

    if (error) throw error;

    revalidateTag('merit-demerit');
    revalidateTag('merit-records-store');
    revalidatePath('/merit-demerit');

    return { 
      success: true, 
      count: payload.studentIds.length,
      grantedType: payload.type,
      points: payload.points
    };
  } catch (error: any) {
    console.error('Error granting merit/demerit:', error);
    return { error: error.message || '상벌점 부여 중 오류가 발생했습니다.' };
  }
}

/**
 * 학생 상벌점 이력 1건 취소/삭제 액션
 */
export async function deleteMeritDemeritRecordAction(recordId: string, studentId: string, academicYear?: number) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { error: '로그인이 필요합니다.' };
  }

  const supabase = createAdminClient();

  try {
    const store = await getMeritDemeritRecordsStore();
    if (!store[studentId]) {
      return { error: '해당 학생의 상벌점 기록을 찾을 수 없습니다.' };
    }

    const initialLength = store[studentId].length;
    store[studentId] = store[studentId].filter(r => r.id !== recordId);

    if (store[studentId].length === initialLength) {
      return { error: '삭제할 기록이 존재하지 않습니다.' };
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'merit_demerit_records_store',
        value: store,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    revalidateTag('merit-demerit');
    revalidateTag('merit-records-store');
    revalidatePath('/merit-demerit');

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting merit/demerit record:', error);
    return { error: error.message || '기록 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * [지연 로딩] 개별 학생의 전체 상벌점 상세 이력 조회 (온디맨드 모달용)
 */
export async function getStudentMeritDemeritHistory(studentId: string): Promise<MeritDemeritRecord[]> {
  const store = await getMeritDemeritRecordsStore();
  const records = store[studentId] || [];
  return [...records].sort((a, b) => 
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  );
}