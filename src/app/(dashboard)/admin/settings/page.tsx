import {
  getSystemSettings,
  getCachedMasterCertificates,
  getCachedCertificationConfig,
  getCachedMeritDemeritRules,
} from './actions';
import { AdminSettingsClient } from './settings-client';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 시스템 설정 메인 페이지 (서버 컴포넌트 - 1회 동시 병렬 패칭)
 */
export default async function AdminSettingsPage() {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) {
    redirect('/login');
  }

  if (userProfile.role !== 'admin') {
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