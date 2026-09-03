// ==============================================================================
// src/app/(dashboard)/employment/grade/page.tsx
// 내신등급 계산기 메인 페이지 (서버 컴포넌트 - 관리자 및 명시적 권한 교직원 전용)
// ==============================================================================

import { Suspense } from 'react';
import { getGpaPresets, getGradeStudents } from './actions';
import { GradeClient } from './grade-client';
import { Loader2 } from 'lucide-react';
import { getCurrentUserProfile } from '@/lib/data';
import { getUserCustomPermissionsMapAction } from '@/app/(dashboard)/admin/users/actions';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '내신등급 계산기 | 취업진로관리',
  description: '기업별·공고별 맞춤형 고등학교 내신등급(전과목 및 국영수) 자동 산출, 지원 조건 실시간 시뮬레이션 및 프리셋 관리',
};

export default async function GradePage() {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect('/login');
  }

  const isAdmin = userProfile.role === 'admin';
  let hasExplicitPerm = false;

  // 비관리자 교직원인 경우에만 사용자 권한 맵 추가 조회
  if (!isAdmin) {
    const customPermMap = await getUserCustomPermissionsMapAction();
    hasExplicitPerm = Boolean(userProfile.id && customPermMap[userProfile.id]?.includes('/employment/grade'));
  }

  // 관리자(admin)이거나 사용자 관리에서 명시적 권한을 부여받은 교직원만 접근 허용
  if (!isAdmin && !hasExplicitPerm) {
    redirect('/dashboard');
  }

  // 병렬 캐시 패칭 (캐시 적중 시 0ms 즉각 반환)
  const [presets, studentsRes] = await Promise.all([
    getGpaPresets(),
    getGradeStudents(),
  ]);

  const initialStudents = studentsRes.success ? studentsRes.data : [];

  return (
    <div className="p-3 sm:p-5 lg:p-6 w-full min-w-0 max-w-none pb-20 sm:pb-16 min-h-full">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <GradeClient initialPresets={presets} initialStudents={initialStudents} />
      </Suspense>
    </div>
  );
}
