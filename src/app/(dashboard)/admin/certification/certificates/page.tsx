import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedCertificateSummaries } from './actions';
import { CertificateSummaryClient } from './certificate-summary-client';

export const dynamic = 'force-dynamic';

export default async function CertificateSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const params = await searchParams;
  const gradeParam = params.grade ? parseInt(params.grade) : undefined;

  // 1. 프로필, 시스템 설정, 마스터 자격증 1회 완전 동시 병렬 패칭
  const [profile, settings, masterCertificates] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings(),
    getCachedMasterCertificates(),
  ]);

  // 관리자, 교직원 권한 확인
  if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    redirect('/dashboard');
  }

  // URL 학년 정보 파싱 (담임교사인 경우 담당 학년이 기본값, 나머지는 3학년)
  let defaultGradeNum = 3;
  if (profile.role === 'teacher' && profile.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = gradeParam || defaultGradeNum;

  // 2. 인메모리 캐싱된 자격증 현황 데이터 로드 (0ms)
  const summaries = await getCachedCertificateSummaries(selectedGradeNum, settings.baseYear);

  return (
    <CertificateSummaryClient 
      initialSummaries={summaries}
      currentGrade={selectedGradeNum}
      isAdmin={profile.role === 'admin'}
      userProfile={profile}
      masterCertificates={masterCertificates}
    />
  );
}

