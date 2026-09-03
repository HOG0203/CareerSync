import { Metadata } from 'next';
import { getCurrentUserProfile } from '@/lib/data';
import { getCachedTimetablePageData } from './actions';
import { TimetableClient } from './timetable-client';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '시간표 조회 및 관리 | 교수학습지원 | CareerSync',
  description: '교사별, 학반별 주간 시간표 조회 및 시수 관리 시스템',
};

export default async function TimetablePage() {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile || userProfile.role === 'student') {
    redirect('/dashboard');
  }

  const isAdmin = userProfile.role === 'admin';

  // 단 1회의 서버 캐시 호출로 시간표 마스터 데이터 즉각 패칭 (캐시 적중 시 0ms)
  const { schedulesList, weights, timetableData } = await getCachedTimetablePageData();

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pb-20 sm:pb-16 min-h-full">
      <TimetableClient
        initialData={timetableData}
        schedulesList={schedulesList}
        initialWeights={weights}
        userProfile={userProfile}
        isAdmin={isAdmin}
      />
    </div>
  );
}
