import { 
  getCachedAssignedStudentDetails,
  getCachedGraduationYears, 
  getCachedClassStructureCombinations, 
  MAJOR_SORT_ORDER, 
  getCurrentUserProfile 
} from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { FieldTrainingClient } from './field-training-client';
import AdminClassSelector from '../class-management/admin-class-selector';
import { CalendarCheck, ShieldAlert } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 현장실습현황 메인 페이지 (서버 컴포넌트)
 */
export default async function FieldTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; major?: string; class?: string }>;
}) {
  const params = await searchParams;
  return <FieldTrainingPageContent searchParams={params} />;
}

async function FieldTrainingPageContent({
  searchParams,
}: {
  searchParams: { grade?: string; major?: string; class?: string };
}) {
  const params = searchParams;

  // 1. 공통 데이터 및 학급 구조 1회 완전 동시 병렬 패칭 (서버 메모리 캐시)
  const [settings, graduationYears, masterCertificates, userProfile, allCombinations] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
    getCachedMasterCertificates(),
    getCurrentUserProfile(),
    getCachedClassStructureCombinations()
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  // 1, 2학년 담임교사는 현장실습현황 접근 불가 (3학년 담임 및 관리자만 접근 허용)
  if (userProfile.role === 'teacher' && (userProfile.assigned_grade === 1 || userProfile.assigned_grade === 2)) {
    redirect('/class-management');
  }

  const isAdmin = userProfile.role === 'admin';

  const classStructure: Record<number, Record<string, string[]>> = {};
  if (allCombinations && allCombinations.length > 0) {
    allCombinations.forEach((item: any) => {
      const g = 4 - (item.graduation_year - settings.baseYear);
      if (g >= 1 && g <= 3) {
        if (!classStructure[g]) classStructure[g] = {};
        const major = item.major;
        if (!classStructure[g][major]) classStructure[g][major] = [];
        if (!classStructure[g][major].includes(item.class_info)) {
          classStructure[g][major].push(item.class_info);
        }
      }
    });

    Object.keys(classStructure).forEach((gStr) => {
      const g = parseInt(gStr);
      const majorsObj = classStructure[g];
      const sortedMajors: Record<string, string[]> = {};
      
      const sortedMajorNames = Object.keys(majorsObj).sort((a, b) => {
        const indexA = MAJOR_SORT_ORDER.indexOf(a);
        const indexB = MAJOR_SORT_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      sortedMajorNames.forEach((majorName) => {
        sortedMajors[majorName] = majorsObj[majorName].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
      });
      classStructure[g] = sortedMajors;
    });
  }


  // 2. 학년 옵션 계산
  const availableGradesSet = new Set<number>();
  const gradeToYearMap = new Map<number, number>();

  graduationYears.forEach(gradYear => {
    const calculatedGrade = 4 - (gradYear - settings.baseYear);
    if (calculatedGrade >= 1 && calculatedGrade <= 3) {
      availableGradesSet.add(calculatedGrade);
      gradeToYearMap.set(calculatedGrade, gradYear);
    }
  });

  const availableGrades = Array.from(availableGradesSet).sort((a, b) => b - a);
  const defaultGrade = userProfile?.assigned_grade || (availableGrades.includes(3) ? 3 : availableGrades[0] || 3);
  const selectedGrade = isAdmin 
    ? (params.grade ? parseInt(params.grade) : defaultGrade)
    : defaultGrade;

  const calculatedYear = isAdmin 
    ? (gradeToYearMap.get(selectedGrade) || settings.baseYear + (4 - selectedGrade))
    : (userProfile?.assigned_year || settings.baseYear + (4 - selectedGrade));

  // 3. 해당 학학년도 학과 및 반 추출
  const targetMajor = isAdmin 
    ? (params.major || '자동화기계과')
    : (userProfile?.assigned_major || '자동화기계과');

  const targetClass = isAdmin 
    ? (params.class || '1')
    : (userProfile?.assigned_class || '1');

  // 4. 학반 학생 상세 실습 데이터 패칭
  const isViewable = !!(targetMajor && targetClass);
  let studentData: any[] = [];

  if (isViewable) {
    studentData = await getCachedAssignedStudentDetails(targetMajor, targetClass, calculatedYear, settings.baseYear);
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* 타이틀 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <CalendarCheck className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600 shrink-0" />
            현장실습현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed break-keep">
            {isAdmin ? '관리자 권한으로 전교생 학반의 현장실습 일정을 시각적으로 점검합니다.' : '담당 학반 학생들의 현장실습 일정, 지원금 신청 및 채용전환/복교 상태를 그래픽 타임라인으로 관리합니다.'}
          </p>
        </div>
      </div>

      {/* 학반 선택 셀렉터 (관리자) */}
      <div className="shrink-0">
        <AdminClassSelector 
          availableGrades={availableGrades}
          isAdmin={isAdmin}
          classStructure={classStructure}
          defaultGrade={selectedGrade}
          defaultMajor={targetMajor}
          defaultClass={targetClass}
          baseUrl="/field-training"
        />
      </div>

      {/* 메인 실습 뷰 */}
      {isViewable ? (
        <div className="flex flex-col">
          <FieldTrainingClient 
            initialStudents={studentData}
            baseYear={settings.baseYear}
            userProfile={userProfile}
            selectedGrade={selectedGrade}
            targetMajor={targetMajor}
            targetClass={targetClass}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/30">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">담당 학반 미지정</h3>
          <p className="text-sm text-muted-foreground mt-1 text-center px-6 text-balance">
            교직원 계정의 경우 사용자 관리 페이지에서 담당 학반 정보가 설정되어야 이용 가능합니다.
          </p>
        </div>
      )}
    </div>
  );
}
