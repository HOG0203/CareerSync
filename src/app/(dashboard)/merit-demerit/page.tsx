import {
  getCurrentUserProfile,
  getCachedClassStructureCombinations,
  MAJOR_SORT_ORDER,
} from '@/lib/data';
import { getSystemSettings, getCachedMeritDemeritRules } from '@/app/(dashboard)/admin/settings/actions';
import { getAllGradesMeritDemeritSummary } from './actions';
import { MeritDemeritClient } from './merit-demerit-client';
import { Scale } from 'lucide-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 학생 상벌점 관리 메인 페이지 (서버 컴포넌트 - 1회 동시 병렬 패칭)
 */
export default async function MeritDemeritPage() {
  const settings = await getSystemSettings();

  // 1-Shot 동시 병렬 패칭 (유저 프로필, 학급 구조, 상벌점 기준, 1/2/3학년 전교생 데이터)
  const [userProfile, allCombinations, meritRules, allGradesData] = await Promise.all([
    getCurrentUserProfile(),
    getCachedClassStructureCombinations(),
    getCachedMeritDemeritRules(),
    getAllGradesMeritDemeritSummary(settings.baseYear),
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  // 학년별 학급 구조 조립
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

  const availableGrades = [1, 2, 3];
  const defaultGrade = userProfile.assigned_grade || 3;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4">
      {/* 타이틀 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Scale className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 shrink-0" />
            학생 상벌점 관리
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            시스템 설정에 등록된 기준에 따라 학생들에게 상점 및 벌점을 부여하고 누계 현황을 관리합니다.
          </p>
        </div>
      </div>

      {/* 메인 클라이언트 대시보드 */}
      <MeritDemeritClient
        initialGrade={'ALL'}
        initialGradeDataMap={allGradesData}
        availableGrades={availableGrades}
        classStructure={classStructure}
        baseYear={settings.baseYear}
        userProfile={userProfile}
        meritRules={meritRules}
      />
    </div>
  );
}