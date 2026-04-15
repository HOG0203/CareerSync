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

  // 사용자 정의 학과 순서(MAJOR_SORT_ORDER)에 따라 재정렬
  return flattened.sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a.major || '');
    const indexB = MAJOR_SORT_ORDER.indexOf(b.major || '');
    
    // 학과 순서가 다르면 학과 순서대로
    if (indexA !== indexB) {
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    }
    
    // 학과가 같으면 반, 번호 순으로 정렬
    if (a.class_info !== b.class_info) return (a.class_info || '').localeCompare(b.class_info || '');
    return (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true });
  });
}

/**
 * [복구] 특정 교사에게 할당된 학생들의 상세 정보 및 상담 로그를 가져옵니다.
 */
export async function getAssignedStudentDetails(major: string, classInfo: string, graduationYear: number) {
  const supabase = await createClient();
  
  // 1. 기본 학생 정보 및 취업 정보 가져오기
  const { data: students, error } = await supabase
    .from('students')
    .select(`
      *,
      student_employments (*),
      student_counseling_logs (*)
    `)
    .eq('major', major)
    .eq('class_info', classInfo)
    .eq('graduation_year', graduationYear)
    .order('student_number');

  if (error) {
    console.error('Error fetching assigned students:', error);
    return [];
  }

  // 2. 실습 이력 가져오기
  const { data: trainings } = await supabase
    .from('field_training_records')
    .select('*')
    .in('student_id', students.map(s => s.id))
    .order('training_order', { ascending: false });

  // 3. 데이터 평탄화 (flatten) 및 정렬
  return students.map(s => {
    const studentTrainings = (trainings || []).filter(t => t.student_id === s.id);
    const latestTraining = studentTrainings[0];

    return {
      ...s,
      ...s.student_employments,
      training_records: studentTrainings,
      counseling_logs: s.student_counseling_logs || [],
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      conversion_date: latestTraining?.conversion_date,
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
      return_to_school_reason: latestTraining?.return_reason
    };
  }).sort((a, b) => (a.student_number || '').localeCompare(b.student_number || '', undefined, { numeric: true }));
}

/**
 * [복구] 호환성을 위한 단일 학생 데이터 취득 함수
 */
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
      ...student,
      ...employment,
      training_records: studentTrainings,
      has_field_training: latestTraining ? 'O' : '',
      latest_training_company: latestTraining?.company,
      start_date: latestTraining?.start_date,
      end_date: latestTraining?.end_date,
      training_stipend_status: latestTraining?.stipend_status,
      is_hiring_conversion: latestTraining?.hiring_status === '채용전환' ? latestTraining?.conversion_date : '',
      conversion_date: latestTraining?.conversion_date,
      is_returned: latestTraining?.hiring_status === '복교' ? 'O' : '',
      return_to_school_reason: latestTraining?.return_reason
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

/**
 * [복구/추가] 모든 학생의 기본 정보를 가져옵니다 (사용자 관리 페이지용).
 */
export async function getAllStudentBaseData(): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  const { data: students, error } = await supabase
    .from('students')
    .select('id, graduation_year, major, class_info, student_number, student_name')
    .order('graduation_year', { ascending: false });

  if (error) return [];
  return students as any[];
}

export async function getProfiles() {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return data || [];
}

/**
 * 학년별 주요 지표(진로희망, 자격증, 병역희망) 통계를 가져옵니다.
 */
export async function getGradeStatistics(graduationYear: number) {
  const supabase = await createClient();
  
  const { data: students, error } = await supabase
    .from('students')
    .select('career_aspiration, certificates, military_status, major, class_info')
    .eq('graduation_year', graduationYear);

  if (error || !students) return null;

  const stats = {
    careerAspiration: {} as Record<string, number>,
    militaryStatus: {} as Record<string, number>,
    certificateDistribution: {
      '0개': 0, '1개': 0, '2개': 0, '3개': 0, '4개': 0, '5개': 0, '6개 이상': 0
    }
  };

  students.forEach(s => {
    // 1. 진로희망 집계
    const aspiration = s.career_aspiration || '미설정';
    stats.careerAspiration[aspiration] = (stats.careerAspiration[aspiration] || 0) + 1;

    // 2. 병역희망 집계
    const military = s.military_status || '미설정';
    stats.militaryStatus[military] = (stats.militaryStatus[military] || 0) + 1;

    // 3. 자격증 분포 집계 (3학년 디자인 호환)
    const certCount = Array.isArray(s.certificates) ? s.certificates.length : 0;
    if (certCount >= 6) stats.certificateDistribution['6개 이상']++;
    else stats.certificateDistribution[`${certCount}개` as keyof typeof stats.certificateDistribution]++;
  });

  return stats;
}

/**
 * 현재 로그인한 사용자의 프로필 정보를 가져옵니다.
 */
export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, assigned_year, assigned_major, assigned_class, assigned_grade')
    .eq('id', user.id)
    .single();

  return profile;
}
