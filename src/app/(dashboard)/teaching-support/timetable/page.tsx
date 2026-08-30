import { Metadata } from 'next';
import { getCurrentUserProfile } from '@/lib/data';
import { 
  getTimetableData, 
  getSchedulesList, 
  getWeightSettings 
} from './actions';
import { TimetableClient } from './timetable-client';
import { checkTeachingSupportPermission } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '시간표 조회 및 관리 | 교수학습지원 | CareerSync',
  description: '교사별, 학반별 주간 시간표 조회 및 시수 관리 시스템',
};

export default async function TimetablePage() {
  const hasAccess = await checkTeachingSupportPermission('/teaching-support/timetable');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  const userProfile = await getCurrentUserProfile();
  const isAdmin = userProfile?.role === 'admin';

  const [schedulesList, initialWeights, timetableResult] = await Promise.all([
    getSchedulesList(),
    getWeightSettings(),
    getTimetableData(),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pb-20 sm:pb-16 min-h-full">
      <TimetableClient
        initialData={timetableResult.data}
        schedulesList={schedulesList}
        initialWeights={initialWeights}
        userProfile={userProfile}
        isAdmin={isAdmin}
      />
    </div>
  );
}
