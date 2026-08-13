import { 
  getAchievementScores, 
  getCurrentUserProfile, 
  getCachedYearlyRankingsSummary
} from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { redirect } from 'next/navigation';
import { GradeSummaryClient } from './grade-summary-client';

export default async function CertificationPage({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  // 관리자, 교직원 접근 가능
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    redirect('/dashboard');
  }

  // 시스템 설정에서 기준 학사학년도 가져오기
  const settings = await getSystemSettings();
  const baseYear = settings.baseYear;

  // URL 파라미터에서 학년 정보 읽음 (담임교사인 경우 담당 학년이 기본값, 나머지는 3학년)
  const { grade } = await searchParams;
  let defaultGradeNum = 3;
  if (profile?.role === 'teacher' && profile?.assigned_grade) {
    defaultGradeNum = profile.assigned_grade;
  }
  const selectedGradeNum = grade ? parseInt(grade) : defaultGradeNum;

  
  const targetGradYear = baseYear + (4 - selectedGradeNum);

  // 성적 및 가중치 데이터만 서버에서 로드 (캐시 적용)
  const [summaryMap, weights] = await Promise.all([
    getCachedYearlyRankingsSummary(targetGradYear, baseYear),
    getAchievementScores()
  ]);


  const studentSummaries = Object.values(summaryMap);

  return (
    <GradeSummaryClient 
      initialSummaries={studentSummaries as any[]} 
      weights={weights}
      currentGrade={selectedGradeNum} 
      isAdmin={profile?.role === 'admin'}
      userProfile={profile}
    />
  );

}
