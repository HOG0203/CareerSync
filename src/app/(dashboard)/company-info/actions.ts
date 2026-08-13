'use server';

import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';

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
  employeeCount?: number;
  traineeCount?: number;
};

export type UnregisteredCompanyData = {
  name: string;
  employeeCount: number;
  traineeCount: number;
  totalCount: number;
};

/**
 * 기업 목록 검색 및 조회 (취업생/실습생 카운트 및 서버 메모리 캐싱 적용)
 */
export async function getCompanies(search?: string) {
  const cleanSearch = search ? search.trim() : '';

  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // 시스템 기준년도 조회
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'base_year')
        .single();
      const baseYear = settingsData?.value ? (settingsData.value as any).year : 2026;

      let query = supabase.from('companies').select('*').order('name');
      
      if (cleanSearch) {
        query = query.ilike('name', `%${cleanSearch}%`);
      }
      
      const [{ data, error }, { data: empCompanies }, { data: traineeRecords }] = await Promise.all([
        query,
        supabase
          .from('student_employments')
          .select('company')
          .eq('business_type', '취업')
          .not('company', 'is', null),
        supabase
          .from('field_training_records')
          .select('company, student_id, hiring_status, students!inner(graduation_year)')
          .in('hiring_status', ['진행중', '채용전환'])
          .gte('students.graduation_year', baseYear + 1)
      ]);

      const empCounts: Record<string, number> = {};
      (empCompanies || []).forEach((e: any) => {
        const name = (e.company || '').trim();
        if (name) empCounts[name] = (empCounts[name] || 0) + 1;
      });

      const traineeCounts: Record<string, number> = {};
      (traineeRecords || []).forEach((t: any) => {
        const name = (t.company || '').trim();
        if (name) traineeCounts[name] = (traineeCounts[name] || 0) + 1;
      });

      const companiesWithCounts = (data || []).map((c: any) => {
        const trimmedName = (c.name || '').trim();
        return {
          ...c,
          employeeCount: empCounts[trimmedName] || 0,
          traineeCount: traineeCounts[trimmedName] || 0,
        };
      });

      return { data: companiesWithCounts, error: error?.message || null };
    },
    [`companies-v3-${cleanSearch || 'all'}`],
    {
      revalidate: 3600,
      tags: ['companies']
    }
  )();
}

/**
 * 특정 기업의 상세 정보와 소속 학생 통합 조회
 */
export async function getCompanyDetails(companyName: string) {
  const supabase = createAdminClient();
  
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
  const currentGradYears = [baseYear + 1, baseYear + 2, baseYear + 3];
    
  // 2. 취업생 정보 (졸업생 포함 전체 인적사항 + 취업/실습 이력)
  const { data: employees } = await supabase
    .from('student_employments')
    .select('*')
    .eq('company', companyName)
    .eq('business_type', '취업');
    
  let employeeDetails: any[] = [];
  if (employees && employees.length > 0) {
    const empIds = employees.map((e: any) => e.id);
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .in('id', empIds);

    if (students && students.length > 0) {
      const validEmpIds = students.map((s: any) => s.id);
      const { data: trainings } = await supabase
        .from('field_training_records')
        .select('*')
        .in('student_id', validEmpIds);

      employeeDetails = students.map((s: any) => {
        const emp = employees.find((e: any) => e.id === s.id) || {};
        const sTrainings = (trainings || []).filter((t: any) => t.student_id === s.id);
        const latestT = sTrainings[0];
        return {
          ...s,
          ...emp,
          training_records: sTrainings,
          has_field_training: latestT ? 'O' : '',
          latest_training_company: latestT?.company,
          start_date: latestT?.start_date,
          end_date: latestT?.end_date,
          training_stipend_status: latestT?.stipend_status,
          is_hiring_conversion: latestT?.hiring_status === '채용전환' ? latestT?.conversion_date : '',
          is_returned: latestT?.hiring_status === '복교' ? 'O' : '',
        };
      });
    }
  }
  
  // 3. 실습생 정보 (졸업생 제외 재학생 전용: baseYear + 1 이상 졸업년도 + 동일 업체명)
  const { data: trainees } = await supabase
    .from('field_training_records')
    .select('*')
    .eq('company', companyName)
    .in('hiring_status', ['진행중', '채용전환']);
    
  let traineeDetails: any[] = [];
  if (trainees && trainees.length > 0) {
    const traineeStudentIds = Array.from(new Set(trainees.map((t: any) => t.student_id)));
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .in('id', traineeStudentIds)
      .gte('graduation_year', baseYear + 1);
      
    if (students && students.length > 0) {
      const validStudentIds = students.map((s: any) => s.id);
      const { data: employments } = await supabase
        .from('student_employments')
        .select('*')
        .in('id', validStudentIds);

      const { data: allTrainings } = await supabase
        .from('field_training_records')
        .select('*')
        .in('student_id', validStudentIds);

      traineeDetails = students.map((s: any) => {
        const emp = (employments || []).find((e: any) => e.id === s.id) || {};
        const trainee = trainees.find((t: any) => t.student_id === s.id);
        const sTrainings = (allTrainings || []).filter((t: any) => t.student_id === s.id);
        const latestT = sTrainings[0];
        return {
          ...s,
          ...emp,
          hiring_status: trainee?.hiring_status,
          training_records: sTrainings,
          has_field_training: latestT ? 'O' : '',
          latest_training_company: latestT?.company,
          start_date: latestT?.start_date,
          end_date: latestT?.end_date,
          training_stipend_status: latestT?.stipend_status,
          is_hiring_conversion: latestT?.hiring_status === '채용전환' ? latestT?.conversion_date : '',
          is_returned: latestT?.hiring_status === '복교' ? 'O' : '',
        };
      });
    }
  }
  
  return {
    company,
    name: companyName,
    employees: employeeDetails,
    trainees: traineeDetails,
    baseYear
  };
}

