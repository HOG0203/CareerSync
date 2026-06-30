import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCertificateSummaries } from './actions';
import { CertificateSummaryClient } from './certificate-summary-client';

export default async function CertificateSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  // 관리자 권한 확인
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // 시스템 설정에서 기준 학사학년도 조회
  const settings = await getSystemSettings();

  // URL 학년 정보 파싱 (기본 3학년)
  const { grade } = await searchParams;
  const selectedGradeNum = grade ? parseInt(grade) : 3;

  // 학년별 자격증 현황 데이터 로드
  const summaries = await getCertificateSummaries(selectedGradeNum);

  return (
    <CertificateSummaryClient 
      initialSummaries={summaries}
      currentGrade={selectedGradeNum}
    />
  );
}
