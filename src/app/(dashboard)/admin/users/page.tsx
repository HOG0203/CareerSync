import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserTable } from './user-table';
import { CreateUserButton } from './create-user-button';
import { ImportUserButton } from './import-user-button';
import { getCachedProfiles, getCachedGraduationYears, getCachedAllStudentBaseData, getCurrentUserProfile } from '@/lib/data';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { getUserCustomPermissionsMapAction, getMasterAdminInfo, getSubAdminList } from './actions';
import { UserCog, Crown, ShieldCheck } from 'lucide-react';
import React from 'react';
import { TableLoadingSkeleton } from '@/components/dashboard/loading-skeleton';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  return <AdminUsersPageContent />;
}

async function AdminUsersPageContent() {
  // 서버 메모리 캐시 적용된 데이터 병렬 패칭 (Promise.all)
  const [profiles, graduationYears, allBaseData, settings, customPermissionsMap, masterAdminInfo, subAdminList, currentUserProfile] = await Promise.all([
    getCachedProfiles(),
    getCachedGraduationYears(),
    getCachedAllStudentBaseData(),
    getSystemSettings(),
    getUserCustomPermissionsMapAction(),
    getMasterAdminInfo(),
    getSubAdminList(),
    getCurrentUserProfile(),
  ]);

  const isCurrentUserMasterAdmin = Boolean(
    currentUserProfile?.username === masterAdminInfo.username ||
    currentUserProfile?.full_name === masterAdminInfo.name ||
    currentUserProfile?.username === '이호중' ||
    currentUserProfile?.full_name === '이호중'
  );

  const isCurrentUserSubAdmin = Boolean(
    isCurrentUserMasterAdmin || (
      currentUserProfile?.role === 'admin' &&
      currentUserProfile?.username &&
      subAdminList.includes(currentUserProfile.username)
    )
  );

  const canManageUsers = isCurrentUserMasterAdmin || isCurrentUserSubAdmin;
  
  // 학년도별 학과 및 반 정보 전체 매핑 데이터 생성
  const fullClassMapping: { year: number; major: string; className: string }[] = allBaseData
    .map(s => ({ 
      year: s.graduation_year || 0,
      major: s.major || '', 
      className: s.class_info || '' 
    }))
    .filter((v, i, a) => a.findIndex(t => t.year === v.year && t.major === v.major && t.className === v.className) === i)
    .filter(item => item.year && item.major && item.className);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 상단 페이지 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0 shadow-3xs">
            <UserCog className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                사용자 및 권한 관리
              </h2>
              {isCurrentUserMasterAdmin ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                  <Crown className="h-3.5 w-3.5 text-amber-600" />
                  메인관리자 전용 제어권
                </span>
              ) : isCurrentUserSubAdmin ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  서브관리자 권한 모드
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                  일반 관리자 모드
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              교직원/관리자 계정 생성, 담당 학반 배정 및 개별 메뉴 접근 권한을 관리합니다.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {canManageUsers && (
            <>
              <ImportUserButton />
              <CreateUserButton />
            </>
          )}
        </div>
      </div>

      {/* 사용자 관리 테이블 및 통계/필터 뷰 */}
      <UserTable 
        initialProfiles={profiles} 
        graduationYears={graduationYears}
        fullClassMapping={fullClassMapping}
        baseYear={settings.baseYear}
        initialCustomPermissionsMap={customPermissionsMap}
        isMasterAdmin={isCurrentUserMasterAdmin}
        isSubAdmin={isCurrentUserSubAdmin}
        subAdminList={subAdminList}
        masterAdminInfo={masterAdminInfo}
        currentUserId={currentUserProfile?.id}
      />
    </div>
  );
}
