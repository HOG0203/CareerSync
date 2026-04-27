import { getCurrentUserProfile, getAchievementScores, getYearlyRankingsSummary } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getAllAttendanceRecords } from './actions';
import { AttendanceTableClient } from './attendance-table-client';

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const { grade } = await searchParams;
  const selectedGradeNum = grade ? parseInt(grade) : 3;

  const attendanceData = await getAllAttendanceRecords(baseYear, selectedGradeNum);

  return (
    <AttendanceTableClient 
      initialData={attendanceData as any[]} 
      currentGrade={selectedGradeNum}
      baseYear={baseYear} // 학사학년도 전달
    />
  );
}
