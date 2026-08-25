import { 
  getAchievementScores, 
  getCurrentUserProfile, 
  getCachedYearlyRankingsSummary
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { GradeSummaryClient } from './grade-summary-client';

export const dynamic = 'force-dynamic';

export default async function CertificationPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  // 1. 프로필, 시스템 설정, 가중치, 파라미터 1회 완전 동시 병렬 패칭
  const [profile, settings, weights, params] = await Promise.all([
    getCurrentUserProfile(),
    getSystemSettings(),
    getAchievementScores(),
    searchParams,
  ]);

  // 관리자, 교직원 접근 가능
  if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    redirect('/dashboard');
  }

  const baseYear = settings.baseYear;

  // URL 파라미터에서 학년 정보 읽음 (담임교사인 경우 담당 학년이 기본값, 나머지는 3학년)
  let defaultGradeNum = 3;
  if (profile.role === 'teacher' && profile.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = params.grade ? parseInt(params.grade) : defaultGradeNum;
  const targetGradYear = baseYear + (4 - selectedGradeNum);

  // 2. 인메모리 캐싱된 성적 데이터 로드 (0ms)
  const summaryMap = await getCachedYearlyRankingsSummary(targetGradYear, baseYear);
  const studentSummaries = Object.values(summaryMap);

  return (
    <GradeSummaryClient 
      initialSummaries={studentSummaries as any[]} 
      weights={weights}
      currentGrade={selectedGradeNum} 
      isAdmin={profile.role === 'admin'}
      userProfile={profile}
      baseYear={baseYear}
    />
  );
}

