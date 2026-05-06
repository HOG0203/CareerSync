'use client';

import { createClient } from '@/lib/supabase/client';

export type CompanyData = {
  id?: string;
  name: string;
  location?: string;
  industry?: string;
  company_type?: string;
  job_description?: string;
  salary?: string;
  bonus?: string;
  working_hours?: string;
  employment_type?: string;
  welfare?: string;
  required_major?: string;
  required_certificates?: string;
  etc?: string;
  strengths?: string;
};

/**
 * 기업 목록 검색 및 조회
 */
export async function getCompanies(search?: string) {
  const supabase = createClient();
  let query = supabase.from('companies').select('*').order('name');
  
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  
  const { data, error } = await query;
  return { data, error };
}

/**
 * 특정 기업의 상세 정보와 소속 학생 통합 조회
 */
export async function getCompanyDetails(companyName: string) {
  const supabase = createClient();
  
  // 1. 기업 정보
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('name', companyName)
    .single();

  // 시스템 기준년도 조회 (학년 필터링용)
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'base_year')
    .single();
  
  const baseYear = settingsData?.value ? (settingsData.value as any).year : 2026;
  // 현재 학년도 학생들의 졸업연도 (1~3학년)
  const currentGradYears = [baseYear + 1, baseYear + 2, baseYear + 3];
    
  // 2. 취업생 정보 (취업생은 졸업생도 포함될 수 있으므로 졸업연도 필터 제외 또는 별도 처리 가능하나, 
  // 여기서는 기존 로직 유지 - 모든 졸업연도의 '취업' 상태 학생)
  const { data: employees } = await supabase
    .from('student_employments')
    .select('id, company, business_type')
    .eq('company', companyName)
    .eq('business_type', '취업');
    
  let employeeDetails: any[] = [];
  if (employees && employees.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, major, class_info, student_number, graduation_year')
      .in('id', employees.map(e => e.id));
    employeeDetails = students || [];
  }
  
  // 3. 실습생 정보 (현재 학년도 학생만 표시)
  const { data: trainees } = await supabase
    .from('field_training_records')
    .select('student_id, company, hiring_status')
    .eq('company', companyName)
    .in('hiring_status', ['진행중', '채용전환']);
    
  let traineeDetails: any[] = [];
  if (trainees && trainees.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, major, class_info, student_number, graduation_year')
      .in('id', trainees.map(t => t.student_id))
      .in('graduation_year', currentGradYears); // 현재 재학생(1,2,3학년)만 필터링
      
    // students가 필터링되었으므로, 필터링된 학생들에 대해서만 trainee 정보를 조합해야 함
    if (students && students.length > 0) {
      traineeDetails = students.map(s => {
        const trainee = trainees.find(t => t.student_id === s.id);
        return { ...s, hiring_status: trainee?.hiring_status };
      });
    }
  }
  
  return {
    company,
    employees: employeeDetails,
    trainees: traineeDetails
  };
}

/**
 * 기업 정보 등록 및 수정 (Admin Only)
 */
export async function upsertCompany(companyData: CompanyData) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다.' };
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') return { error: '관리자 권한이 필요합니다.' };
  
  const { data, error } = await supabase
    .from('companies')
    .upsert({
      ...companyData,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
    
  return { data, error };
}

/**
 * 기업 정보 삭제
 */
export async function deleteCompany(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('companies').delete().eq('id', id);
  return { error };
}
