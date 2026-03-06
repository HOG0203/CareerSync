import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getFilteredStudentData, getGraduationYears, MAJOR_SORT_ORDER } from '@/lib/data';
import { Users } from 'lucide-react';
import { StudentTable } from './student-table';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';

import DashboardFilters from '@/components/dashboard/dashboard-filters';

export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';

  // 1. 기반 설정 패칭
  const [settings, graduationYears, masterCertificates] = await Promise.all([
    getSystemSettings(),
    getGraduationYears(),
    getMasterCertificates()
  ]);

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  // 2. 타겟 데이터 패칭 (해당 학년의 데이터만 DB에서 직접 필터링하여 가져옴)
  let allStudentData = await getFilteredStudentData(selectedYear);
  
  // 교직원일 경우 본인 담당 학반 데이터만 추출 (관리자는 전체)
  if (isTeacher && profile.assigned_year) {
    allStudentData = allStudentData.filter(s => 
      s.graduation_year === profile.assigned_year &&
      s.major === profile.assigned_major &&
      s.class_info === profile.assigned_class
    );
  }

  // 필터 옵션 계산 (이미 DB에서 학년은 걸러짐)
  const majors = Array.from(new Set(allStudentData.map(s => s.major).filter(Boolean)))
    .sort((a, b) => {
      const indexA = MAJOR_SORT_ORDER.indexOf(a!);
      const indexB = MAJOR_SORT_ORDER.indexOf(b!);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
    .map(m => ({
      label: m!, value: m!, count: allStudentData.filter(s => s.major === m).length
    }));

  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';

  const classes = Array.from(new Set(allStudentData.filter(s => selectedMajor === 'all' || s.major === selectedMajor).map(s => s.class_info).filter(Boolean))).sort().map(c => ({
    label: c || '미지정', value: c || '미지정', count: allStudentData.filter(s => s.class_info === c && (selectedMajor === 'all' || s.major === selectedMajor)).length
  }));

  const statuses = Array.from(new Set(allStudentData.map(s => s.business_type || '아니오').filter(Boolean))).sort().map(st => ({
    label: st, value: st, count: allStudentData.filter(s => (s.business_type || '아니오') === st && (selectedMajor === 'all' || s.major === selectedMajor) && (selectedClass === 'all' || s.class_info === selectedClass)).length
  }));

  // 최종 데이터 필터링 (학과/반/상태)
  const filteredData = allStudentData.filter(student => {
    const majorMatch = !params.major || params.major === 'all' || student.major === params.major;
    const classMatch = !params.class || params.class === 'all' || student.class_info === params.class;
    const statusMatch = !params.status || params.status === 'all' || (student.business_type || '아니오') === params.status;
    return majorMatch && classMatch && statusMatch;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] sm:h-[calc(100vh-95px)] overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between shrink-0 mb-3 sm:mb-5 px-1">
        <div className="flex flex-col sm:flex-row sm:items-center flex-1 w-full">
          <div className="flex flex-col mb-3 sm:mb-0">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Users className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              학생 취업 현황
              <span className="text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">3학년 통합관리</span>
            </h2>
            <div className="flex flex-col gap-0.5 text-muted-foreground text-[10px] sm:text-xs font-medium leading-relaxed">
              <p>졸업 예정자들의 취업 이력과 현장실습 데이터를 통합 관리합니다.</p>
              <p className="text-blue-600 font-bold">
                {parseInt(selectedYear) - 1}학년도 3학년 {params.major && params.major !== 'all' ? `${params.major} ` : '전체 학과 '}
                {params.class && params.class !== 'all' ? `${params.class}반 ` : ''}
                총 {filteredData.length}명 조회 중
              </p>
            </div>
          </div>
          
          <div className="bg-slate-100/50 p-1 rounded-xl border border-slate-200 w-full sm:w-auto sm:ml-auto flex-shrink-0">
            <DashboardFilters 
              graduationYears={graduationYears}
              majors={majors}
              classes={classes}
              statuses={statuses}
              defaultYear={defaultGradYear}
              baseUrl="/students"
              baseYear={settings.baseYear}
              hideGrade={true}
            />
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 shadow-sm border bg-white flex flex-col rounded-xl overflow-hidden min-w-full mb-0">
        <CardContent className="flex-1 overflow-auto p-0 relative">
          <div className="min-w-max h-full">
            <StudentTable 
              initialData={filteredData} 
              isAdmin={isAdmin} 
              masterCertificates={masterCertificates} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
