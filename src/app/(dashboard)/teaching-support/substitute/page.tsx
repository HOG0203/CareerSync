// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/page.tsx
// 결보강 및 수업 교체 관리 시스템 메인 페이지 (초고속 캐싱 및 병렬 로딩 적용)
// ==============================================================================

import { Suspense } from 'react';
import { getCurrentUserProfile } from '@/lib/data';
import { getSubstitutePageData } from './actions';
import { SubstituteClient } from './substitute-client';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { Loader2 } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '수업 결보강 및 교체 관리 | 교수학습지원',
  description: '스마트 공강 교사 추천, 3중 충돌 검증, 공식 신청서 A4 자동 생성 및 결보강 대장',
};

const fallbackTimetableData: ParsedTimetableResult = {
  title: '2026학년도 2학기 전체교사시간표',
  academicYear: 2026,
  semester: 2,
  effectiveDate: '',
  teachers: [],
  classes: [],
  totalTeachers: 0,
  totalClasses: 0,
  totalSlots: 0,
  allSlots: [],
};

export default async function SubstitutePage() {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile || userProfile.role === 'student') {
    redirect('/dashboard');
  }

  const currentUserFullName = userProfile.full_name || '';
  const currentUsername = userProfile.username || '';

  // 병렬 패칭 및 캐시 활용 (0ms~단시간 응답)
  const { initialApplications, timetableData, initialCalendarConfig } = await getSubstitutePageData();

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pb-20 sm:pb-16 min-h-full print:p-0 print:m-0 print:pb-0 print:block print:min-h-0">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }>
        <SubstituteClient
          initialApplications={initialApplications}
          timetableData={timetableData || fallbackTimetableData}
          initialCalendarConfig={initialCalendarConfig}
          currentUserFullName={currentUserFullName}
          currentUsername={currentUsername}
        />
      </Suspense>
    </div>
  );
}
