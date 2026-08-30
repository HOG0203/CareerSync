// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/page.tsx
// 결보강 및 수업 교체 관리 시스템 메인 페이지 (Mode C: natural outer scroll)
// ==============================================================================

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { 
  getSubstituteApplications, 
  getTimetableForSubstitute, 
  getAcademicCalendarConfig 
} from './actions';
import { SubstituteClient } from './substitute-client';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { Loader2 } from 'lucide-react';
import { checkTeachingSupportPermission } from '@/lib/permissions';
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
  const hasAccess = await checkTeachingSupportPermission('/teaching-support/substitute');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentUserFullName = '';
  let currentUsername = '';

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', user.id)
      .maybeSingle();

    currentUserFullName = profile?.full_name || '';
    currentUsername = profile?.username || '';
  }

  // 데이터 로드
  const [appsRes, timetableRes, calendarRes] = await Promise.all([
    getSubstituteApplications(),
    getTimetableForSubstitute(),
    getAcademicCalendarConfig(),
  ]);

  const initialApplications = appsRes.success ? appsRes.data : [];
  const timetableData = timetableRes.success && timetableRes.data ? timetableRes.data : fallbackTimetableData;
  const initialCalendarConfig = calendarRes.success ? calendarRes.data : undefined;

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pb-20 sm:pb-16 min-h-full">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }>
        <SubstituteClient
          initialApplications={initialApplications}
          timetableData={timetableData}
          initialCalendarConfig={initialCalendarConfig}
          currentUserFullName={currentUserFullName}
          currentUsername={currentUsername}
        />
      </Suspense>
    </div>
  );
}