/**
 * 기업 정보 등록 및 수정 (Admin Only)
 */
export async function upsertCompany(companyData: CompanyData) {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('companies')
    .upsert({
      ...companyData,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
    
  if (!error) {
    revalidateTag('companies');
    revalidatePath('/company-info');
  }

  return { data, error };
}

/**
 * 기업 정보 삭제 (Admin Only)
 */
export async function deleteCompany(id: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.from('companies').delete().eq('id', id);
  
  if (!error) {
    revalidateTag('companies');
    revalidatePath('/company-info');
  }

  return { error };
}

/**
 * 기업 정보 일괄 등록 및 수정 (Admin Only)
 */
export async function bulkUpsertCompanies(companiesData: CompanyData[]) {
  const supabase = createAdminClient();
  
  if (!companiesData || companiesData.length === 0) {
    return { error: '등록할 업체 정보가 없습니다.' };
  }

  const now = new Date().toISOString();
  const payload = companiesData.map(c => ({
    name: c.name.trim(),
    location: c.location || null,
    industry: c.industry || null,
    company_type: c.company_type || null,
    job_description: c.job_description || null,
    salary: c.salary || null,
    bonus: c.bonus || null,
    working_hours: c.working_hours || null,
    employment_type: c.employment_type || null,
    welfare: c.welfare || null,
    required_major: c.required_major || null,
    required_certificates: c.required_certificates || null,
    etc: c.etc || null,
    strengths: c.strengths || null,
    updated_at: now
  }));

  const { data, error } = await supabase
    .from('companies')
    .upsert(payload, { onConflict: 'name' })
    .select();

  if (!error) {
    revalidateTag('companies');
    revalidatePath('/company-info');
  }

  return { count: data ? data.length : payload.length, error: error?.message };
}

/**
 * 학생 취업현황이 '취업'으로 기록된 기업 중, 기업 마스터 DB(companies)에는 등록되지 않은 미등록 기업 목록 감지
 */
export async function getUnregisteredCompanies() {
  const supabase = createAdminClient();

  // 1. 등록된 기업 명단 조회
  const { data: registeredCompanies } = await supabase
    .from('companies')
    .select('name');
  
  const registeredNameSet = new Set((registeredCompanies || []).map((c: any) => (c.name || '').trim()).filter(Boolean));

  // 2. 취업현황이 '취업'인 학생의 기업명만 조회 (business_type === '취업')
  const { data: empCompanies } = await supabase
    .from('student_employments')
    .select('company')
    .eq('business_type', '취업')
    .not('company', 'is', null);

  const empCounts: Record<string, number> = {};
  (empCompanies || []).forEach((e: any) => {
    const name = (e.company || '').trim();
    if (name) empCounts[name] = (empCounts[name] || 0) + 1;
  });

  const unregistered: UnregisteredCompanyData[] = [];

  Object.entries(empCounts).forEach(([name, count]) => {
    if (!registeredNameSet.has(name)) {
      unregistered.push({
        name,
        employeeCount: count,
        traineeCount: 0,
        totalCount: count
      });
    }
  });

  unregistered.sort((a, b) => b.totalCount - a.totalCount);

  return unregistered;
}
