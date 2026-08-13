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

// 필요한 학생 필드만 선택 (전체 컬럼 대신 화면에 사용하는 필드만)
const STUDENT_FIELDS = 'id, student_id, student_name, phone_number, graduation_year, major, class_info, student_number, certificates, career_aspiration, career_course, special_notes, military_status';
const EMPLOYMENT_FIELDS = 'id, is_desiring_employment, employment_status, company_type, business_type, company, remarks';
const TRAINING_FIELDS = 'id, student_id, training_order, company, start_date, end_date, stipend_status, hiring_status, conversion_date';

/**
 * 기업 목록 검색 및 조회 (취업생/실습생 카운트 + 캐싱)
 */
export async function getCompanies(search?: string) {
  const cleanSearch = search ? search.trim() : '';

  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // 시스템 기준년도 + companies + 카운트 데이터를 병렬로 조회
      let query = supabase.from('companies')
        .select('id, name, location, industry, company_type')
        .order('name');
      
      if (cleanSearch) {
        query = query.ilike('name', `%${cleanSearch}%`);
      }

      const [{ data: settingsData }, { data, error }, { data: empCompanies }, { data: traineeRecords }] = await Promise.all([
        supabase.from('system_settings').select('value').eq('key', 'base_year').single(),
        query,
        supabase.from('student_employments').select('company').eq('business_type', '취업').not('company', 'is', null),
        supabase.from('field_training_records')
          .select('company, student_id, hiring_status, students!inner(graduation_year)')
          .in('hiring_status', ['진행중', '채용전환'])
      ]);

      const baseYear = settingsData?.value ? (settingsData.value as any).year : 2026;

      // baseYear 필터링 (trainees는 재학생만)
      const filteredTrainees = (traineeRecords || []).filter((t: any) =>
        t.students?.graduation_year >= baseYear + 1
      );

      const empCounts: Record<string, number> = {};
      (empCompanies || []).forEach((e: any) => {
        const name = (e.company || '').trim();
        if (name) empCounts[name] = (empCounts[name] || 0) + 1;
      });

      const traineeCounts: Record<string, number> = {};
      filteredTrainees.forEach((t: any) => {
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
    { revalidate: 3600, tags: ['companies'] }
  )();
}

/**
 * 특정 기업의 상세 정보와 소속 학생 통합 조회 (병렬 쿼리 + 캐시 적용)
 */
export async function getCompanyDetails(companyName: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // 1단계: 기업 정보 + 기준년도 + 취업생 IDs + 실습 기록을 모두 병렬로 조회
      const [
        { data: company },
        { data: settingsData },
        { data: empRecords },
        { data: traineeRecords }
      ] = await Promise.all([
        supabase.from('companies').select('*').eq('name', companyName).single(),
        supabase.from('system_settings').select('value').eq('key', 'base_year').single(),
        supabase.from('student_employments')
          .select(EMPLOYMENT_FIELDS)
          .eq('company', companyName)
          .eq('business_type', '취업'),
        supabase.from('field_training_records')
          .select(TRAINING_FIELDS)
          .eq('company', companyName)
          .in('hiring_status', ['진행중', '채용전환'])
      ]);

      const baseYear = settingsData?.value ? (settingsData.value as any).year : 2026;

      // 2단계: 취업생 student IDs + 실습생 student IDs를 동시에 확보 → 학생 정보를 병렬 조회
      const empIds = (empRecords || []).map((e: any) => e.id);
      const traineeStudentIds = Array.from(
        new Set((traineeRecords || []).map((t: any) => t.student_id))
      );

      // 2단계 병렬: 취업생 students + 실습생 students + 취업생 훈련기록 + 실습생 employment 정보
      const [
        { data: empStudents },
        { data: traineeStudents },
        { data: empTrainings },
        { data: traineeEmployments },
        { data: traineeAllTrainings }
      ] = await Promise.all([
        empIds.length > 0
          ? supabase.from('students').select(STUDENT_FIELDS).in('id', empIds)
          : Promise.resolve({ data: [] as any[] }),
        traineeStudentIds.length > 0
          ? supabase.from('students').select(STUDENT_FIELDS)
              .in('id', traineeStudentIds)
              .gte('graduation_year', baseYear + 1)
          : Promise.resolve({ data: [] as any[] }),
        empIds.length > 0
          ? supabase.from('field_training_records').select(TRAINING_FIELDS).in('student_id', empIds)
          : Promise.resolve({ data: [] as any[] }),
        traineeStudentIds.length > 0
          ? supabase.from('student_employments').select(EMPLOYMENT_FIELDS).in('id', traineeStudentIds)
          : Promise.resolve({ data: [] as any[] }),
        traineeStudentIds.length > 0
          ? supabase.from('field_training_records').select(TRAINING_FIELDS).in('student_id', traineeStudentIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // 취업생 데이터 조합
      const employeeDetails = (empStudents || []).map((s: any) => {
        const emp = (empRecords || []).find((e: any) => e.id === s.id) || {};
        const sTrainings = (empTrainings || []).filter((t: any) => t.student_id === s.id);
        const latestT = sTrainings[0];
        return {
          ...s, ...emp,
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

      // 실습생 데이터 조합
      const validTraineeIds = new Set((traineeStudents || []).map((s: any) => s.id));
      const traineeDetails = (traineeStudents || []).map((s: any) => {
        const emp = (traineeEmployments || []).find((e: any) => e.id === s.id) || {};
        const trainee = (traineeRecords || []).find((t: any) => t.student_id === s.id);
        const sTrainings = (traineeAllTrainings || []).filter((t: any) => t.student_id === s.id);
        const latestT = sTrainings[0];
        return {
          ...s, ...emp,
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

      return {
        company,
        name: companyName,
        employees: employeeDetails,
        trainees: traineeDetails,
        baseYear
      };
    },
    [`company-details-v1-${companyName}`],
    { revalidate: 600, tags: ['companies', `company-${companyName}`] }
  )();
}

/**
 * 기업 정보 등록 및 수정 (Admin Only)
 */
export async function upsertCompany(companyData: CompanyData) {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('companies')
    .upsert({ ...companyData, updated_at: new Date().toISOString() })
    .select()
    .single();
    
  if (!error) {
    revalidateTag('companies');
    if (companyData.name) revalidateTag(`company-${companyData.name}`);
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
 * 미등록 기업 목록 감지 (캐시 10분)
 */
export async function getUnregisteredCompanies() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // 등록 기업명 + 취업 학생 기업명을 병렬로 조회
      const [{ data: registeredCompanies }, { data: empCompanies }] = await Promise.all([
        supabase.from('companies').select('name'),
        supabase.from('student_employments').select('company').eq('business_type', '취업').not('company', 'is', null)
      ]);

      const registeredNameSet = new Set(
        (registeredCompanies || []).map((c: any) => (c.name || '').trim()).filter(Boolean)
      );

      const empCounts: Record<string, number> = {};
      (empCompanies || []).forEach((e: any) => {
        const name = (e.company || '').trim();
        if (name) empCounts[name] = (empCounts[name] || 0) + 1;
      });

      const unregistered: UnregisteredCompanyData[] = Object.entries(empCounts)
        .filter(([name]) => !registeredNameSet.has(name))
        .map(([name, count]) => ({
          name,
          employeeCount: count,
          traineeCount: 0,
          totalCount: count
        }))
        .sort((a, b) => b.totalCount - a.totalCount);

      return unregistered;
    },
    ['unregistered-companies-v1'],
    { revalidate: 600, tags: ['companies'] }
  )();
}
