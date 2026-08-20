'use client';

import * as React from 'react';
import { Logo } from '@/components/logo';
import { Bell, Menu, LogOut, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { handleClientLogout } from '@/lib/auth-helpers';
import ProfileSettingsModal from './profile-settings-modal';

export function MobileTopBar({ isAdmin = false, userProfile }: { isAdmin?: boolean, userProfile?: any }) {
  const [mounted, setMounted] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await handleClientLogout();
  };

  // 이름의 마지막 두 글자 추출 로직
  const getDisplayInitials = (name?: string) => {
    if (!name) return '사용자';
    const trimmed = name.trim();
    if (trimmed.length <= 2) return trimmed;
    return trimmed.slice(-2);
  };

  const displayName = getDisplayInitials(userProfile?.full_name);

  if (!mounted) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-100 lg:hidden">
        <div className="scale-90 origin-left">
          <Logo />
        </div>
        <div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse" />
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 bg-white/90 backdrop-blur-md border-b border-slate-100 lg:hidden shadow-sm">
      <div className="scale-90 origin-left">
        <Logo />
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 rounded-full active:bg-slate-50 transition-colors">
          <Bell className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-11 w-11 rounded-full p-0 flex items-center justify-center bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-90 transition-all focus-visible:ring-0 select-none touch-manipulation border-2 border-white shadow-indigo-100/50"
            >
              <span className="text-[14px] font-black tracking-tighter pointer-events-none">
                {displayName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 mt-2 rounded-2xl shadow-2xl border-slate-100 p-1.5">
            <div className="px-3 py-3 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">내 계정</p>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-[11px]">
                  {displayName}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate leading-none">{userProfile?.full_name || '로그인 사용자'}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-1">{isAdmin ? '시스템 관리자' : '교직원 계정'}</p>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator className="mx-1" />
            
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                (document.activeElement as HTMLElement)?.blur();
                setTimeout(() => setProfileModalOpen(true), 150);
              }}
              className="rounded-xl py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 transition-colors cursor-pointer"
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="font-semibold text-sm">프로필 설정</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="mx-1" />
            
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="rounded-xl py-2.5 px-3 text-rose-600 focus:bg-rose-50 focus:text-rose-700 transition-colors cursor-pointer"
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-semibold text-sm">로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileSettingsModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen} 
      />
    </header>
  );
}
