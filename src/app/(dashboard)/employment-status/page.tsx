import { Metadata } from 'next';
import { getCachedFilteredStudentData, getCachedGraduationYears, getCachedTeacherProfiles, getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { Grid3X3 } from 'lucide-react';
import { EmploymentStatusHubClient } from './employment-status-hub-client';
import React from 'react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  let grade = params.grade ? parseInt(params.grade) : 3;
  if (!params.grade) {
    const userProfile = await getCurrentUserProfile();
    if (userProfile?.assigned_grade && userProfile.assigned_grade >= 1 && userProfile.assigned_grade <= 3) {
      grade = userProfile.assigned_grade;
    }
  }
  const title = grade === 1 || grade === 2 ? '진로상세현황' : '취업상세현황';
  return {
    title: `${title} | CareerSync`,
    description: grade === 1 || grade === 2 ? '반별/학생별 진로 희망 현황 그리드뷰' : '반별/학생별 취업 현황 그리드뷰',
  };
}

export default async function EmploymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  return <EmploymentStatusPageContent searchParams={params} />;
}

async function EmploymentStatusPageContent({
  searchParams,
}: {
  searchParams: { year?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;

  // 1. 기반 설정, 졸업연도, 프로필, 교사 정보를 1차 병렬 로드
  const [graduationYears, settings, userProfile, teacherProfiles] = await Promise.all([
    getCachedGraduationYears(),
    getSystemSettings(),
    getCurrentUserProfile(),
    getCachedTeacherProfiles(),
  ]);

  const ay = params.ay ? parseInt(params.ay) : (settings.baseYear || 2026);

  // 2. 담당교사 프로필의 담당학년(assigned_grade)을 기본값으로 동적 판별
  let defaultGrade = 3;
  if (userProfile?.assigned_grade && userProfile.assigned_grade >= 1 && userProfile.assigned_grade <= 3) {
    defaultGrade = userProfile.assigned_grade;
  } else if (userProfile?.assigned_year && settings.baseYear) {
    const calcG = 4 - (userProfile.assigned_year - settings.baseYear);
    if (calcG >= 1 && calcG <= 3) {
      defaultGrade = calcG;
    }
  }

  // URL 쿼리에 지정된 학년이 있으면 우선 적용, 없으면 교사의 담당학년 기본 적용
  const grade = params.grade ? parseInt(params.grade) : defaultGrade;
  const defaultGradYear = (ay + (4 - grade)).toString();
  const selectedYear = params.grade 
    ? (ay + (4 - grade)).toString() 
    : (params.year || defaultGradYear);

  // 3. 결정된 졸업연도와 학사학년도 기준 학생 데이터 패칭
  const allData = await getCachedFilteredStudentData(selectedYear, ay);

  // 학사학년도 목록 산출
  const academicYears = Array.from(
    new Set([settings.baseYear, ...graduationYears.map(gy => gy - 1)])
  ).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* 상단 타이틀 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <Grid3X3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            {grade === 1 || grade === 2 ? '진로상세현황' : '취업상세현황'}
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              {ay}학년도 {grade}학년
            </span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            {grade === 1 || grade === 2 
              ? '1·2학년 학생별 진로 희망 및 진로코스 바둑판식 시각화 현황' 
              : '3학년 졸업예정자 학급별·학생별 취업 및 현장실습 바둑판식 시각화 현황'}
          </p>
        </div>
      </div>

      {/* 모던 클라이언트 허브 (통계 카드 4종 + 통합 필터 & 검색창 + 학급별 바둑판 그리드) */}
      <EmploymentStatusHubClient
        initialData={allData}
        userProfile={userProfile}
        teacherProfiles={teacherProfiles}
        baseYear={settings.baseYear}
        currentAY={ay}
        grade={grade}
        selectedYear={selectedYear}
        academicYears={academicYears}
      />
    </div>
  );
}

