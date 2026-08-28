import { getCachedAssignedStudentDetails, getCachedGraduationYears, getCachedFilteredStudentData, getCachedClassStructureCombinations, getCurrentUserProfile, getCachedRegisteredCompanies } from '@/lib/data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClassTable } from './class-table';
import { ShieldAlert, BookUser, Users } from 'lucide-react';
import AdminClassSelector from './admin-class-selector';
import { getCachedMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getMajorOrderIndex } from '@/lib/student-utils';
import { Suspense } from 'react';
import { TableLoadingSkeleton } from '@/components/dashboard/loading-skeleton';


export const dynamic = 'force-dynamic';

/**
 * 학반 관리 메인 페이지 (서버 컴포넌트)
 * Suspense와 Key를 활용하여 필터 변경 시 스켈레톤 노출 보장
 */
export default async function ClassManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; major?: string; class?: string }>;
}) {
  const params = await searchParams;
  return <ClassManagementPageContent searchParams={params} />;
}

async function ClassManagementPageContent({
  searchParams,
}: {
  searchParams: { grade?: string; major?: string; class?: string };
}) {
  const params = searchParams;
  
  // 1. 기반 공통 데이터 및 학급 구조 1회 동시 병렬 패칭 (서버 메모리 캐시 적용)
  const [settings, graduationYears, masterCertificates, masterCompanies, userProfile, allCombinations] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
    getCachedMasterCertificates(),
    getCachedRegisteredCompanies(),
    getCurrentUserProfile(),
    getCachedClassStructureCombinations()
  ]);

  if (!userProfile) return null;

  const isAdmin = userProfile.role === 'admin';

  // 2. 학년별 학과 및 반 구조 전체 매핑 (0ms 계산)
  const classStructure: Record<number, Record<string, string[]>> = {};
  if (allCombinations.length > 0) {
    allCombinations.forEach((item: any) => {
      const g = 4 - (item.graduation_year - settings.baseYear);
      if (g >= 1 && g <= 3) {
        if (!classStructure[g]) {
          classStructure[g] = {};
        }
        const major = item.major;
        if (!classStructure[g][major]) {
          classStructure[g][major] = [];
        }
        if (!classStructure[g][major].includes(item.class_info)) {
          classStructure[g][major].push(item.class_info);
        }
      }
    });

    // 학과 및 반 정렬 적용
    Object.keys(classStructure).forEach((gStr) => {
      const g = parseInt(gStr);
      const majorsObj = classStructure[g];
      const sortedMajors: Record<string, string[]> = {};
      
      const sortedMajorNames = Object.keys(majorsObj).sort((a, b) => {
        const orderA = getMajorOrderIndex(a);
        const orderB = getMajorOrderIndex(b);
        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b, 'ko');
      });

      sortedMajorNames.forEach((majorName) => {
        sortedMajors[majorName] = (majorsObj[majorName] || []).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
      });
      classStructure[g] = sortedMajors;
    });
  }

  // 3. 학년 옵션 계산 (졸업연도 목록 기반 역산)
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

  // 4. 학급 구조에서 학과 및 반 목록 즉시 도출 (300명 전교생 무거운 쿼리 완전 제거)
  const gradeMajorsObj = classStructure[selectedGrade] || {};
  const availableMajors = Object.keys(gradeMajorsObj);

  const targetMajor = isAdmin 
    ? (params.major && availableMajors.includes(params.major) ? params.major : (availableMajors[0] || null))
    : (userProfile?.assigned_major || null);

  const availableClasses = targetMajor ? (gradeMajorsObj[targetMajor] || []) : [];

  const targetClass = isAdmin 
    ? (params.class && availableClasses.includes(params.class) ? params.class : (availableClasses[0] || null))
    : (userProfile?.assigned_class || null);

  // --- 5. 해당 학반(20~25명) 학생 상세 데이터만 초고속 핀포인트 패칭 (인메모리 캐시 적용) ---
  const isViewable = !!(targetMajor && targetClass);
  let studentData: any[] = [];

  if (isViewable) {
    const rawData = await getCachedAssignedStudentDetails(targetMajor!, targetClass!, calculatedYear, settings.baseYear);
    // 학생 번호 자연어 숫자 정렬 (1번 -> 2번 -> ... -> 9번 -> 10번 -> 11번)
    studentData = [...(rawData || [])].sort((a, b) => {
      const numA = parseInt((a.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt((b.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
    });
  }

  const displayClass = targetClass && !targetClass.includes('-') ? `${selectedGrade}-${targetClass}` : targetClass;


  return (
    <div className="flex flex-col h-full gap-5">
      {/* 상단 타이틀 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookUser className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            학반 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            {isAdmin ? '관리자 권한으로 전교생 학반의 진로희망 및 세부 코스를 조회·수정합니다.' : '담당 학반 학생들의 진로희망, 희망기업, 세부코스 및 연락처를 관리합니다.'}
          </p>
        </div>
      </div>

      {/* 학반 선택기 (드롭다운 필터 바) */}
      <div className="shrink-0">
        <AdminClassSelector 
          availableGrades={availableGrades}
          isAdmin={isAdmin}
          classStructure={classStructure}
          defaultGrade={selectedGrade}
          defaultMajor={targetMajor || ''}
          defaultClass={targetClass || ''}
        />
      </div>

      {isViewable ? (
        <ClassTable 
          initialData={studentData} 
          masterCertificates={masterCertificates} 
          masterCompanies={masterCompanies}
          userProfile={userProfile}
          baseYear={settings.baseYear}
          graduationYear={calculatedYear}
          targetMajor={targetMajor || ''}
          displayClass={displayClass || ''}
          selectedGrade={selectedGrade}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/30">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">담당 학반 미지정</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 text-center px-6 leading-relaxed max-w-md">
            교직원 계정의 경우 사용자 관리 페이지에서 담당 학반 정보가 설정되어야 이용 가능합니다.<br/>
            담당 정보가 설정되었음에도 이 화면이 보인다면 관리자에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
}

