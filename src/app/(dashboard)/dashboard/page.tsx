import {
  getDashboardStudentData,
  getCachedGraduationYears,
  MAJOR_SORT_ORDER,
  getCurrentUserProfile,
} from '@/lib/data';
import { LayoutDashboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import DashboardViewWrapper from '@/components/dashboard/dashboard-view-wrapper';
import { getSystemSettings, getDashboardChartLayout } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  // 1. 기반 설정 및 사용자 프로필 패칭 (서버 캐시 적용)
  const [graduationYears, settings, profile, chartLayout] = await Promise.all([
    getCachedGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile(),
    getDashboardChartLayout()
  ]);

  const isAdmin = profile?.role === 'admin';

  if (profile?.role === 'student') {
    redirect('/student/certification');
  }


  // 지능형 초기 학년 및 학사학년도 설정 (In-Memory Default Fallback - 2중 HTTP 딜레이 제거)
  const defaultGrade = profile?.assigned_grade || 3;
  const grade = params.grade ? parseInt(params.grade) : defaultGrade;
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;

  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정
  const selectedYear = params.year || calculatedGradYear;
  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';
  const selectedStatus = params.status || 'all';

  // 2. 타겟 데이터 패칭 (완전한 페이징 및 학적이력 포함 데이터 로드)
  const allData = await getDashboardStudentData(selectedYear, ay);

  // 3. 필터링 로직 최적화: 한 번의 순회로 필요한 데이터 및 카운트 추출
  const majorCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const filteredData: typeof allData = [];

  for (const student of allData) {
    // 학과 카운트
    const major = student.major || '미지정';
    majorCounts[major] = (majorCounts[major] || 0) + 1;

    // 현재 선택된 학과에 해당하는 반 카운트
    if (selectedMajor === 'all' || student.major === selectedMajor) {
      const cInfo = student.class_info || '미지정';
      classCounts[cInfo] = (classCounts[cInfo] || 0) + 1;
      
      // 현재 선택된 반까지 만족하는 상태 카운트
      if (selectedClass === 'all' || student.class_info === selectedClass) {
        const status = student.business_type || '미결정';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // 최종 필터링 데이터
        if (selectedStatus === 'all' || (student.business_type || '미결정') === selectedStatus) {
          filteredData.push(student);
        }
      }
    }
  }

  // 필터 드롭다운 옵션 구성
  const majors = Object.entries(majorCounts)
    .sort(([a], [b]) => {
      const indexA = MAJOR_SORT_ORDER.indexOf(a);
      const indexB = MAJOR_SORT_ORDER.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
    .map(([m, count]) => ({ label: m, value: m, count }));

  const classes = Object.entries(classCounts).sort(([a], [b]) => a.localeCompare(b)).map(([c, count]) => ({ label: c, value: c, count }));
  const statuses = Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([s, count]) => ({ label: s, value: s, count }));

  // 3학년용 추가 집계
  let employedStudents = 0;
  let excludingStudents = 0;
  let trainingStudents = 0;
  let majorCompanyStudents = 0;

  if (grade === 3) {
    for (const s of filteredData) {
      if (s.business_type === '취업') employedStudents++;
      if (s.business_type === '제외인정자') excludingStudents++;
      if (s.has_field_training === 'O' || s.business_type === '현장실습중') trainingStudents++;
      // [수정] 취업 상태가 '취업'인 경우에만 주요 기업으로 카운트
      if (s.business_type === '취업' && ['대기업', '공기업', '공무원'].includes(s.company_type || '')) majorCompanyStudents++;
    }
  }

  const analysisTargetCount = filteredData.length - excludingStudents;
  const employmentRate = analysisTargetCount > 0 ? (employedStudents / analysisTargetCount) * 100 : 0;

  return (
    <div className="flex flex-col h-auto min-h-full max-h-none overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden gap-2.5 pb-12 lg:pb-0">
      {/* 1. 상단 타이틀 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
              <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
            </div>
            종합 통계 대시보드
            <span className="text-[11px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              {ay}학년도 {grade}학년 분석
            </span>
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            전교생 진로 희망, 취업률 및 현장실습/도제OJT 지표를 실시간으로 분석합니다.
            {selectedMajor !== 'all' && (
              <span className="ml-1.5 font-bold text-indigo-600">[{selectedMajor}]</span>
            )}
            {selectedClass !== 'all' && (
              <span className="ml-1 font-bold text-indigo-600">[{selectedClass}반]</span>
            )}
          </p>
        </div>
      </div>

      {/* 2. 모던 통합 필터 툴바 (class-management 스타일) */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between flex-wrap">
            <React.Suspense fallback={<div className="h-9 w-[450px] bg-slate-50 animate-pulse rounded-xl" />}>
              <DashboardFilters 
                graduationYears={graduationYears} 
                majors={majors} 
                classes={classes} 
                statuses={statuses} 
                defaultYear={selectedYear}
                baseYear={settings.baseYear}
                hideGrade={false}
                hideStatus={true}
                defaultGrade={defaultGrade}
              />
            </React.Suspense>
          </div>
        </CardContent>
      </Card>

      {/* 학년별 조건부 뷰 전환 */}
      <DashboardViewWrapper
        filteredData={filteredData}
        selectedMajor={selectedMajor}
        employmentRate={employmentRate}
        employedStudents={employedStudents}
        excludingStudents={excludingStudents}
        trainingStudents={trainingStudents}
        majorCompanyStudents={majorCompanyStudents}
        grade={grade}
        isAdmin={isAdmin}
        chartLayout={chartLayout}
      />
    </div>
  );
}
