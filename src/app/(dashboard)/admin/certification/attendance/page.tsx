import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedAllAttendanceRecords } from './actions';
import { AttendanceTableClient } from './attendance-table-client';

export const dynamic = 'force-dynamic';

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  // 1. 프로필, 시스템 설정, 파라미터 1회 완전 동시 병렬 패칭
  const [profile, settings, params] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings(),
    searchParams,
  ]);

  if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    redirect('/dashboard');
  }

  const baseYear = settings.baseYear;

  let defaultGradeNum = 3;
  if (profile.role === 'teacher' && profile.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = params.grade ? parseInt(params.grade) : defaultGradeNum;

  // 2. 인메모리 캐싱된 출결 데이터 로드 (0ms)
  const attendanceData = await getCachedAllAttendanceRecords(baseYear, selectedGradeNum);

  return (
    <AttendanceTableClient 
      initialData={attendanceData as any[]} 
      currentGrade={selectedGradeNum}
      baseYear={baseYear}
      isAdmin={profile.role === 'admin'}
      userProfile={profile}
    />
  );
}

