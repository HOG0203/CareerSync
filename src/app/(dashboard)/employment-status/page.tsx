import { Metadata } from 'next';
import { getFilteredStudentData, getGraduationYears, StudentEmploymentData, getYearlyRankingsSummary, getCurrentUserProfile } from '@/lib/data';
import EmploymentStatusFilters from './employment-status-filters';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { Grid3X3 } from 'lucide-react';
import { EmploymentStatusGrid } from './employment-status-grid';

export const metadata: Metadata = {
  title: '취업상세현황 | CareerSync',
  description: '반별/학생별 취업 현황 그리드뷰',
};

// ... (getCompanyTypeVariant, getShortClassName, MAJOR_MAP, SORT_ORDER remain same)

export const dynamic = 'force-dynamic';

export default async function EmploymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  const [graduationYears, settings, userProfile] = await Promise.all([
    getGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile()
  ]);

  // 담임 교사인 경우 해당 학년의 '3학년 시점' 학사학년도를 기본값으로 설정
  let defaultAY = settings.baseYear;
  if (userProfile?.role === 'teacher' && userProfile.assigned_grade) {
    // 3학년 담임 -> 현재 학사학년도 (예: 2026)
    // 2학년 담임 -> 다음 학사학년도 (예: 2027)
    // 1학년 담임 -> 다다음 학사학년도 (예: 2028)
    defaultAY = settings.baseYear + (3 - userProfile.assigned_grade);
  }

  const ay = params.ay ? parseInt(params.ay) : defaultAY;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();
  const selectedYear = params.year || calculatedGradYear;

  const [allData, rankingMap] = await Promise.all([
    getFilteredStudentData(selectedYear),
    getYearlyRankingsSummary(parseInt(selectedYear), settings.baseYear)
  ]);

  const displayAY = ay;

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between shrink-0 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Grid3X3 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            취업상세현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="text-blue-600 font-bold">{displayAY}학년도 {grade}학년</span> 취업 및 현장실습 현황
          </p>
        </div>
        
        <div className="flex flex-col items-start sm:items-end gap-3 sm:gap-2">
          <div className="shrink-0 scale-90 sm:scale-100 origin-left sm:origin-right">
            <EmploymentStatusFilters 
              graduationYears={graduationYears} 
              defaultYear={calculatedGradYear}
              baseYear={settings.baseYear}
              initialAY={ay.toString()}
            />
          </div>
          
          <div className="grid grid-cols-3 xs:grid-cols-3 sm:flex gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-1.5 text-[9px] sm:text-[10px] font-medium pt-2 sm:pt-0 border-t sm:border-none w-full sm:w-auto justify-between sm:justify-end">
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
        </div>
      </div>

      {/* 클라이언트 컴포넌트로 데이터 전달하여 즉시 검색 구현 */}
      <EmploymentStatusGrid 
        allData={allData}
        rankingMap={rankingMap}
        userProfile={userProfile}
      />
    </div>
  );
}
