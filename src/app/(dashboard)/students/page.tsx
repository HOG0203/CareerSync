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
import { getSystemSettings } from '@/app/admin/settings/actions';

import DashboardFilters from '@/components/dashboard/dashboard-filters';

export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string }>;
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
  const [settings, graduationYears] = await Promise.all([
    getSystemSettings(),
    getGraduationYears()
  ]);

  // 기본 조회 졸업연도: 학사학년도 + 1 (3학년 통합 관리 기준)
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || defaultGradYear;

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
    label: c, value: c, count: allStudentData.filter(s => s.class_info === c && (selectedMajor === 'all' || s.major === selectedMajor)).length
  }));

  const statuses = Array.from(new Set(allStudentData.filter(s => (selectedMajor === 'all' || s.major === selectedMajor) && (selectedClass === 'all' || s.class_info === selectedClass)).map(s => s.employment_status).filter(Boolean))).sort().map(st => ({
    label: st, value: st, count: allStudentData.filter(s => s.employment_status === st && (selectedMajor === 'all' || s.major === selectedMajor) && (selectedClass === 'all' || s.class_info === selectedClass)).length
  }));

  // 최종 데이터 필터링 (학과/반/상태)
  const filteredData = allStudentData.filter(student => {
    const majorMatch = !params.major || params.major === 'all' || student.major === params.major;
    const classMatch = !params.class || params.class === 'all' || student.class_info === params.class;
    const statusMatch = !params.status || params.status === 'all' || student.employment_status === params.status;
    return majorMatch && classMatch && statusMatch;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] sm:h-[calc(100vh-110px)] w-full overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 shrink-0 px-1 gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1">
          <div className="shrink-0">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2 flex-wrap sm:flex-nowrap">
              학생 취업 및 현장실습 현황
              <span className="text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">3학년 통합관리</span>
            </h2>
            <p className="text-muted-foreground text-[10px] sm:text-[11px] mt-0.5 font-medium">졸업 예정자들의 취업 이력과 현장실습 데이터를 통합 관리합니다.</p>
          </div>
          
          <div className="bg-slate-100/50 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto flex-shrink-0">
            <DashboardFilters 
              graduationYears={graduationYears}
              majors={majors}
              classes={classes}
              statuses={statuses}
              defaultYear={defaultGradYear}
              baseUrl="/students"
            />
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 shadow-sm border bg-white flex flex-col rounded-xl overflow-hidden min-w-full">
        <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b shrink-0 bg-white/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-blue-100 p-1 rounded-lg shrink-0">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-gray-900">
                {parseInt(selectedYear) - 1}학년도 3학년 데이터
              </CardTitle>
              <CardDescription className="text-[9px] sm:text-[10px] leading-tight mt-0.5">
                {params.major && params.major !== 'all' ? `${params.major} ` : '전체 학과 '}
                {params.class && params.class !== 'all' ? `${params.class}반 ` : ''}
                총 {filteredData.length}명의 데이터가 필터링되었습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0 relative">
          <div className="min-w-max h-full">
            <StudentTable initialData={filteredData} isAdmin={isAdmin} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
