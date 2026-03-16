import {
  getFilteredStudentData,
  getGraduationYears,
  MAJOR_SORT_ORDER,
  getCurrentUserProfile,
} from '@/lib/data';
import { LayoutDashboard } from 'lucide-react';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import Grade3View from '@/components/dashboard/grade3-view';
import LowerGradeView from '@/components/dashboard/lower-grade-view';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  // 1. 기반 설정 및 사용자 프로필 패칭
  const [graduationYears, settings, profile] = await Promise.all([
    getGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile()
  ]);

  // 지능형 초기 학년 설정 (Smart Default)
  const defaultGrade = profile?.assigned_grade || 3;
  const currentGradeParam = params.grade;
  const currentAYParam = params.ay;

  // 초기 진입 시(파라미터 부재 시) 사용자 맞춤형으로 리다이렉트
  if (!currentGradeParam || !currentAYParam) {
    const targetGrade = currentGradeParam || defaultGrade;
    const targetAY = currentAYParam || settings.baseYear;
    redirect(`/dashboard?grade=${targetGrade}&ay=${targetAY}`);
  }

  const ay = parseInt(currentAYParam);
  const grade = parseInt(currentGradeParam);
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정
  const selectedYear = params.year || calculatedGradYear;
  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';
  const selectedStatus = params.status || 'all';

  // 2. 타겟 데이터 패칭
  const allData = await getFilteredStudentData(selectedYear);

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
        const status = student.business_type || '아니오';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        // 최종 필터링 데이터
        if (selectedStatus === 'all' || (student.business_type || '아니오') === selectedStatus) {
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
      if (s.business_type === '예') employedStudents++;
      if (s.business_type === '제외인정자') excludingStudents++;
      if (s.has_field_training === 'O') trainingStudents++;
      if (['대기업', '공기업', '공무원'].includes(s.company_type || '')) majorCompanyStudents++;
    }
  }

  const analysisTargetCount = filteredData.length - excludingStudents;
  const employmentRate = analysisTargetCount > 0 ? (employedStudents / analysisTargetCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full gap-4 lg:gap-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between shrink-0 gap-4 px-1">
        <div className="flex flex-col gap-1 min-w-0 items-start">
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <LayoutDashboard className="h-7 w-7 lg:h-8 lg:w-8 text-indigo-600 shrink-0" />
            종합 통계 대시보드
          </h2>
          <div className="flex flex-col gap-0.5 text-muted-foreground text-[10px] lg:text-xs font-medium leading-relaxed items-start">
            <p className="whitespace-nowrap">학교 전체의 진로 및 취업 현황을 실시간 통계로 분석합니다.</p>
            <p className="text-indigo-600 font-bold whitespace-nowrap">
              {ay}학년도 {grade}학년 {selectedMajor !== 'all' ? `${selectedMajor} ` : '전체 학과 '}
              {selectedClass !== 'all' ? `${selectedClass}반 ` : ''}
              분석 결과
            </p>
          </div>
        </div>
        <div className="shrink-0 xl:scale-100 origin-left xl:origin-bottom-right overflow-x-auto w-full xl:w-auto">
          <div className="flex justify-start xl:justify-end">
            <DashboardFilters 
              graduationYears={graduationYears} 
              majors={majors} 
              classes={classes} 
              statuses={statuses} 
              defaultYear={selectedYear}
              baseYear={settings.baseYear}
              hideGrade={false}
            />
          </div>
        </div>
      </div>

      {/* 학년별 조건부 뷰 전환 */}
      {grade === 3 ? (
        <Grade3View 
          filteredData={filteredData}
          selectedMajor={selectedMajor}
          employmentRate={employmentRate}
          employedStudents={employedStudents}
          excludingStudents={excludingStudents}
          trainingStudents={trainingStudents}
          majorCompanyStudents={majorCompanyStudents}
          grade={grade}
        />
      ) : (
        <LowerGradeView 
          filteredData={filteredData}
          selectedMajor={selectedMajor}
          grade={grade}
        />
      )}
    </div>
  );
}
