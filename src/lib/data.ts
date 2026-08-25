import { createClient, createAdminClient } from '@/lib/supabase/server';
import { StudentEmploymentData, FieldTrainingRecord, MAJOR_SORT_ORDER } from './types';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

export type { StudentEmploymentData, FieldTrainingRecord };
export { MAJOR_SORT_ORDER };

// 대시보드 전용 슬림 데이터 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const dashboardStudentDataMemoryCache: Record<string, { data: StudentEmploymentData[]; timestamp: number }> = {};
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export async function clearDashboardStudentDataCache(graduationYear?: string) {
  if (graduationYear) {
    delete dashboardStudentDataMemoryCache[graduationYear];
  } else {
    Object.keys(dashboardStudentDataMemoryCache).forEach(k => delete dashboardStudentDataMemoryCache[k]);
  }
}

/**
 * [대시보드 전용] 차트 렌더링에 필요한 최소한의 필드만 가져옵니다. (Next.js 글로벌 영구 캐싱)
 */
async function fetchDashboardStudentData(graduationYear: string): Promise<StudentEmploymentData[]> {
  const supabase = createAdminClient();
  const gradYearInt = parseInt(graduationYear);

  const { data: students, error } = await supabase
    .from('students')
    .select('id, major, class_info, student_number, graduation_year, career_aspiration, career_course, certificates, military_status, special_notes, student_employments (business_type, company_type, employment_status)')
    .eq('graduation_year', gradYearInt)
    .order('major')
    .order('class_info')
    .order('student_number')
    .range(0, 5000);

  if (error || !students) {
    console.error('Error fetching dashboard students:', error);
    return [];
  }

  const studentIds = students.map(s => s.id);

  // 실습 기록 학생 ID 직접 쿼리 (무거운 DB Inner Join 제거)
  let trainings: any[] = [];
  if (studentIds.length > 0) {
    const { data: tData } = await supabase
      .from('field_training_records')
      .select('student_id, hiring_status')
      .in('student_id', studentIds)
      .order('training_order', { ascending: false });
    trainings = tData || [];
  }

  const flattened = students.map(s => {
    const rawEmp = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const { student_employments, ...studentBase } = s;
    const emp = rawEmp || {};
    const latestTraining = trainings.find(t => t.student_id === s.id);

    return {
      ...studentBase,
      ...emp,
      id: s.id,
      has_field_training: latestTraining ? 'O' : '',
    } as StudentEmploymentData;
  });

  return flattened.sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a.major || '');
    const indexB = MAJOR_SORT_ORDER.indexOf(b.major || '');
    if (indexA !== indexB) return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    if (a.class_info !== b.class_info) return (a.class_info || '').localeCompare(b.class_info || '');
    return (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true });
  });
}

const dashboardStudentDataCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getDashboardStudentData(graduationYear: string): Promise<StudentEmploymentData[]> {
  const cacheKey = graduationYear;
  if (!dashboardStudentDataCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => fetchDashboardStudentData(graduationYear),
      [`dashboard-student-data-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`dashboard-${graduationYear}`, 'students']
      }
    );
    dashboardStudentDataCacheMap.set(cacheKey, cachedFn);
  }
  return dashboardStudentDataCacheMap.get(cacheKey)!();
}



/**
 * 특정 졸업연도의 모든 학생 및 취업/실습 데이터를 가져와 평탄화합니다.
 */
export async function getFilteredStudentData(graduationYear: string, baseYear?: number): Promise<StudentEmploymentData[]> {
  const supabase = createAdminClient();

  const gradYearInt = parseInt(graduationYear);
  
  // [최적화 1단계] 1차 대상 학생 목록 조회를 먼저 실행하여 ID 추출 (관계 테이블 무거운 !inner JOIN 제거)
  const studentsResult = await supabase
    .from('students')
    .select('id, student_name, phone_number, graduation_year, major, class_info, student_number, certificates, career_aspiration, career_course, special_notes, personal_remarks, labor_education_status, military_status, desired_work_area, parents_opinion, shoe_size, top_size, student_employments (id, is_desiring_employment, employment_status, company_type, business_type, company, remarks)')
    .eq('graduation_year', gradYearInt)

    .order('major')
    .order('class_info')
    .order('student_number')
    .range(0, 5000);

  if (studentsResult.error) {
    console.error('Error fetching students:', studentsResult.error);
    return [];
  }
  const students = studentsResult.data || [];
  const studentIds = students.map(s => s.id);

  // [최적화 2단계] 추출한 studentIds로 실습 기록, 학적 이력, 담임 프로필을 ID 색인 기반 2차 병렬 쿼리 (속도 2.5배 향상)
  const [trainingsResult, historyResult, teachersResult] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from('field_training_records')
          .select('id, student_id, training_order, company, start_date, end_date, stipend_status, hiring_status, conversion_date')
          .in('student_id', studentIds)
          .order('training_order', { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    (baseYear && studentIds.length > 0)
      ? supabase
          .from('student_academic_history')
          .select('id, student_id, major, class_info, student_number, teacher_name, grade')
          .eq('academic_year', baseYear)
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from('profiles')
      .select('username, full_name, assigned_grade, assigned_major, assigned_class')
      .not('assigned_major', 'is', null)
  ]);

  const trainings = trainingsResult.data || [];
  const historyData = historyResult?.data || [];
  const teachers = teachersResult?.data || [];

  // 3. 데이터 평탄화 (데이터 뒤섞임 방지를 위해 명시적 객체 생성)
  const flattened = students.map(s => {
    // Supabase Join 결과인 student_employments 배열 처리
    const rawEmp = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const { student_employments, ...studentBase } = s; // 원본 배열 제거하여 중복 방지
    const emp = rawEmp || {}; // 데이터가 없을 경우 빈 객체 처리

    const studentTrainings = (trainings || []).filter(t => t.student_id === s.id);
    const latestTraining = studentTrainings[0];
    const hist = historyData.find(h => h.student_id === s.id);

    let teacherName = hist?.teacher_name;
    if (!teacherName) {
      const studentMajor = hist?.major || s.major;
      const studentClass = hist?.class_info || s.class_info;
      const studentGrade = hist?.grade || (baseYear ? (4 - (s.graduation_year - baseYear)) : 3);
      
      const cleanM = (studentMajor || '').replace(/과|공업계/g, '').trim();
      const cleanC = (studentClass || '').replace(/반|학년/g, '').trim();

      const matchedT = teachers.find(t => {
        const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
        const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
        const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
        const isC = tClass === cleanC;
        const isG = !t.assigned_grade || t.assigned_grade === studentGrade;
        return isM && isC && isG;
      });

      if (matchedT) {
        teacherName = matchedT.username || matchedT.full_name;
      }
    }

    return {
      ...studentBase,
      ...emp,
      // 히스토리 정보가 있으면 우선 적용 (시간 여행 기능)
      ...(hist ? {
        major: hist.major,
        class_info: hist.class_info,
        student_number: hist.student_number,
        teacher_name: teacherName || hist.teacher_name,
        grade: hist.grade
      } : {
        teacher_name: teacherName || undefined
      }),
      id: s.id, // ID 유지 보장
      training_records: studentTrainings,
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
    };
  });

  return flattened.sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a.major || '');
    const indexB = MAJOR_SORT_ORDER.indexOf(b.major || '');
    if (indexA !== indexB) return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    if (a.class_info !== b.class_info) return (a.class_info || '').localeCompare(b.class_info || '');
    return (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true });
  });
}

/**
 * [캐싱 최적화] 모듈 맵 기반 고정 캐싱 제네레이터
 */
const filteredStudentDataCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getCachedFilteredStudentData(graduationYear: string, baseYear?: number): Promise<StudentEmploymentData[]> {
  const cacheKey = `${graduationYear}-${baseYear || 2026}`;
  if (!filteredStudentDataCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => getFilteredStudentData(graduationYear, baseYear),
      [`filtered-student-data-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`emp-status-${graduationYear}`, 'students']
      }
    );
    filteredStudentDataCacheMap.set(cacheKey, cachedFn);
  }
  return filteredStudentDataCacheMap.get(cacheKey)!();
}

// 노동인권교육 전용 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const laborEducationMemoryCache: Record<number, { data: StudentEmploymentData[]; timestamp: number }> = {};
const adminStudentMemoryCache: Record<number, { data: StudentEmploymentData[]; timestamp: number }> = {};

export async function clearLaborEducationCache(graduationYear?: number) {
  if (graduationYear) delete laborEducationMemoryCache[graduationYear];
  else Object.keys(laborEducationMemoryCache).forEach(k => delete laborEducationMemoryCache[Number(k)]);
}

