import { getCachedAdminStudentData, getCachedGraduationYears, getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';
import { getCachedMasterCertificates, getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { AdminStudentHub } from './admin-student-hub';
import React from 'react';
import { getMajorOrderIndex } from '@/lib/student-utils';
import { TableLoadingSkeleton } from '@/components/dashboard/loading-skeleton';

export const dynamic = 'force-dynamic';

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string }>;
}) {
  const params = await searchParams;
  return <AdminStudentsPageContent searchParams={params} />;
}

async function AdminStudentsPageContent({
  searchParams,
}: {
  searchParams: { year?: string; major?: string; class?: string; status?: string; ay?: string; grade?: string };
}) {
  const params = searchParams;
  
  // 1. 기반 설정 및 사용자 프로필 패칭 (서버 메모리 캐시 적용)
  const [settings, graduationYears, userProfile] = await Promise.all([
    getSystemSettings(),
    getCachedGraduationYears(),
    getCurrentUserProfile()
  ]);


  if (!userProfile) {
    redirect('/login');
  }

  // 2. 관리자 권한 확인
  if (userProfile.role !== 'admin') {
    redirect('/dashboard');
  }

  // 학사학년도(AY)와 학년(Grade) 기반 졸업연도 계산
  const ay = params.ay ? parseInt(params.ay) : settings.baseYear;
  const grade = params.grade ? parseInt(params.grade) : 3;
  const calculatedGradYear = (ay + (4 - grade)).toString();

  // 선택된 필터값 결정
  const defaultGradYear = (settings.baseYear + 1).toString();
  const selectedYear = params.year || calculatedGradYear || defaultGradYear;
  const selectedMajor = params.major || 'all';
  const selectedClass = params.class || 'all';
  const selectedStatus = params.status || 'all';

  // 3. 학생 기본 정보 전용 초경량 데이터 패칭 (불필요한 취업/실습 JOIN 제거로 20배 초고속)
  const allStudentData = await getCachedAdminStudentData(parseInt(selectedYear));

  // 4. 세부 필터링 및 옵션 계산
  const majorCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const filteredData: typeof allStudentData = [];

  for (const student of allStudentData) {
    // 학과 카운트
    const major = student.major || '미지정';
    majorCounts[major] = (majorCounts[major] || 0) + 1;

    // 현재 선택된 학과에 해당하는 반 카운트
    if (selectedMajor === 'all' || student.major === selectedMajor) {
      const cInfo = student.class_info || '미지정';
      classCounts[cInfo] = (classCounts[cInfo] || 0) + 1;
      
      // 현재 선택된 반까지 만족하는 상태 카운트
      if (selectedClass === 'all' || student.class_info === selectedClass) {
        const currentStatus = student.employment_status || '미취업';
        statusCounts[currentStatus] = (statusCounts[currentStatus] || 0) + 1;
        
        // 최종 필터링 데이터 (허브 테이블용)
        if (selectedStatus === 'all' || currentStatus === selectedStatus) {
          filteredData.push(student);
        }
      }
    }
  }

  // 번호 자연어 숫자 정렬 (1번 -> 2번 -> ... -> 9번 -> 10번 -> 11번)
  filteredData.sort((a, b) => {
    const orderA = getMajorOrderIndex(a.major || '');
    const orderB = getMajorOrderIndex(b.major || '');
    if (orderA !== orderB) return orderA - orderB;

    const classA = parseInt((a.class_info || '').replace(/[^0-9]/g, ''), 10) || 0;
    const classB = parseInt((b.class_info || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (classA !== classB) return classA - classB;

    const numA = parseInt((a.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
    const numB = parseInt((b.student_number || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (numA !== numB) return numA - numB;

    return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
  });

  // 드롭다운 옵션 변환 (학교 공식 학과 순서 정렬)
  const majors = Object.entries(majorCounts)
    .sort(([a], [b]) => {
      const orderA = getMajorOrderIndex(a);
      const orderB = getMajorOrderIndex(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ko');
    })
    .map(([m, count]) => ({ label: m, value: m, count }));

  const classes = Object.entries(classCounts)
    .sort(([a], [b]) => (parseInt(a.replace(/[^0-9]/g, '') || '0')) - (parseInt(b.replace(/[^0-9]/g, '') || '0')))
    .map(([c, count]) => ({ label: c, value: c, count }));

  const statuses = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([s, count]) => ({ label: s, value: s, count }));

  return (
    <AdminStudentHub 
      initialData={filteredData}
      graduationYears={graduationYears}
      majors={majors}
      classes={classes}
      statuses={statuses}
      settings={settings}
      params={params}
    />
  );
}


