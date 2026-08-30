import { Metadata } from 'next';
import { getCurrentUserProfile } from '@/lib/data';
import { 
  getTimetableData, 
  getSchedulesList, 
  getWeightSettings 
} from './actions';
import { TimetableClient } from './timetable-client';

export const metadata: Metadata = {
  title: '시간표 조회 및 관리 | 교수학습지원 | CareerSync',
  description: '교사별, 학반별 주간 시간표 조회 및 시수 관리 시스템',
};

export default async function TimetablePage() {
  const userProfile = await getCurrentUserProfile();
  const isAdmin = userProfile?.role === 'admin';

  const [schedulesList, initialWeights, timetableResult] = await Promise.all([
    getSchedulesList(),
    getWeightSettings(),
    getTimetableData(),
  ]);

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
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