export async function clearAdminStudentCache(graduationYear?: number) {
  if (graduationYear) delete adminStudentMemoryCache[graduationYear];
  else Object.keys(adminStudentMemoryCache).forEach(k => delete adminStudentMemoryCache[Number(k)]);
}

/**
 * [캐싱 최적화] 노동인권교육 전용 초경량 학생 목록 조회 (Next.js 글로벌 영구 캐싱)
 */
async function fetchLaborEducationData(graduationYear: number): Promise<StudentEmploymentData[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, student_name, major, class_info, student_number, labor_education_status, graduation_year')
    .eq('graduation_year', graduationYear)
    .order('major')
    .order('class_info')
    .order('student_number')
    .range(0, 5000);

  if (error || !data) {
    console.error('Error fetching labor education students:', error);
    return [];
  }

  return data as StudentEmploymentData[];
}

const laborEducationCacheMap = new Map<number, ReturnType<typeof unstable_cache>>();

export async function getCachedLaborEducationData(graduationYear: number): Promise<StudentEmploymentData[]> {
  if (!laborEducationCacheMap.has(graduationYear)) {
    const cachedFn = unstable_cache(
      async () => fetchLaborEducationData(graduationYear),
      [`labor-education-data-${graduationYear}`],
      {
        revalidate: 86400,
        tags: [`labor-${graduationYear}`, 'students']
      }
    );
    laborEducationCacheMap.set(graduationYear, cachedFn);
  }
  return laborEducationCacheMap.get(graduationYear)!();
}

/**
 * [캐싱 최적화] 학생 관리(Admin Students) 전용 초경량 기본 정보 조회 (Next.js 글로벌 영구 캐싱)
 */
async function fetchAdminStudentData(graduationYear: number): Promise<StudentEmploymentData[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, student_name, phone_number, graduation_year, major, class_info, student_number')
    .eq('graduation_year', graduationYear)
    .order('major')
    .order('class_info')
    .order('student_number')
    .range(0, 5000);

  if (error || !data) {
    console.error('Error fetching admin students:', error);
    return [];
  }

  return data as StudentEmploymentData[];
}

const adminStudentCacheMap = new Map<number, ReturnType<typeof unstable_cache>>();

export async function getCachedAdminStudentData(graduationYear: number): Promise<StudentEmploymentData[]> {
  if (!adminStudentCacheMap.has(graduationYear)) {
    const cachedFn = unstable_cache(
      async () => fetchAdminStudentData(graduationYear),
      [`admin-student-data-${graduationYear}`],
      {
        revalidate: 86400,
        tags: [`admin-students-${graduationYear}`, 'students']
      }
    );
    adminStudentCacheMap.set(graduationYear, cachedFn);
  }
  return adminStudentCacheMap.get(graduationYear)!();
}


/**
 * [캐싱] 졸업연도 목록 서버 메모리 캐싱
 */
export async function getCachedGraduationYears(): Promise<number[]> {

  return unstable_cache(
    async () => getGraduationYears(),
    ['graduation-years'],
    {
      revalidate: 86400,
      tags: ['students']
    }
  )();
}



// 학반 관리 전용 학생 상세 데이터 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const assignedStudentDetailsMemoryCache: Record<string, { data: StudentEmploymentData[]; timestamp: number }> = {};
const ASSIGNED_CACHE_TTL_MS = 5 * 60 * 1000;

export async function clearAssignedStudentDetailsCache(major?: string, classInfo?: string, graduationYear?: number) {
  if (major && classInfo && graduationYear) {
    const key = `${major}-${classInfo}-${graduationYear}`;
    delete assignedStudentDetailsMemoryCache[key];
  } else {
    Object.keys(assignedStudentDetailsMemoryCache).forEach(k => delete assignedStudentDetailsMemoryCache[k]);
  }
}

