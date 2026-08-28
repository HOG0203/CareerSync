import {
  getDashboardStudentData,
  getGraduationYears,
  MAJOR_SORT_ORDER,
  getCurrentUserProfile,
} from '@/lib/data';
import { LayoutDashboard } from 'lucide-react';
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

  // 1. 기반 설정 및 사용자 프로필 패칭
  const [graduationYears, settings, profile, chartLayout] = await Promise.all([
    getGraduationYears(),
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

  // 2. 타겟 데이터 패칭 (대시보드 전용 슬림 쿼리 - 차트에 필요한 필드만)
  const allData = await getDashboardStudentData(selectedYear);

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
    <div className="flex flex-col gap-5 lg:gap-6">
      {/* 1. 상단 모던 헤더 & 필터 바 영역 */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between shrink-0 gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100/80 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
              {ay}학년도
            </span>
            <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {grade}학년 분석
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              대구공업고등학교 DGTHS
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <LayoutDashboard className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <span>종합 통계 대시보드</span>
          </h2>

          <p className="text-xs text-slate-500 font-medium">
            전교생 진로 희망, 취업률 및 현장실습/도제OJT 지표를 실시간으로 분석합니다.
            {selectedMajor !== 'all' && (
              <span className="ml-1.5 font-bold text-indigo-600">[{selectedMajor}]</span>
            )}
            {selectedClass !== 'all' && (
              <span className="ml-1 font-bold text-indigo-600">[{selectedClass}반]</span>
            )}
          </p>
        </div>

        <div className="shrink-0 overflow-x-auto w-full xl:w-auto pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          <div className="flex justify-start xl:justify-end">
            <React.Suspense fallback={<div className="h-10 w-[450px] bg-slate-50 animate-pulse rounded-xl" />}>
              <DashboardFilters 
                graduationYears={graduationYears} 
                majors={majors} 
                classes={classes} 
                statuses={statuses} 
                defaultYear={selectedYear}
                baseYear={settings.baseYear}
                hideGrade={false}
                defaultGrade={defaultGrade}
              />
            </React.Suspense>
          </div>
        </div>
      </div>

      {/* 학년별 조건부 뷰 전환 (로딩 스켈레톤 관리 래퍼 도입) */}
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
