import { getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings, getCachedMasterCertificates } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { getCachedCertificationSummaryList } from './actions';
import { CertificationSummaryClient } from './certification-summary-client';

export const metadata = {
  title: '옥저인재인증제 종합 평가 | CareerSync',
};

export const dynamic = 'force-dynamic';

export default async function CertificationMainPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  // 1. 기반 설정, 프로필, 마스터 자격증, 검색 파라미터를 1회 완전 병렬 패칭
  const [profile, settings, masterCertificates, params] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings(),
    getCachedMasterCertificates(),
    searchParams,
  ]);

  if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    redirect('/dashboard');
  }

  const baseYear = settings.baseYear;

  let defaultGradeNum = 3;
  if (profile.role === 'teacher' && profile.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = params.grade ? parseInt(params.grade) : defaultGradeNum;

  // 2. 인메모리 캐싱된 평가 목록 즉시 로드 (0ms)
  const evaluations = await getCachedCertificationSummaryList(selectedGradeNum);

  return (
    <CertificationSummaryClient
      initialEvaluations={evaluations}
      currentGrade={selectedGradeNum}
      baseYear={baseYear}
      isAdmin={profile.role === 'admin'}
      userProfile={profile}
      masterCertificates={masterCertificates}
    />
  );
}

