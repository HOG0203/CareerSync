import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedCertificationSummaryList } from './actions';
import { CertificationSummaryClient } from './certification-summary-client';

export const metadata = {
  title: '옥저인재인증제 종합 평가 | CareerSync',
};

export default async function CertificationMainPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    redirect('/dashboard');
  }

  const [settings, masterCertificates] = await Promise.all([
    getSystemSettings(),
    getCachedMasterCertificates()
  ]);
  const baseYear = settings.baseYear;

  const { grade } = await searchParams;
  let defaultGradeNum = 3;
  if (profile?.role === 'teacher' && profile?.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = grade ? parseInt(grade) : defaultGradeNum;

  const evaluations = await getCachedCertificationSummaryList(selectedGradeNum);

  return (
    <CertificationSummaryClient
      initialEvaluations={evaluations}
      currentGrade={selectedGradeNum}
      baseYear={baseYear}
      isAdmin={profile?.role === 'admin'}
      userProfile={profile}
      masterCertificates={masterCertificates}
    />
  );
}