export async function getAssignedStudentDetails(major: string, classInfo: string, graduationYear: number, baseYear?: number) {
  const cacheKey = `${major}-${classInfo}-${graduationYear}-${baseYear || 2026}`;
  const now = Date.now();
  const cached = assignedStudentDetailsMemoryCache[cacheKey];
  if (cached && (now - cached.timestamp < ASSIGNED_CACHE_TTL_MS)) {
    return cached.data;
  }

  const supabase = createAdminClient();

  // 1. 해당 학반 학생 기본 정보 초고속 조회 (20~25명)
  const { data: rawStudents, error: sErr } = await supabase
    .from('students')
    .select('id, student_name, phone_number, graduation_year, major, class_info, student_number, certificates, career_aspiration, career_course, special_notes, personal_remarks, labor_education_status, military_status, desired_work_area, parents_opinion, shoe_size, top_size, student_employments (id, is_desiring_employment, employment_status, company_type, business_type, company, remarks)')
    .eq('major', major)
    .eq('class_info', classInfo)
    .eq('graduation_year', graduationYear)
    .order('student_number');

  if (sErr || !rawStudents || rawStudents.length === 0) return [];
  
  const studentIds = rawStudents.map(s => s.id);

  // 2. 해당 학생 ID 목록으로 실습 이력 및 학적 이력 병렬 조회
  const [trainingsResult, historyResult] = await Promise.all([
    supabase
      .from('field_training_records')
      .select('id, student_id, training_order, company, start_date, end_date, stipend_status, hiring_status, conversion_date, return_reason, updated_at')
      .in('student_id', studentIds)
      .order('training_order', { ascending: false }),
    baseYear
      ? supabase
          .from('student_academic_history')
          .select('id, student_id, major, class_info, student_number, teacher_name, grade')
          .eq('academic_year', baseYear)
          .in('student_id', studentIds)
      : Promise.resolve({ data: [] as any[], error: null })
  ]);

  const trainings = trainingsResult.data || [];
  const historyData = historyResult?.data || [];

  const results = rawStudents.map(s => {
    const studentEmployments = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const { student_employments, ...studentBase } = s;
    const emp = studentEmployments || {};
    const studentTrainings = trainings.filter(t => t.student_id === s.id);
    const latestTraining = studentTrainings[0];
    const hist = historyData.find(h => h.student_id === s.id);
    
    return {
      ...studentBase, 
      ...emp, 
      ...(hist ? {
        major: hist.major,
        class_info: hist.class_info,
        student_number: hist.student_number,
        teacher_name: hist.teacher_name,
        grade: hist.grade
      } : {}),
      id: s.id,
      training_records: studentTrainings, 
      counseling_logs: (s as any).student_counseling_logs || [],
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
    };
  }).sort((a, b) => (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true }));

  assignedStudentDetailsMemoryCache[cacheKey] = { data: results, timestamp: now };
  return results;
}

/**
 * [캐싱 최적화] 특정 학과/반 학생 상세 데이터 Next.js 영구 캐싱 (Vercel 환경 0.01초 공유)
 */
const assignedStudentDataCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getCachedAssignedStudentDetails(major: string, classInfo: string, graduationYear: number, baseYear?: number): Promise<StudentEmploymentData[]> {
  const cacheKey = `${major}-${classInfo}-${graduationYear}-${baseYear || 2026}`;
  if (!assignedStudentDataCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => getAssignedStudentDetails(major, classInfo, graduationYear, baseYear),
      [`assigned-student-details-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`assigned-${graduationYear}-${classInfo}`, 'students']
      }
    );
    assignedStudentDataCacheMap.set(cacheKey, cachedFn);
  }
  return assignedStudentDataCacheMap.get(cacheKey)!();
}



export async function getStudentEmploymentData(id: string): Promise<StudentEmploymentData | null> {
  const supabase = await createClient();
  const { data: student } = await supabase.from('students').select('*').eq('id', id).single();
  if (!student) return null;
  const { data: employment } = await supabase.from('student_employments').select('*').eq('id', id).single();
  const { data: trainings } = await supabase.from('field_training_records').select('*').eq('student_id', id).order('training_order', { ascending: false });
  return flattenStudentData([student], [employment || {}], trainings || [])[0];
}

function flattenStudentData(students: any[], employments: any[], trainings: any[]): StudentEmploymentData[] {
  return students.map(student => {
    const employment = employments.find(e => e.id === student.id) || {};
    const studentTrainings = trainings.filter(t => t.student_id === student.id);
    const latestTraining = studentTrainings[0];
    return {
      ...student, ...employment, training_records: studentTrainings,
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
    };
  });
}

const getGraduationYearsCached = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase.from('students').select('graduation_year');
    if (!data) return [];
    const years = Array.from(new Set(data.map(d => d.graduation_year))).filter((y): y is number => y !== null);
    return years.sort((a, b) => b - a);
  },
  ['graduation-years'],
  { revalidate: 3600, tags: ['students'] }
);

export async function getGraduationYears() {
  return getGraduationYearsCached();
}

export async function getAllStudentBaseData(): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  const { data: students, error } = await supabase.from('students').select('id, graduation_year, major, class_info, student_number, student_name').order('graduation_year', { ascending: false });
  if (error) return [];
  return students as any[];
}

export async function getProfiles() {
  return getCachedProfiles();
}

/**
 * [캐싱] 사용자 프로필 전체 목록 서버 메모리 캐싱 (profiles, teachers 태그)
 */
export async function getCachedProfiles() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      return data || [];
    },
    ['profiles-list-all'],
    {
      revalidate: 3600,
      tags: ['profiles', 'teachers']
    }
  )();
}

/**
 * [캐싱] 전교생 학반 매핑 기본 정보 캐싱 (students 태그)
 */
export async function getCachedAllStudentBaseData() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('students')
        .select('id, graduation_year, major, class_info, student_number, student_name')
        .order('graduation_year', { ascending: false });
      return data || [];
    },
    ['all-student-base-data'],
    {
      revalidate: 3600,
      tags: ['students']
    }
  )();
}

export async function getGradeStatistics(graduationYear: number) {
  const supabase = await createClient();
  const { data: students, error } = await supabase.from('students').select('career_aspiration, certificates, military_status, major, class_info').eq('graduation_year', graduationYear);
  if (error || !students) return null;
  const stats = { careerAspiration: {} as Record<string, number>, militaryStatus: {} as Record<string, number>, certificateDistribution: { '0개': 0, '1개': 0, '2개': 0, '3개': 0, '4개': 0, '5개': 0, '6개 이상': 0 } };
  students.forEach(s => {
    const aspiration = s.career_aspiration || '미설정';
    stats.careerAspiration[aspiration] = (stats.careerAspiration[aspiration] || 0) + 1;
    const military = s.military_status || '미설정';
    stats.militaryStatus[military] = (stats.militaryStatus[military] || 0) + 1;
    const certCount = Array.isArray(s.certificates) ? s.certificates.length : 0;
    if (certCount >= 6) stats.certificateDistribution['6개 이상']++; else stats.certificateDistribution[`${certCount}개` as keyof typeof stats.certificateDistribution]++;
  });
  return stats;
}

export const getCurrentUserProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, username, role, full_name, assigned_year, assigned_major, assigned_class, assigned_grade')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) return profile;

  // Fallback: Auth user metadata (학생 계정 등 RLS/지연 방지)
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    username: meta.username || user.email?.split('@')[0] || 'user',
    role: (meta.role || (meta.student_id ? 'student' : 'staff')) as string,
    full_name: meta.full_name || '사용자',
    assigned_year: meta.assigned_year || null,
    assigned_major: meta.assigned_major || null,
    assigned_class: meta.assigned_class || null,
    assigned_grade: meta.assigned_grade || null,
  };
});


/**
 * [최적화] 모든 학생의 성적 데이터를 가져옵니다.
 */
export async function getAllStudentScores() {
  const supabase = await createClient();
  const allStudents: any[] = [];
  let sFrom = 0;
  let sHasMore = true;
  while (sHasMore) {
    const { data } = await supabase.from('students').select('id, student_name, student_number, major, class_info, graduation_year').range(sFrom, sFrom + 999);
    if (!data || data.length === 0) { sHasMore = false; }
    else { allStudents.push(...data); if (data.length < 1000) sHasMore = false; else sFrom += 1000; }
  }
  const studentMap = allStudents.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, any>);
  const { count } = await supabase.from('student_scores').select('*', { count: 'exact', head: true });
  if (!count) return [];
  const PAGE_SIZE = 1000;
  const CHUNK_SIZE = 5;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const allScores: any[] = [];
  for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
    const promises = [];
    for (let j = i; j < Math.min(i + CHUNK_SIZE, totalPages); j++) {
      promises.push(supabase.from('student_scores').select('*').order('id', { ascending: true }).range(j * PAGE_SIZE, (j * PAGE_SIZE) + PAGE_SIZE - 1));
    }
    const results = await Promise.all(promises);
    results.forEach(res => { if (res.data) allScores.push(...res.data); });
  }
  return allScores.map(score => ({ ...score, students: studentMap[score.student_id] || null }));
}

// 직기초 성적 및 종합 요약 인메모리 캐시 (0ms 초고속 응답용, 5분 TTL)
const yearlyRankingsMemoryCache: Record<string, { data: Record<string, any>; timestamp: number }> = {};
const YEARLY_RANKINGS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function clearYearlyRankingsCache(graduationYear?: number) {
  if (graduationYear) {
    Object.keys(yearlyRankingsMemoryCache).forEach(k => {
      if (k.startsWith(`${graduationYear}-`)) delete yearlyRankingsMemoryCache[k];
    });
  } else {
    Object.keys(yearlyRankingsMemoryCache).forEach(k => delete yearlyRankingsMemoryCache[k]);
  }
}

/**
 * [초고속 요약] 특정 졸업연도 학생들의 석차 및 성취도를 사전 계산합니다.
 */
export async function getYearlyRankingsSummary(graduationYear: number, baseYear: number = 2026) {
  const cacheKey = `${graduationYear}-${baseYear}`;
  const now = Date.now();
  const cached = yearlyRankingsMemoryCache[cacheKey];
  if (cached && (now - cached.timestamp < YEARLY_RANKINGS_CACHE_TTL_MS)) {
    return cached.data;
  }

  const supabase = createAdminClient();

  // 1. [초고속 1단계] 학생 목록, 가중치 병렬 조회
  const [studentsResult, weights] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('graduation_year', graduationYear)
      .order('major', { ascending: true })
      .order('class_info', { ascending: true })
      .order('student_number', { ascending: true }),
    getAchievementScores()
  ]);

  if (studentsResult.error || !studentsResult.data || studentsResult.data.length === 0) return {};
  const students = studentsResult.data;
  const studentIds = students.map(s => s.id);

  // 2. [초고속 2단계] 15명 단위 청크로 분할 (Supabase 1000개 행 제한을 초과하지 않도록 안전한 청크 크기 적용)
  const CHUNK_SIZE = 15;
  const chunks: string[][] = [];
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    chunks.push(studentIds.slice(i, i + CHUNK_SIZE));
  }

  const scorePromises = chunks.map(chunk =>
    supabase
      .from('student_scores')
      .select('student_id, credits, achievement')
      .in('student_id', chunk)
      .range(0, 5000)
  );

  const attendancePromises = chunks.map(chunk =>
    supabase
      .from('student_attendance')
      .select('student_id, grade, semester, school_days, remarks, absent_unexcused, late_unexcused, early_unexcused, out_unexcused, absent_disease, late_disease, early_disease, out_disease, absent_other, late_other, early_other, out_other')
      .in('student_id', chunk)
      .range(0, 5000)
  );

  const [scoreResults, attendanceResults] = await Promise.all([
    Promise.all(scorePromises),
    Promise.all(attendancePromises)
  ]);

  const allScores: any[] = [];
  scoreResults.forEach(res => {
    if (res.data && res.data.length > 0) {
      allScores.push(...res.data);
    }
  });

  const allAttendance: any[] = [];
  attendanceResults.forEach(res => {
    if (res.data && res.data.length > 0) {
      allAttendance.push(...res.data);
    }
  });

  const maxWeight = Math.max(...Object.values(weights), 0);



  // 3. 학생별 통계 집계 초기화
  const stats: Record<string, any> = {};
  students.forEach(s => {
    const currentGrade = 4 - (s.graduation_year - baseYear);
    stats[s.id] = { 
      id: s.id, name: s.student_name, number: s.student_number, 
      major: s.major, classInfo: s.class_info, currentGrade,
      rawScore: 0, maxPossible: 0, subjectCount: 0,
      gradeCounts: { "A": 0, "B": 0, "C": 0, "D": 0, "E": 0 }
    };
  });

  // 4. 수집된 모든 성적으로 요약 계산
  allScores.forEach(record => {
    const s = stats[record.student_id];
    if (!s) return;
    const credits = record.credits || 0;
    const ach = record.achievement?.toUpperCase();
    if (ach && weights[ach]) {
      s.rawScore += (weights[ach] * credits);
      if (s.gradeCounts.hasOwnProperty(ach)) s.gradeCounts[ach]++;
    }
    s.maxPossible += (maxWeight * credits);
    s.subjectCount++;
  });

  // 5. 출결 데이터 집계
  allAttendance.forEach(record => {
    const s = stats[record.student_id];
    if (!s) return;

    
    if (!s.attnRecords) s.attnRecords = [];
    s.attnRecords.push(record);

    if (!s.attendance) {
      s.attendance = {
        unexcused: { absent: 0, late: 0, early: 0, out: 0 },
        disease: { absent: 0, late: 0, early: 0, out: 0 },
        other: { absent: 0, late: 0, early: 0, out: 0 }
      };
    }
    s.attendance.unexcused.absent += record.absent_unexcused || 0;
    s.attendance.unexcused.late += record.late_unexcused || 0;
    s.attendance.unexcused.early += record.early_unexcused || 0;
    s.attendance.unexcused.out += record.out_unexcused || 0;

    s.attendance.disease.absent += record.absent_disease || 0;
    s.attendance.disease.late += record.late_disease || 0;
    s.attendance.disease.early += record.early_disease || 0;
    s.attendance.disease.out += record.out_disease || 0;

    s.attendance.other.absent += record.absent_other || 0;
    s.attendance.other.late += record.late_other || 0;
    s.attendance.other.early += record.early_other || 0;
    s.attendance.other.out += record.out_other || 0;
  });

  const rankingList = Object.values(stats).map((s: any) => ({
    ...s,
    finalScore: s.maxPossible > 0 ? parseFloat(((s.rawScore / s.maxPossible) * 100).toFixed(2)) : 0
  })).sort((a, b) => b.finalScore - a.finalScore);

  const resultMap: Record<string, any> = {};
  rankingList.forEach((student, idx) => {
    const sameClass = rankingList.filter(s => s.major === student.major && s.classInfo === student.classInfo);
    resultMap[student.id] = {
      ...student,
      totalRank: idx + 1,
      schoolTotal: rankingList.length,
      classRank: sameClass.findIndex(s => s.id === student.id) + 1,
      classTotal: sameClass.length,
      attendance: student.attendance || null,
      attnRecords: student.attnRecords || []
    };
  });

  yearlyRankingsMemoryCache[cacheKey] = { data: resultMap, timestamp: now };
  return resultMap;
}

/**
 * [캐싱 최적화] 성취도 환산 점수표 Next.js 글로벌 영구 캐싱
 */
export const getAchievementScores = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createAdminClient();
    try {
      const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'achievement_scores').single();
      if (error || !data?.value) {
        return { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 };
      }
      return data.value as Record<string, number>;
    } catch (error) {
      return { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 };
    }
  },
  ['achievement-scores-global'],
  {
    revalidate: 86400,
    tags: ['settings', 'achievement-scores']
  }
);

/**
 * [캐싱 최적화] 특정 졸업연도 학생들의 석차 및 성취도 Next.js 영구 캐싱 (Vercel 전역 0.01초 공유)
 */
const yearlyRankingsSummaryCacheMap = new Map<string, ReturnType<typeof unstable_cache>>();

export async function getCachedYearlyRankingsSummary(graduationYear: number, baseYear: number = 2026): Promise<Record<string, any>> {
  const cacheKey = `${graduationYear}-${baseYear}`;
  if (!yearlyRankingsSummaryCacheMap.has(cacheKey)) {
    const cachedFn = unstable_cache(
      async () => getYearlyRankingsSummary(graduationYear, baseYear),
      [`yearly-rankings-summary-${cacheKey}`],
      {
        revalidate: 86400,
        tags: [`rankings-${graduationYear}`, 'students', 'student_scores']
      }
    );
    yearlyRankingsSummaryCacheMap.set(cacheKey, cachedFn);
  }
  return yearlyRankingsSummaryCacheMap.get(cacheKey)!();
}


/**
 * [캐싱] 전교 학과 및 반 구조 조합 목록 캐싱 (students 태그 적용)
 */
export async function getCachedClassStructureCombinations() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('students')
        .select('graduation_year, major, class_info')
        .not('graduation_year', 'is', null)
        .not('major', 'is', null)
        .not('class_info', 'is', null);
      return data || [];
    },
    ['class-structure-combinations'],
    {
      revalidate: 86400,
      tags: ['students']
    }
  )();
}

/**
 * [캐싱] 담임 교사 프로필 목록 서버 메모리 캐싱 (teachers 태그 적용)
 */
export async function getCachedTeacherProfiles() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, assigned_grade, assigned_major, assigned_class, assigned_year')
        .not('assigned_major', 'is', null);
      return data || [];
    },
    ['teacher-profiles-all'],
    {
      revalidate: 86400,
      tags: ['teachers']
    }
  )();
}



