import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedCertificateSummaries } from './actions';
import { CertificateSummaryClient } from './certificate-summary-client';

export default async function CertificateSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  // 관리자, 교직원 권한 확인
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    redirect('/dashboard');
  }

  // URL 학년 정보 파싱 (담임교사인 경우 담당 학년이 기본값, 나머지는 3학년)
  const { grade } = await searchParams;
  let defaultGradeNum = 3;
  if (profile?.role === 'teacher' && profile?.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = grade ? parseInt(grade) : defaultGradeNum;

  // 시스템 설정, 마스터 자격증, 학년별 자격증 현황 데이터 병렬 로드
  const [settings, masterCertificates, summaries] = await Promise.all([
    getSystemSettings(),
    getCachedMasterCertificates(),
    getCachedCertificateSummaries(selectedGradeNum)
  ]);

  return (
    <CertificateSummaryClient 
      initialSummaries={summaries}
      currentGrade={selectedGradeNum}
      isAdmin={profile?.role === 'admin'}
      userProfile={profile}
      masterCertificates={masterCertificates}
    />
  );
}
