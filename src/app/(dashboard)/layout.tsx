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
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: PropsWithChildren) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 1. 미들웨어 대신 여기서 로그인 여부 체크
  if (!user) {
    redirect('/login');
  }

  // 2. 관리자 여부 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  const isAdmin = profile?.role === 'admin';

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar>
            <Nav isAdmin={isAdmin} />
          </Sidebar>
        </div>

        <SidebarInset className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Mobile Navigation */}
          <MobileTopBar isAdmin={isAdmin} />
          
          {/* Desktop Header */}
          <div className="hidden lg:block">
            <Header />
          </div>

          <main className="flex-1 p-2 sm:p-4 lg:p-6 mt-14 lg:mt-0 mb-16 lg:mb-0 overflow-auto min-w-0">
            {children}
          </main>

          {/* Mobile Bottom Tab */}
          <MobileBottomTab isAdmin={isAdmin} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
