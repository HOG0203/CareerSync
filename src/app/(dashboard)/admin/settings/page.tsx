import {
  getSystemSettings,
  getAcademicSnapshotsAction,
  getGradeStudentCounts,
} from './actions';
import { AdminSettingsClient } from './settings-client';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';

import { getMasterAdminInfo, getUserCustomPermissionsMapAction, getSubAdminList } from '@/app/(dashboard)/admin/users/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 학사학년도 및 안전 백업 센터 메인 페이지 (서버 컴포넌트)
 */
export default async function AdminSettingsPage() {
  const [userProfile, masterInfo, customPermMap, subAdminList] = await Promise.all([
    getCurrentUserProfile(),
    getMasterAdminInfo(),
    getUserCustomPermissionsMapAction(),
    getSubAdminList(),
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  const isMasterAdmin = Boolean(
    userProfile.username === masterInfo.username ||
    userProfile.full_name === masterInfo.name ||
    userProfile.username === '이호중' ||
    userProfile.full_name === '이호중'
  );

  const isSubAdmin = Boolean(isMasterAdmin || (userProfile.username && subAdminList.includes(userProfile.username)));
  const hasExplicitPerm = userProfile.id && customPermMap[userProfile.id]?.includes('/admin/settings');

  if (userProfile.role !== 'admin' || (!isMasterAdmin && !isSubAdmin && !hasExplicitPerm)) {
    redirect('/dashboard');
  }

  // 서버 캐시 동시 패칭
  const [settings, snapshots] = await Promise.all([
    getSystemSettings(),
    getAcademicSnapshotsAction(),
  ]);

  const gradeCounts = await getGradeStudentCounts(settings.baseYear);

  return (
    <AdminSettingsClient
      initialBaseYear={settings.baseYear}
      initialSnapshots={snapshots || []}
      initialGradeCounts={gradeCounts}
    />
  );
}
