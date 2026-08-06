import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedAllAttendanceRecords } from './actions';
import { AttendanceTableClient } from './attendance-table-client';

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    redirect('/dashboard');
  }

  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  const { grade } = await searchParams;
  let defaultGradeNum = 3;
  if (profile?.role === 'teacher' && profile?.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = grade ? parseInt(grade) : defaultGradeNum;


  const attendanceData = await getCachedAllAttendanceRecords(baseYear, selectedGradeNum);


  return (
    <AttendanceTableClient 
      initialData={attendanceData as any[]} 
      currentGrade={selectedGradeNum}
      baseYear={baseYear}
      isAdmin={profile?.role === 'admin'}
    />
  );
}
