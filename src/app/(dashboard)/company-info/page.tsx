import { getCompanies, getUnregisteredCompanies } from './actions';
import { getCurrentUserProfile } from '@/lib/data';
import { CompanyInfoClient } from './company-info-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CompanyInfoPage() {
  // 1. 서버 컴포넌트에서 병렬로 사용자 프로필 및 기업 목록 1회 즉시 로드 (SSR 0ms 체감 속도 달성)
  const [userProfile, initialCompanies, initialUnregisteredCompanies] = await Promise.all([
    getCurrentUserProfile(),
    getCompanies(),
    getUnregisteredCompanies(),
  ]);

  if (!userProfile) {
    redirect('/login');
  }

  const isAdmin = userProfile.role === 'admin';
  const isTeacher = userProfile.role === 'teacher';

  return (
    <CompanyInfoClient
      initialCompanies={initialCompanies}
      initialUnregisteredCompanies={initialUnregisteredCompanies}
      userProfile={userProfile}
      isAdmin={isAdmin}
      isTeacher={isTeacher}
    />
  );
}
