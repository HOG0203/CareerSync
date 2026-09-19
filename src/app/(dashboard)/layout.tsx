import type { PropsWithChildren } from 'react';
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Nav from '@/components/dashboard/nav';
import Header from '@/components/dashboard/header';
import { createClient } from '@/lib/supabase/server';
import { MobileTopBar } from '@/components/dashboard/mobile-top-bar';
import { MobileBottomTab } from '@/components/dashboard/mobile-bottom-tab';
import { PageViewTracker } from '@/components/dashboard/page-view-tracker';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data';
import { getMasterAdminInfo, getSubAdminList } from '@/app/(dashboard)/admin/users/actions';
import { getCachedCustomPermissionsMap } from '@/lib/permissions';

export default async function DashboardLayout({ children }: PropsWithChildren) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. 미들웨어 대신 여기서 로그인 여부 체크
  if (!user) {
    redirect('/login');
  }

  // 2. 프로필, 관리자 권한, 개별 메뉴 권한 1회 완전 동시 병렬 패칭 (Next.js 캐시 적용)
  const [userProfile, masterInfo, subAdminList, permMap] = await Promise.all([
    getCurrentUserProfile(),
    getMasterAdminInfo(),
    getSubAdminList(),
    getCachedCustomPermissionsMap(),
  ]);
  
  const isAdmin = userProfile?.role === 'admin';

  // 3. 메인관리자 및 서브관리자 여부 동기 판별 (0ms 계산)
  const masterUsername = masterInfo?.username || '이호중';
  const masterName = masterInfo?.name || '이호중';

  const isMasterAdmin = Boolean(
    isAdmin && (
      (masterUsername && userProfile?.username === masterUsername) ||
      (masterName && userProfile?.full_name === masterName) ||
      userProfile?.username === '이호중' ||
      userProfile?.full_name === '이호중'
    )
  );

  const subList = Array.isArray(subAdminList) ? subAdminList : [];
  const isSubAdmin = Boolean(isMasterAdmin || (isAdmin && userProfile?.username && subList.includes(userProfile.username)));

  // 4. 사용자별 개별 메뉴 권한 도출 (동기 즉각 계산)
  const customPermissions = (userProfile?.id && permMap[userProfile.id] && Array.isArray(permMap[userProfile.id]))
    ? permMap[userProfile.id]
    : null;

  return (
    <SidebarProvider>
      <PageViewTracker />
      <div className="h-screen w-full flex bg-background overflow-hidden print:h-auto print:overflow-visible print:block">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block print:hidden">
          <Sidebar>
            <Nav 
              isAdmin={isAdmin} 
              isMasterAdmin={isMasterAdmin}
              isSubAdmin={isSubAdmin}
              userProfile={userProfile} 
              customPermissions={customPermissions} 
            />
          </Sidebar>
        </div>

        <SidebarInset className="flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar print:overflow-visible print:h-auto print:block print:p-0 print:m-0">
          {/* Mobile Navigation */}
          <div className="print:hidden">
            <MobileTopBar isAdmin={isAdmin} userProfile={userProfile} />
          </div>
          
          {/* Desktop Header */}
          <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-md shrink-0 border-b border-slate-200/60 print:hidden">
            <Header userProfile={userProfile} />
          </div>

          <div className="flex-1 p-2 lg:p-5 lg:mt-0 mt-14 lg:mb-0 mb-16 flex flex-col min-w-0 print:p-0 print:m-0 print:block print:overflow-visible">
            {children}
          </div>

          {/* Mobile Bottom Tab */}
          <div className="print:hidden">
            <MobileBottomTab 
              isAdmin={isAdmin} 
              role={userProfile?.role} 
              userGrade={userProfile?.assigned_grade} 
              customPermissions={customPermissions}
            />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
