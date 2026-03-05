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
