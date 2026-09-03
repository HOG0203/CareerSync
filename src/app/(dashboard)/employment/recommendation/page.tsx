// ==============================================================================
// src/app/(dashboard)/employment/recommendation/page.tsx
// 학교장 추천 대상자 선정 시스템 (관리자 및 명시적 권한 교직원 전용)
// ==============================================================================

import { Metadata } from 'next';
import { getRecommendationSessions } from './actions';
import { RecommendationClient } from './recommendation-client';
import { getCurrentUserProfile } from '@/lib/data';
import { getUserCustomPermissionsMapAction } from '@/app/(dashboard)/admin/users/actions';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '학교장 추천 대상자 선정 시스템 | 취업진로관리',
  description: 'NCS 30점, 교과성적 30점, 옥저인재인증 30점, 면접 10점 기준 학교장추천대상자 심사 및 선발 시스템',
};

export default async function RecommendationPage() {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect('/login');
  }

  const isAdmin = userProfile.role === 'admin';
  let hasExplicitPerm = false;

  if (!isAdmin) {
    const customPermMap = await getUserCustomPermissionsMapAction();
    hasExplicitPerm = Boolean(userProfile.id && customPermMap[userProfile.id]?.includes('/employment/recommendation'));
  }

  // 관리자(admin)이거나 사용자 관리에서 명시적 권한을 부여받은 교직원만 접근 허용
  if (!isAdmin && !hasExplicitPerm) {
    redirect('/dashboard');
  }

  // 캐시된 세션 목록 즉시 조회 (0ms)
  const sessions = await getRecommendationSessions();

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full min-w-0 max-w-none pb-20 sm:pb-16 min-h-full">
      <RecommendationClient initialSessions={sessions} />
    </div>
  );
}
