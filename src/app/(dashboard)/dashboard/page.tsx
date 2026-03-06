import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getFilteredStudentData,
  getGraduationYears,
  MAJOR_SORT_ORDER,
} from '@/lib/data';
import { Users, Briefcase, GraduationCap, Building2, LayoutDashboard } from 'lucide-react';
import CompanyTypeChart from '@/components/dashboard/company-type-chart';
import MajorEmploymentChart from '@/components/dashboard/major-employment-chart';
import MajorFieldTrainingChart from '@/components/dashboard/major-field-training-chart';
import ClassEmploymentChart from '@/components/dashboard/class-employment-chart';
import ClassFieldTrainingChart from '@/components/dashboard/class-field-training-chart';
import DashboardFilters from '@/components/dashboard/dashboard-filters';
import CertificateStatusChart from '@/components/dashboard/certificate-status-chart';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;

  // 1. 기반 설정 패칭 (학년도 목록 및 시스템 설정)
  const [graduationYears, settings] = await Promise.all([
    getGraduationYears(),
    getSystemSettings()
  ]);

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 기본 조회 졸업연도 결정 (신규 파라미터 우선)
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;
  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';
  const selectedStatus = params.status || 'all';

  // 2. 타겟 데이터 패칭 (해당 학년의 데이터만 DB에서 직접 필터링하여 가져옴)
  const allData = await getFilteredStudentData(selectedYear);

  // 학사학년도 표시용 (선택된 AY가 있으면 그것을 사용, 아니면 역산)
  const displayAY = params.ay ? parseInt(params.ay) : (parseInt(selectedYear) - (4 - grade));

  // 3. 필터링 로직 최적화: 한 번의 순회로 필요한 데이터 및 카운트 추출
  const majorCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const filteredData: typeof allData = [];

  // 한 번의 루프로 모든 통계와 필터링 수행
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
        
        // 최종 필터링 데이터 (카드 및 차트용)
        if (selectedStatus === 'all' || (student.business_type || '아니오') === selectedStatus) {
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

  let employedStudents = 0;
  let excludingStudents = 0; // 제외인정자 수
  let trainingStudents = 0;
  let majorCompanyStudents = 0;

  // 최종 데이터 요약 통계 (한 번 더 순회)
  for (const s of filteredData) {
    if (s.business_type === '예') employedStudents++;
    if (s.business_type === '제외인정자') excludingStudents++;
    if (s.has_field_training === 'O') trainingStudents++;
    if (['대기업', '공기업', '공무원'].includes(s.company_type || '')) majorCompanyStudents++;
  }

  // 모수: 전체 필터링된 인원 - 제외인정자
  const analysisTargetCount = filteredData.length - excludingStudents;
  const employmentRate = analysisTargetCount > 0 ? (employedStudents / analysisTargetCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-4 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600" />
            종합 통계 대시보드
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            <span className="font-bold text-indigo-600">{displayAY}학년도 3학년</span> 취업 및 현장실습 현황 분석
            {selectedMajor !== 'all' && ` • ${selectedMajor}`}
          </p>
        </div>
        <div className="shrink-0 scale-95 sm:scale-100 origin-left sm:origin-right">
          <DashboardFilters 
            graduationYears={graduationYears} 
            majors={majors} 
            classes={classes} 
            statuses={statuses} 
            defaultYear={defaultGradYear}
            baseYear={settings.baseYear}
            hideGrade={true}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-blue-50/30 border-blue-100 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-blue-900">총 학생 수</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-blue-900">{filteredData.length}명</div>
            <p className="text-[9px] sm:text-xs text-blue-700/70 mt-0.5">제외인정자 {excludingStudents}명</p>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50/30 border-emerald-100 shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-emerald-900">전체 취업률</CardTitle>
            <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-900">{employmentRate.toFixed(1)}%</div>
            <p className="text-[9px] sm:text-xs text-emerald-700/70 mt-0.5">{employedStudents}명 확정</p>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50/30 border-cyan-100 shadow-sm border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-cyan-900">현장실습</CardTitle>
            <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-cyan-900">{trainingStudents}명</div>
            <p className="text-[9px] sm:text-xs text-cyan-700/70 mt-0.5">참여 인원</p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50/30 border-indigo-100 shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-[10px] sm:text-sm font-semibold text-indigo-900">주요 기업</CardTitle>
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-lg sm:text-2xl font-bold text-indigo-900">{majorCompanyStudents}명</div>
            <p className="text-[9px] sm:text-xs text-indigo-700/70 mt-0.5">대/공기업/공직</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
         <CompanyTypeChart data={filteredData} />
         {selectedMajor !== 'all' ? (
           <ClassEmploymentChart data={filteredData} majorName={selectedMajor} />
         ) : (
           <MajorEmploymentChart data={filteredData} />
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 overflow-hidden">
         {selectedMajor !== 'all' ? (
           <ClassFieldTrainingChart data={filteredData} majorName={selectedMajor} />
         ) : (
           <MajorFieldTrainingChart data={filteredData} />
         )}
         {selectedMajor !== 'all' ? (
           <CertificateStatusChart data={filteredData} type="class" title={`${selectedMajor} 학반별 자격증 취득 현황`} />
         ) : (
           <CertificateStatusChart data={filteredData} type="major" title="학과별 자격증 취득 현황" />
         )}
      </div>
    </div>
  );
}
