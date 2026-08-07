import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCachedFilteredStudentData, getCachedGraduationYears, StudentEmploymentData, getCurrentUserProfile } from '@/lib/data';
import EmploymentStatusFilters from './employment-status-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { Grid3X3 } from 'lucide-react';
import { EmploymentStatusGrid } from './employment-status-grid';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const title = grade === 1 || grade === 2 ? '진로상세현황' : '취업상세현황';
  return {
    title: `${title} | CareerSync`,
    description: grade === 1 || grade === 2 ? '반별/학생별 진로 희망 현황 그리드뷰' : '반별/학생별 취업 현황 그리드뷰',
  };
}

import { GridLoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function EmploymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  const suspenseKey = `${params.ay || ''}-${params.grade || ''}-${params.year || ''}`;

  return (
    <React.Suspense key={suspenseKey} fallback={<GridLoadingSkeleton />}>
      <EmploymentStatusPageContent searchParams={params} />
    </React.Suspense>
  );
}

async function EmploymentStatusPageContent({
  searchParams,
}: {
  searchParams: { year?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;

  const supabase = await createClient();

  const [graduationYears, settings, userProfile, teacherProfilesRes] = await Promise.all([
    getCachedGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile(),
    supabase.from('profiles').select('username, full_name, assigned_grade, assigned_major, assigned_class').not('assigned_major', 'is', null)
  ]);

  const teacherProfiles = teacherProfilesRes?.data || [];

  // 담임 교사인 경우 해당 학년과 현재 학사학년도를 기본값으로 설정
  const defaultAY = settings.baseYear;
  let defaultGrade = 3;
  if (userProfile?.role === 'teacher' && userProfile.assigned_grade) {
    defaultGrade = userProfile.assigned_grade;
  }

  const ay = params.ay ? parseInt(params.ay) : defaultAY;
  const grade = params.grade ? parseInt(params.grade) : defaultGrade;
  const calculatedGradYear = (ay + (4 - grade)).toString();
  const selectedYear = params.year || calculatedGradYear;

  const allData = await getCachedFilteredStudentData(selectedYear, ay);


  const displayAY = ay;

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between shrink-0 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Grid3X3 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            {grade === 1 || grade === 2 ? '진로상세현황' : '취업상세현황'}
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-blue-600 font-bold">{displayAY}학년도 {grade}학년</span> {grade === 1 || grade === 2 ? '진로 희망 현황' : '취업 및 현장실습 현황'}
          </p>
        </div>
        
        <div className="flex flex-col items-start sm:items-end gap-3 sm:gap-2">
          <div className="shrink-0 scale-90 sm:scale-100 origin-left sm:origin-right">
            <EmploymentStatusFilters 
              graduationYears={graduationYears} 
              defaultYear={calculatedGradYear}
              baseYear={settings.baseYear}
              initialAY={ay.toString()}
              initialGrade={grade.toString()}
            />
          </div>
          
          {grade === 1 || grade === 2 ? (
            <div className="grid grid-cols-3 xs:grid-cols-3 sm:flex sm:flex-wrap gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-1.5 text-[9px] sm:text-[10px] font-medium pt-2 sm:pt-0 border-t sm:border-none w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-600 rounded-sm shrink-0"></div> 취업</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-rose-500 border border-rose-600 rounded-sm shrink-0"></div> 진학</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-slate-400 border border-slate-500 rounded-sm shrink-0"></div> 제외인정자</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 xs:grid-cols-3 sm:flex sm:flex-wrap gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-1.5 text-[9px] sm:text-[10px] font-medium pt-2 sm:pt-0 border-t sm:border-none w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm shrink-0"></div> 대/공기업</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-indigo-700 rounded-sm shrink-0"></div> 공무원/부사관</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-purple-600 rounded-sm shrink-0"></div> 중견기업</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm shrink-0"></div> 중소기업</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shrink-0"></div> 연계교육</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm shrink-0"></div> 기타</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-amber-100 rounded-sm shrink-0 border border-amber-500"></div> 채용진행중</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-blue-400 rounded-sm shrink-0 border border-blue-500"></div> 현장실습중</div>
              <div className="flex items-center gap-1 whitespace-nowrap"><div className="w-2.5 h-2.5 bg-emerald-100 rounded-sm shrink-0 border border-emerald-500"></div> 도제OJT</div>
            </div>
          )}
        </div>
      </div>

      {/* 클라이언트 컴포넌트인 그리드 렌더링 (석차 정보는 백그라운드 fetch 처리) */}
      <EmploymentStatusGrid 
        allData={allData}
        userProfile={userProfile}
        teacherProfiles={teacherProfiles}
        baseYear={settings.baseYear}
        grade={grade}
        graduationYear={selectedYear}
      />
    </div>
  );
}
