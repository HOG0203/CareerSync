import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { CertificationImportClient } from './certification-import-client';

export const metadata = {
  title: '옥저인재인증제 엑셀 일괄 등록 | CareerSync',
};

export default async function CertificationImportPage() {
  const [profile, settings] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings()
  ]);

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    redirect('/dashboard');
  }

  const baseYear = settings.baseYear;

  return (
    <CertificationImportClient
      isAdmin={profile?.role === 'admin'}
      userProfile={profile}
      baseYear={baseYear}
    />
  );
}
