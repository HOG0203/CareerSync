// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/admin/page.tsx
// 결보강 승인/관리 메인 페이지 (수업계/관리자 전용)
// ==============================================================================

import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { 
  getSubstituteApplications, 
  getTimetableForSubstitute, 
  getAcademicCalendarConfig 
} from '../actions';
import { AdminClient } from './admin-client';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { Loader2 } from 'lucide-react';
import { checkTeachingSupportPermission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '결보강 승인 및 관리 | 교수학습지원',
  description: '수업계 전용 NEIS 연계 결보강 승인, 대장 관리, 교사별 누적 시수 통계',
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

export default async function SubstituteAdminPage() {
  const hasAccess = await checkTeachingSupportPermission('/teaching-support/substitute/admin');
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
        <AdminClient
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
