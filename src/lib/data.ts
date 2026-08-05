import { createClient, createAdminClient } from '@/lib/supabase/server';
import { StudentEmploymentData, FieldTrainingRecord, MAJOR_SORT_ORDER } from './types';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

export type { StudentEmploymentData, FieldTrainingRecord };
export { MAJOR_SORT_ORDER };

/**
 * 특정 졸업연도의 모든 학생 및 취업/실습 데이터를 가져와 평탄화합니다.
 */
export async function getFilteredStudentData(graduationYear: string, baseYear?: number): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  const gradYearInt = parseInt(graduationYear);
  
  // [최적화] Promise.all을 활용해 학생 정보, 실습 기록, 학적 이력을 병렬로 쿼리하여 네트워크 왕복 시간을 1/3로 단축
  // [컬럼 슬림화 최적화] 불필요한 대용량 컬럼(전화번호, 옷/신발 사이즈, 학부모 의견 등)을 제외하고 필수 데이터만 골라서 select 합니다.
  const [studentsResult, trainingsResult, historyResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_id, student_name, graduation_year, major, class_info, student_number, certificates, career_aspiration, career_course, special_notes, student_employments (id, is_desiring_employment, employment_status, company_type, business_type, company, remarks)')
      .eq('graduation_year', gradYearInt)
      .order('major')
      .order('class_info')
      .order('student_number')
      .range(0, 5000),
    supabase
      .from('field_training_records')
      .select('id, student_id, training_order, company, start_date, end_date, stipend_status, hiring_status, conversion_date, students!inner(graduation_year)')
      .eq('students.graduation_year', gradYearInt)
      .order('training_order', { ascending: false }),
    baseYear 
      ? supabase
          .from('student_academic_history')
          .select('id, student_id, major, class_info, student_number, teacher_name, grade, students!inner(graduation_year)')
          .eq('academic_year', baseYear)
          .eq('students.graduation_year', gradYearInt)
      : Promise.resolve({ data: [] as any[], error: null })
  ]);

  if (studentsResult.error) {
    console.error('Error fetching students:', studentsResult.error);
    return [];
  }
  const students = studentsResult.data || [];
  const trainings = trainingsResult.data || [];
  const historyData = historyResult?.data || [];

  // 3. 데이터 평탄화 (데이터 뒤섞임 방지를 위해 명시적 객체 생성)
  const flattened = students.map(s => {
    // Supabase Join 결과인 student_employments 배열 처리
    const rawEmp = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const { student_employments, ...studentBase } = s; // 원본 배열 제거하여 중복 방지
    const emp = rawEmp || {}; // 데이터가 없을 경우 빈 객체 처리

    const studentTrainings = (trainings || []).filter(t => t.student_id === s.id);
    const latestTraining = studentTrainings[0];
    const hist = historyData.find(h => h.student_id === s.id);

    return {
      ...studentBase,
      ...emp,
      // 히스토리 정보가 있으면 우선 적용 (시간 여행 기능)
      ...(hist ? {
        major: hist.major,
        class_info: hist.class_info,
        student_number: hist.student_number,
        teacher_name: hist.teacher_name,
        grade: hist.grade
      } : {}),
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

export async function getAssignedStudentDetails(major: string, classInfo: string, graduationYear: number, baseYear?: number) {
  const supabase = await createClient();
  
  // [최적화] Promise.all을 활용해 학생 정보, 실습 기록, 학적 이력을 병렬로 조회
  // [컬럼 슬림화 최적화] 불필요한 대용량 컬럼(전화번호, 옷/신발 사이즈, 학부모 의견 등)을 제외하고 필수 데이터만 골라서 select 합니다.
  const [studentsResult, trainingsResult, historyResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_id, student_name, graduation_year, major, class_info, student_number, certificates, career_aspiration, career_course, special_notes, student_employments (id, is_desiring_employment, employment_status, company_type, business_type, company, remarks), student_counseling_logs (*)')
      .eq('major', major)
      .eq('class_info', classInfo)
      .eq('graduation_year', graduationYear)
      .order('student_number'),
    supabase
      .from('field_training_records')
      .select('id, student_id, training_order, company, start_date, end_date, stipend_status, hiring_status, conversion_date, students!inner(graduation_year, major, class_info)')
      .eq('students.graduation_year', graduationYear)
      .eq('students.major', major)
      .eq('students.class_info', classInfo)
      .order('training_order', { ascending: false }),
    baseYear 
      ? supabase
          .from('student_academic_history')
          .select('id, student_id, major, class_info, student_number, teacher_name, grade, students!inner(graduation_year, major, class_info)')
          .eq('academic_year', baseYear)
          .eq('students.graduation_year', graduationYear)
          .eq('students.major', major)
          .eq('students.class_info', classInfo)
      : Promise.resolve({ data: [] as any[], error: null })
  ]);

  if (studentsResult.error || !studentsResult.data) return [];
  const students = studentsResult.data;
  const trainings = trainingsResult.data || [];
  const historyData = historyResult?.data || [];

  return students.map(s => {
    const studentEmployments = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const { student_employments, ...studentBase } = s;
    const emp = studentEmployments || {};
    const studentTrainings = (trainings || []).filter(t => t.student_id === s.id);
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
      counseling_logs: s.student_counseling_logs || [],
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
    };
  }).sort((a, b) => (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true }));
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
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return data || [];
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
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name, assigned_year, assigned_major, assigned_class, assigned_grade').eq('id', user.id).single();
  return profile;
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

/**
 * [초고속 요약] 특정 졸업연도 학생들의 석차 및 성취도를 사전 계산합니다.
 */
export async function getYearlyRankingsSummary(graduationYear: number, baseYear: number = 2026) {
  const supabase = await createClient();
  
  // 1. [최적화] 학생 정보 조회, 전체 성적 개수 카운트, 출결 정보 수집을 병렬로 수행하여 대기시간 단축
  const [studentsResult, countResult, attendanceResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, student_number, major, class_info, graduation_year')
      .eq('graduation_year', graduationYear),
    supabase
      .from('student_scores')
      .select('student_id, students!inner(graduation_year)', { count: 'exact', head: true })
      .eq('students.graduation_year', graduationYear),
    supabase
      .from('student_attendance')
      .select('student_id, grade, semester, school_days, remarks, absent_unexcused, late_unexcused, early_unexcused, out_unexcused, absent_disease, late_disease, early_disease, out_disease, absent_other, late_other, early_other, out_other, students!inner(graduation_year)')
      .eq('students.graduation_year', graduationYear)
  ]);

  if (studentsResult.error || !studentsResult.data || studentsResult.data.length === 0) return {};
  const students = studentsResult.data;
  const studentIds = students.map(s => s.id);
  const count = countResult.count || 0;

  // 2. [최적화] 성적 데이터를 페이지 단위로 병렬 수집하여 순차 루프(while)로 인한 병목 현상 완벽 제거
  const PAGE_SIZE = 1000;
  const numPages = Math.ceil(count / PAGE_SIZE);
  const promises = [];
  for (let i = 0; i < numPages; i++) {
    promises.push(
      supabase
        .from('student_scores')
        .select('student_id, credits, achievement, students!inner(graduation_year)')
        .eq('students.graduation_year', graduationYear)
        .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
    );
  }

  const results = await Promise.all(promises);
  const allScores: any[] = [];
  results.forEach(res => {
    if (res.error) throw res.error;
    if (res.data) allScores.push(...res.data);
  });

  const weights = await getAchievementScores();
  const maxWeight = Math.max(...Object.values(weights), 0);

  // 3. 학생별 통계 집계 초기화
  const stats: Record<string, any> = {};
  students.forEach(s => {
    // [학년 계산 공식 수정] 4 - (졸업연도 - 학사학년도)
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
  (attendanceResult.data || []).forEach(record => {
    const s = stats[record.student_id];
    if (!s) return;
    
    // 개별 레코드 저장 (상세 모달용)
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
      attnRecords: student.attnRecords || [] // 상세 기록 리스트 추가
    };
  });

  return resultMap;
}

const getAchievementScoresCached = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createAdminClient()
    try {
      const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'achievement_scores').single();
      if (error) throw error
      return data.value as Record<string, number>
    } catch (error) {
      return { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 }
    }
  },
  ['achievement-scores'],
  { revalidate: 3600, tags: ['settings'] }
);

export async function getAchievementScores(): Promise<Record<string, number>> {
  return getAchievementScoresCached();
}
