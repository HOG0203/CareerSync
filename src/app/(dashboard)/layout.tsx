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

  // 3. 메인관리자 여부 조회
  let isMasterAdmin = false;
  try {
    const { data: masterSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'master_admin_info')
      .maybeSingle();

    const masterUsername = (masterSetting?.value as any)?.username || '이호중';
    isMasterAdmin = Boolean(
      isAdmin && (
        userProfile?.username === masterUsername ||
        userProfile?.full_name === '이호중' ||
        userProfile?.username === '이호중'
      )
    );
  } catch (err) {
    isMasterAdmin = Boolean(isAdmin && (userProfile?.full_name === '이호중' || userProfile?.username === '이호중'));
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
      <div className="h-screen w-full flex bg-background overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar>
            <Nav 
              isAdmin={isAdmin} 
              isMasterAdmin={isMasterAdmin}
              userProfile={userProfile} 
              customPermissions={customPermissions} 
            />
          </Sidebar>
        </div>

        <SidebarInset className="flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Mobile Navigation */}
          <MobileTopBar isAdmin={isAdmin} userProfile={userProfile} />
          
          {/* Desktop Header */}
          <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-md">
            <Header userProfile={userProfile} />
          </div>

          <div className="flex-1 p-2 lg:p-6 lg:mt-0 mt-14 lg:mb-0 mb-16 flex flex-col min-w-0">
            {children}
          </div>

          {/* Mobile Bottom Tab */}
          <MobileBottomTab 
            isAdmin={isAdmin} 
            role={userProfile?.role} 
            userGrade={userProfile?.assigned_grade} 
            customPermissions={customPermissions}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
