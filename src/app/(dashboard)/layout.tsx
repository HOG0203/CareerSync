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

export default async function DashboardLayout({ children }: PropsWithChildren) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. 미들웨어 대신 여기서 로그인 여부 체크
  if (!user) {
    redirect('/login');
  }

  // 2. 프로필 정보 조회
  const userProfile = await getCurrentUserProfile();
  
  const isAdmin = userProfile?.role === 'admin';

  // 3. 메인관리자 및 서브관리자 여부 조회
  let isMasterAdmin = false;
  let isSubAdmin = false;
  try {
    const [{ data: masterSetting }, { data: subAdminSetting }] = await Promise.all([
      supabase.from('system_settings').select('value').eq('key', 'master_admin_info').maybeSingle(),
      supabase.from('system_settings').select('value').eq('key', 'sub_admin_list').maybeSingle(),
    ]);

    const masterUsername = (masterSetting?.value as any)?.username || '이호중';
    isMasterAdmin = Boolean(
      isAdmin && (
        userProfile?.username === masterUsername ||
        userProfile?.full_name === '이호중' ||
        userProfile?.username === '이호중'
      )
    );

    const subAdminList = Array.isArray(subAdminSetting?.value) ? (subAdminSetting.value as string[]) : [];
    isSubAdmin = Boolean(isMasterAdmin || (isAdmin && userProfile?.username && subAdminList.includes(userProfile.username)));
  } catch (err) {
    isMasterAdmin = Boolean(isAdmin && (userProfile?.full_name === '이호중' || userProfile?.username === '이호중'));
    isSubAdmin = isMasterAdmin;
  }

  // 4. 사용자별 개별 메뉴 권한 조회 (system_settings)
  let customPermissions: string[] | null = null;
  if (userProfile?.id) {
    const { data: permSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'user_custom_permissions')
      .maybeSingle();

    if (permSetting?.value && typeof permSetting.value === 'object') {
      const permMap = permSetting.value as Record<string, string[]>;
      if (permMap[userProfile.id] && Array.isArray(permMap[userProfile.id])) {
        customPermissions = permMap[userProfile.id];
      }
    }
  }

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
