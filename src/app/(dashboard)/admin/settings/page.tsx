import {
  getSystemSettings,
  getCachedMasterCertificates,
  getCachedCertificationConfig,
  getCachedMeritDemeritRules,
} from './actions';
import { AdminSettingsClient } from './settings-client';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';

import { getMasterAdminInfo, getUserCustomPermissionsMapAction } from '@/app/(dashboard)/admin/users/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 시스템 설정 메인 페이지 (서버 컴포넌트 - 1회 동시 병렬 패칭)
 */
export default async function AdminSettingsPage() {
  const [userProfile, masterInfo, customPermMap] = await Promise.all([
    getCurrentUserProfile(),
    getMasterAdminInfo(),
    getUserCustomPermissionsMapAction(),
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  const isMasterAdmin = Boolean(
    userProfile.username === masterInfo.username ||
    userProfile.full_name === '이호중' ||
    userProfile.username === '이호중'
  );

  const hasExplicitPerm = userProfile.id && customPermMap[userProfile.id]?.includes('/admin/settings');

  if (userProfile.role !== 'admin' || (!isMasterAdmin && !hasExplicitPerm)) {
    redirect('/dashboard');
  }

  // 서버 캐시 1-Shot 동시 병렬 패칭 (0.01초 소요)
  const [settings, certs, certConfig, meritRules] = await Promise.all([
    getSystemSettings(),
    getCachedMasterCertificates(),
    getCachedCertificationConfig(),
    getCachedMeritDemeritRules(),
  ]);

  return (
    <AdminSettingsClient
      initialBaseYear={settings.baseYear}
      initialCerts={certs}
      initialCertConfig={certConfig}
      initialMeritRules={meritRules}
    />
  );
}