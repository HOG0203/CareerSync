import { 
  getCachedGraduationYears, 
  getCachedClassStructureCombinations, 
  MAJOR_SORT_ORDER, 
  getCurrentUserProfile,
  getCachedFilteredStudentData
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { FieldTrainingClient } from './field-training-client';
import { CalendarCheck } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 현장실습현황 메인 페이지 (서버 컴포넌트)
 */
export default async function FieldTrainingPage() {
  // 1. 공통 설정 및 학급 구조 완전 동시 병렬 패칭
  const [settings, graduationYears, userProfile, allCombinations] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
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

  // 학년별 학과 및 반 구조 매핑
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

  // 3학년 (및 2, 1학년) 전체 학생 데이터 병렬 패칭
  const g3GradYear = (settings.baseYear + 1).toString();
  const g2GradYear = (settings.baseYear + 2).toString();
  const g1GradYear = (settings.baseYear + 3).toString();

  const [g3Students, g2Students, g1Students] = await Promise.all([
    getCachedFilteredStudentData(g3GradYear, settings.baseYear),
    getCachedFilteredStudentData(g2GradYear, settings.baseYear),
    getCachedFilteredStudentData(g1GradYear, settings.baseYear),
  ]);

  const allStudents = [
    ...g3Students.map(s => ({ ...s, grade: 3 })),
    ...g2Students.map(s => ({ ...s, grade: 2 })),
    ...g1Students.map(s => ({ ...s, grade: 1 })),
  ];

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* 타이틀 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <CalendarCheck className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600 shrink-0" />
            현장실습/도제OJT현황
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed break-keep">
            {isAdmin 
              ? '관리자 권한으로 전교생 및 학반별 현장실습 및 도제 OJT 일정을 시각적 간트차트로 점검합니다.' 
              : '담당 학반 학생들의 현장실습 및 도제 OJT 일정, 지원금 신청 및 채용전환/복교 상태를 그래픽 타임라인으로 관리합니다.'}
          </p>
        </div>
      </div>

      {/* 메인 실습 뷰 */}
      <FieldTrainingClient 
        initialStudents={allStudents}
        baseYear={settings.baseYear}
        userProfile={userProfile}
        availableGrades={[1, 2, 3]}
        classStructure={classStructure}
      />
    </div>
  );
}