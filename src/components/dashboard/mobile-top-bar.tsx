'use client';

import * as React from 'react';
import { Logo } from '@/components/logo';
import { Bell, Search, Menu, LogOut, User, ShieldAlert, Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout } from '@/app/login/actions';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import ProfileSettingsModal from './profile-settings-modal';

export function MobileTopBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const avatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
  };

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
              className="h-10 w-10 rounded-full p-0 overflow-hidden active:scale-90 transition-transform bg-slate-100 ring-1 ring-slate-200"
            >
              {avatar ? (
                <Image
                  src={avatar.imageUrl}
                  width={40}
                  height={40}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-slate-500" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 mt-2 rounded-2xl shadow-2xl border-slate-100 p-1.5">
            <div className="px-3 py-3 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">My Account</p>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                  {isAdmin ? 'AD' : 'T'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate leading-none">사용자</p>
                  <p className="text-[10px] text-slate-500 truncate mt-1">{isAdmin ? '시스템 관리자' : '교직원 계정'}</p>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator className="mx-1" />
            
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setProfileModalOpen(true), 150);
              }}
              className="rounded-xl py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 transition-colors cursor-pointer"
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="font-semibold text-sm">프로필 설정</span>
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem className="rounded-xl py-2.5 px-3 text-indigo-600 font-bold focus:bg-indigo-50 transition-colors cursor-pointer">
                <Sparkles className="mr-3 h-4 w-4" />
                관리자 특별 도구
              </DropdownMenuItem>
            )}

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
