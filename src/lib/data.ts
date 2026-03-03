import { createClient } from '@/lib/supabase/server';

export type StudentEmploymentData = {
  id: string; // students.id (UUID)
  student_id: string; // 학번 (Text)
  major: string;
  class_info?: string;
  student_number?: string;
  student_name?: string;
  employment_status?: string;
  company?: string;
  company_type?: string;
  business_type?: string;
  graduation_year?: number;
  has_field_training?: string;
  start_date?: string;
  end_date?: string;
  training_stipend_status?: string;
  is_hiring_conversion?: string;
  conversion_date?: string;
  remarks?: string;
  is_desiring_employment?: string;
  is_returned?: string;
  return_to_school_reason?: string;
  certificates?: string[];
  shoe_size?: string;
  top_size?: string;
  personal_remarks?: string;
};

// 학과 정렬 순서 정의
export const MAJOR_SORT_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '자동차기계과',
  '스마트공간과',
  '건설과',
  '스마트공간건축과',
  '스마트전기과',
  '전기과',
  '바이오화학과',
  '화학공업과',
  '스마트융합섬유과',
  '섬유소재과'
];

/**
 * 학생 데이터를 학과 > 반 > 번호 순으로 정렬합니다.
 */
export function sortStudents(students: StudentEmploymentData[]): StudentEmploymentData[] {
  return [...students].sort((a, b) => {
    const indexA = MAJOR_SORT_ORDER.indexOf(a.major);
    const indexB = MAJOR_SORT_ORDER.indexOf(b.major);
    const sortA = indexA === -1 ? 999 : indexA;
    const sortB = indexB === -1 ? 999 : indexB;
    if (sortA !== sortB) return sortA - sortB;
    const classA = a.class_info || '';
    const classB = b.class_info || '';
    if (classA !== classB) return classA.localeCompare(classB, 'ko');
    const numA = parseInt(a.student_number || '0', 10);
    const numB = parseInt(b.student_number || '0', 10);
    return numA - numB;
  });
}

/**
 * 중첩된 조인 데이터를 단일 객체로 평탄화합니다.
 */
function flattenStudentData(student: any): StudentEmploymentData {
  // 1:1 관계인 경우 객체로 오거나, 배열(단일 항목)로 올 수 있음
  const emp = Array.isArray(student.student_employments) 
    ? (student.student_employments[0] || {}) 
    : (student.student_employments || {});
    
  const { student_employments, ...basicInfo } = student;
  
  return {
    ...basicInfo,
    ...emp,
    id: basicInfo.id // 기본 정보의 UUID를 주 키로 보장
  } as StudentEmploymentData;
}

/**
 * 필터링된 학생 데이터를 가져옵니다 (연도 필터 추가).
 */
export async function getFilteredStudentData(year?: string): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('students')
    .select(`
      *,
      student_employments (*)
    `)
    .order('graduation_year', { ascending: false });

  if (year && year !== 'all') {
    query = query.eq('graduation_year', parseInt(year));
  }

  const { data, error } = await query.range(0, 999);

  if (error) {
    console.error('Error fetching filtered student data:', error.message);
    return [];
  }

  const flattenedData = data.map(flattenStudentData);
  return sortStudents(flattenedData);
}

/**
 * 모든 학생 데이터를 가져옵니다.
 */
export async function getStudentEmploymentData(): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      student_employments (*)
    `)
    .order('graduation_year', { ascending: false })
    .range(0, 999); // 명시적으로 더 많은 범위를 가져오도록 설정

  if (error) {
    console.error('Error fetching student data:', error.message);
    return [];
  }

  const flattenedData = data.map(flattenStudentData);
  return sortStudents(flattenedData);
}

/**
 * 특정 학반 학생 정보를 가져옵니다.
 */
export async function getAssignedStudentDetails(year: number, major: string, className: string): Promise<StudentEmploymentData[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('students')
    .select(`
      *,
      student_employments (*)
    `)
    .eq('graduation_year', year)
    .eq('major', major)
    .eq('class_info', className)
    .range(0, 999); // 명시적으로 더 많은 범위를 가져오도록 설정

  if (error) {
    console.error('Error fetching assigned students:', error.message);
    return [];
  }

  const flattenedData = data.map(flattenStudentData);
  return sortStudents(flattenedData);
}

export async function getGraduationYears(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('students').select('graduation_year');
  if (error) return [];
  const years = data.map(s => s.graduation_year);
  return [...new Set(years)].filter(y => y !== 0).sort((a, b) => b - a);
}

export async function getProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return data || [];
}
