import { createClient } from '@/lib/supabase/server';
import { StudentEmploymentData, FieldTrainingRecord, MAJOR_SORT_ORDER } from './types';

export type { StudentEmploymentData, FieldTrainingRecord };
export { MAJOR_SORT_ORDER };

/**
 * 특정 졸업연도의 모든 학생 및 취업/실습 데이터를 가져와 평탄화합니다.
 */
export async function getFilteredStudentData(graduationYear: string): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('graduation_year', parseInt(graduationYear))
    .order('major')
    .order('class_info')
    .order('student_number');

  if (studentError) return [];

  const { data: employments } = await supabase
    .from('student_employments')
    .select('*')
    .in('id', students.map(s => s.id));

  const { data: trainings } = await supabase
    .from('field_training_records')
    .select('*')
    .in('student_id', students.map(s => s.id))
    .order('training_order', { ascending: false });

  const flattened = flattenStudentData(students, employments || [], trainings || []);

  return flattened.sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a.major || '');
    const indexB = MAJOR_SORT_ORDER.indexOf(b.major || '');
    if (indexA !== indexB) return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    if (a.class_info !== b.class_info) return (a.class_info || '').localeCompare(b.class_info || '');
    return (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true });
  });
}

export async function getAssignedStudentDetails(major: string, classInfo: string, graduationYear: number) {
  const supabase = await createClient();
  const { data: students, error } = await supabase
    .from('students')
    .select('*, student_employments (*), student_counseling_logs (*)')
    .eq('major', major).eq('class_info', classInfo).eq('graduation_year', graduationYear).order('student_number');

  if (error) return [];

  const { data: trainings } = await supabase.from('field_training_records').select('*').in('student_id', students.map(s => s.id)).order('training_order', { ascending: false });

  return students.map(s => {
    const studentTrainings = (trainings || []).filter(t => t.student_id === s.id);
    const latestTraining = studentTrainings[0];
    return {
      ...s, ...s.student_employments, training_records: studentTrainings, counseling_logs: s.student_counseling_logs || [],
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

export async function getGraduationYears() {
  const supabase = await createClient();
  const { data } = await supabase.from('students').select('graduation_year');
  if (!data) return [];
  const years = Array.from(new Set(data.map(d => d.graduation_year))).filter((y): y is number => y !== null);
  return years.sort((a, b) => b - a);
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

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('id, role, assigned_year, assigned_major, assigned_class, assigned_grade').eq('id', user.id).single();
  return profile;
}

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
 * [초고속 요약] 특정 졸업연도 학생들의 석차 및 성취도를 사전 계산합니다. (1000건 제한 해제)
 */
export async function getYearlyRankingsSummary(graduationYear: number) {
  const supabase = await createClient();
  
  // 1. 해당 졸업연도 학생 정보 조회
  const { data: students } = await supabase
    .from('students')
    .select('id, student_name, student_number, major, class_info, graduation_year')
    .eq('graduation_year', graduationYear);

  if (!students || students.length === 0) return {};

  const studentIds = students.map(s => s.id);

  // 2. 해당 학생들의 성적 데이터 전량 수집 (1000건 제한 우회)
  const allScores: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('student_scores')
      .select('student_id, credits, achievement')
      .in('student_id', studentIds)
      .range(from, from + 999);

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allScores.push(...data);
      if (data.length < 1000) hasMore = false;
      else from += 1000;
    }
    if (allScores.length > 50000) break;
  }

  const weights = await getAchievementScores();
  const maxWeight = Math.max(...Object.values(weights), 0);

  // 3. 학생별 통계 집계 초기화
  const stats: Record<string, any> = {};
  students.forEach(s => {
    stats[s.id] = { 
      id: s.id, name: s.student_name, number: s.student_number, 
      major: s.major, classInfo: s.class_info, currentGrade: (4 - (s.graduation_year - 2026)),
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
      classTotal: sameClass.length
    };
  });

  return resultMap;
}

export async function getAchievementScores(): Promise<Record<string, number>> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'achievement_scores').single();
    if (error) throw error
    return data.value as Record<string, number>
  } catch (error) {
    return { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 }
  }
}
