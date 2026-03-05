import { getFilteredStudentData, getGraduationYears, MAJOR_SORT_ORDER } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { AdminStudentHub } from './admin-student-hub';

export const dynamic = 'force-dynamic';

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  
  // 1. 기반 설정 패칭
  const [userRes, settings, graduationYears, masterCertificates] = await Promise.all([
    supabase.auth.getUser(),
    getSystemSettings(),
    getGraduationYears(),
    getMasterCertificates()
  ]);

  const user = userRes.data.user;
  if (!user) {
    redirect('/login');
  }

  // 2. 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 선택된 필터값 결정
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;
  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';
  const selectedStatus = params.status || 'all';

  // 3. 타겟 데이터 패칭 (해당 학년의 데이터만 DB에서 직접 필터링하여 가져옴)
  const allStudentData = await getFilteredStudentData(selectedYear);
  
  console.log(`DEBUG: Fetched ${allStudentData.length} students for year ${selectedYear}`);

  // 4. 세부 필터링 및 옵션 계산 (이미 DB에서 학년은 걸러짐)
  const majorCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const filteredData: typeof allStudentData = [];

  for (const student of allStudentData) {
    // 학과 카운트
    const major = student.major || '미지정';
    majorCounts[major] = (majorCounts[major] || 0) + 1;

    // 현재 선택된 학과에 해당하는 반 카운트
    if (selectedMajor === 'all' || student.major === selectedMajor) {
      const cInfo = student.class_info || '미지정';
      classCounts[cInfo] = (classCounts[cInfo] || 0) + 1;
      
      // 현재 선택된 반까지 만족하는 상태 카운트
      if (selectedClass === 'all' || student.class_info === selectedClass) {
        const status = student.employment_status || '미취업';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // 최종 필터링 데이터 (허브 테이블용)
        if (selectedStatus === 'all' || student.employment_status === selectedStatus) {
          filteredData.push(student);
        }
      }
    }
  }

  // 드롭다운 옵션 변환
  const majors = Object.entries(majorCounts)
    .sort(([a], [b]) => {
      const indexA = MAJOR_SORT_ORDER.indexOf(a);
      const indexB = MAJOR_SORT_ORDER.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
    .map(([m, count]) => ({ label: m, value: m, count }));

  const classes = Object.entries(classCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, count]) => ({ label: c, value: c, count }));

  const statuses = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([s, count]) => ({ label: s, value: s, count }));

  return (
    <AdminStudentHub 
      initialData={filteredData}
      graduationYears={graduationYears}
      majors={majors}
      classes={classes}
      statuses={statuses}
      settings={settings}
      params={params}
      masterCertificates={masterCertificates}
    />
  );
}
