import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCachedFilteredStudentData, getCachedGraduationYears, MAJOR_SORT_ORDER, getCachedYearlyRankingsSummary, getCurrentUserProfile } from '@/lib/data';
import { Users } from 'lucide-react';
import { StudentTable } from './student-table';
import { redirect } from 'next/navigation';
import { getCachedMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';

import DashboardFilters from '@/components/dashboard/dashboard-filters';
import React from 'react';

import { TableLoadingSkeleton } from '@/components/dashboard/loading-skeleton';

export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  return <StudentsPageContent searchParams={params} />;
}

async function StudentsPageContent({
  searchParams,
}: {
  searchParams: { year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;

  // 1. 기반 설정 및 사용자 프로필 패칭 (캐시 적용)
  const [settings, graduationYears, masterCertificates, userProfile] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
    getCachedMasterCertificates(),
    getCurrentUserProfile()
  ]);


  if (!userProfile) {
    redirect('/login');
  }

  const isAdmin = userProfile.role === 'admin';
  const isTeacher = userProfile.role === 'teacher';

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;

  // 2. 타겟 학생 데이터 패칭 (서버 메모리 캐시 적용)
  const rawStudentData = await getCachedFilteredStudentData(selectedYear, ay);
  const rankingMap = {}; // 클라이언트 백그라운드 비동기 로딩으로 전환

  
  let allStudentData = rawStudentData;

  // 교직원일 경우 본인 담당 학반 데이터만 추출 (관리자는 전체)
  if (isTeacher && userProfile.assigned_year) {
    allStudentData = allStudentData.filter(s => 
      s.graduation_year === userProfile.assigned_year &&
      s.major === userProfile.assigned_major &&
      s.class_info === userProfile.assigned_class
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
    <div className="flex flex-col h-full gap-2 sm:gap-2.5 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between shrink-0 px-1 gap-2 sm:gap-3">
        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 shrink-0" />
            학생 취업 현황
            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">{grade}학년 데이터</span>
          </h2>
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-medium">
            <p className="hidden sm:block text-slate-500">졸업 예정자 취업 이력 및 현장실습 통합 데이터</p>
            <span className="hidden sm:inline text-slate-300">|</span>
            <p className="text-blue-600 font-bold whitespace-nowrap">
              {parseInt(selectedYear) - 1}학년도 {grade}학년 {params.major && params.major !== 'all' ? `${params.major} ` : '전체 학과 '}
              {params.class && params.class !== 'all' ? `${params.class}반 ` : ''}
              (총 {filteredData.length}명)
            </p>
          </div>
        </div>
        
        <div className="shrink-0 overflow-x-auto w-full lg:w-auto">
          <div className="flex justify-start lg:justify-end">
            <React.Suspense fallback={<div className="h-10 w-[450px] bg-slate-50 animate-pulse rounded-lg" />}>
              <DashboardFilters 
                graduationYears={graduationYears}
                majors={majors}
                classes={classes}
                statuses={statuses}
                defaultYear={defaultGradYear}
                baseUrl="/students"
                baseYear={settings.baseYear}
                hideGrade={false}
                hideStatus={true}
              />
            </React.Suspense>
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 shadow-sm border bg-white flex flex-col rounded-xl overflow-hidden min-w-full mb-0">
        <CardContent className="flex-1 overflow-hidden p-0 relative flex flex-col min-h-0">
          <div className="w-full h-full flex flex-col min-h-0">
            <StudentTable 
              initialData={filteredData} 
              isAdmin={isAdmin} 
              masterCertificates={masterCertificates} 
              rankingMap={rankingMap}
              userProfile={userProfile}
              baseYear={ay}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
