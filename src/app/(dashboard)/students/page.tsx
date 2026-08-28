import { getCachedFilteredStudentData, getCachedGraduationYears, MAJOR_SORT_ORDER, getCurrentUserProfile, getCachedRegisteredCompanies } from '@/lib/data';
import { Users } from 'lucide-react';
import { StudentsHubClient } from './students-hub-client';
import { redirect } from 'next/navigation';
import { getCachedMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import React from 'react';


export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  return <StudentsPageContent searchParams={params} />;
}

async function StudentsPageContent({
  searchParams,
}: {
  searchParams: { year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;

  // 1. 학사학년도(AY)와 학년(Grade) 기반 졸업연도 사전 계산
  const ay = params.ay ? parseInt(params.ay) : 2026;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const defaultGradYear = (ay + (4 - grade)).toString();
  
  // params.grade가 명시된 경우 학년 기반으로 정확한 졸업연도 산출
  const selectedYear = params.grade 
    ? (ay + (4 - grade)).toString() 
    : (params.year || defaultGradYear);

  // 2. 기반 설정, 마스터 정보, 프로필, 학생 데이터를 완전한 1회 병렬(Promise.all)로 동시 패칭 (속도 2배 향상)
  const [settings, graduationYears, masterCertificates, masterCompanies, userProfile, rawStudentData] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
    getCachedMasterCertificates(),
    getCachedRegisteredCompanies(),
    getCurrentUserProfile(),
    getCachedFilteredStudentData(selectedYear, ay)
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  const isAdmin = userProfile.role === 'admin';
  const isTeacher = userProfile.role === 'teacher';
  const rankingMap = {};

  let allStudentData = rawStudentData;


  // 교직원일 경우 본인 담당 학반 데이터만 추출 (관리자는 전체)
  if (isTeacher && userProfile.assigned_grade) {
    const teacherGradYear = (ay + (4 - userProfile.assigned_grade)).toString();
    if (selectedYear !== teacherGradYear) {
      allStudentData = [];
    } else {
      if (userProfile.assigned_major) {
        allStudentData = allStudentData.filter(s => s.major === userProfile.assigned_major);
      }
      if (userProfile.assigned_class) {
        allStudentData = allStudentData.filter(s => s.class_info === userProfile.assigned_class);
      }
    }
  }


  // 필터 옵션 계산
  const majors = Array.from(new Set(allStudentData.map(s => s.major).filter(Boolean)))
    .sort((a, b) => {
      const indexA = MAJOR_SORT_ORDER.indexOf(a!);
      const indexB = MAJOR_SORT_ORDER.indexOf(b!);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    })
    .map(m => ({
      label: m!, value: m!, count: allStudentData.filter(s => s.major === m).length
    }));

  const selectedMajor = params.major || 'all';
  const classes = Array.from(new Set(allStudentData.filter(s => selectedMajor === 'all' || s.major === selectedMajor).map(s => s.class_info).filter(Boolean))).sort().map(c => ({
    label: c || '미지정', value: c || '미지정', count: allStudentData.filter(s => s.class_info === c && (selectedMajor === 'all' || s.major === selectedMajor)).length
  }));

  const statuses = Array.from(new Set(allStudentData.map(s => s.business_type || '아니오').filter(Boolean))).sort().map(st => ({
    label: st, value: st, count: allStudentData.filter(s => (s.business_type || '아니오') === st).length
  }));

  // 학사학년도 목록 산출
  const academicYears = Array.from(
    new Set([settings.baseYear, ...graduationYears.map(gy => gy - 1)])
  ).sort((a, b) => b - a);

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* 상단 타이틀 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            학생 취업 현황
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              {ay}학년도 {grade}학년
            </span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            졸업 예정자 취업 이력, 현장실습 진행 상태 및 자격증 통합 관리
          </p>
        </div>
      </div>


      {/* 모던 클라이언트 허브 (통계 카드 4종 + 통합 필터 & 검색창 + 엑셀식 스프레드시트 편집 시트) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <StudentsHubClient
          initialData={allStudentData}
          isAdmin={isAdmin}
          masterCertificates={masterCertificates}
          masterCompanies={masterCompanies}
          rankingMap={rankingMap}
          userProfile={userProfile}
          baseYear={settings.baseYear}
          currentAY={ay}
          grade={grade}
          selectedYear={selectedYear}
          academicYears={academicYears}
        />
      </div>
    </div>
  );
}


