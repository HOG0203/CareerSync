'use client';

import * as React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Menu, Search, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Nav from './nav';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';
import ProfileSettingsModal from './profile-settings-modal';

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    }
  );
}

// 경로별 브레드크럼 매핑 정의
const ROUTE_MAP: Record<string, { group: string; label: string }> = {
  '/dashboard': { group: '', label: '대시보드' },
  '/employment-status': { group: '취업진로관리', label: '취업진로현황' },
  '/company-info': { group: '취업진로관리', label: '업체정보' },
  '/students': { group: '취업진로관리', label: '취업상세데이터' },
  '/class-management': { group: '학사 및 지도', label: '학반 관리' },
  '/labor-education': { group: '학사 및 지도', label: '노동인권교육' },
  '/admin/students': { group: '학사 및 지도', label: '학생 등록/진급' },
  '/admin/users': { group: '시스템 관리', label: '사용자 관리' },
  '/admin/settings': { group: '시스템 관리', label: '시스템 설정' },
  '/admin/certification': { group: '옥저인재인증제', label: '인증현황' },
  '/admin/certification/grades': { group: '옥저인재인증제', label: '성적현황' },
  '/admin/certification/attendance': { group: '옥저인재인증제', label: '출결현황' },
  '/admin/certification/certificates': { group: '옥저인재인증제', label: '자격증현황' },
};

export default function Header({ userProfile }: { userProfile?: any }) {
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  // 현재 경로에 맞는 브레드크럼 정보 추출
  const currentRoute = ROUTE_MAP[pathname] || { 
    group: '', 
    label: toTitleCase(pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard') 
  };

  // 이름의 마지막 두 글자 추출 로직
  const getDisplayInitials = (name?: string) => {
    if (!name) return '사용자';
    const trimmed = name.trim();
    if (trimmed.length <= 2) return trimmed;
    return trimmed.slice(-2);
  };

  const displayName = getDisplayInitials(userProfile?.full_name);

  const handleLogout = async () => {
    await logout();
  };

  if (!mounted) {
    return <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 lg:static lg:h-auto lg:border-0 lg:bg-transparent lg:px-6" />;
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 lg:static lg:h-auto lg:border-0 lg:bg-transparent lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">메뉴 토글</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
          <SheetTitle className="sr-only">모바일 메뉴</SheetTitle>
          <SheetDescription className="sr-only">사이드바 탐색 메뉴</SheetDescription>
          <Nav userProfile={userProfile} isAdmin={userProfile?.role === 'admin'} />
        </SheetContent>
      </Sheet>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          {currentRoute.group ? (
            <>
              <BreadcrumbItem>
                <span className="text-slate-400 font-medium text-[13px]">{currentRoute.group}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : pathname !== '/dashboard' ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard" className="text-slate-400 font-medium text-[13px]">대시보드</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : null}
          <BreadcrumbItem>
            <BreadcrumbPage className="font-bold text-slate-900 text-[13px]">
              {currentRoute.label}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative ml-auto flex items-center gap-2 sm:gap-4">
        <div className="relative hidden xs:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="검색..."
            className="w-[120px] sm:w-[200px] lg:w-[320px] rounded-lg bg-secondary pl-8 h-9 text-xs"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0 overflow-hidden active:scale-95 transition-transform focus-visible:ring-0 select-none touch-manipulation group"
            >
              <div className="h-full w-full flex items-center justify-center bg-indigo-600 text-white ring-2 ring-transparent group-hover:ring-indigo-200 transition-all rounded-full overflow-hidden shadow-sm">
                <span className="text-[13px] font-black tracking-tighter">
                  {displayName}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl border-slate-100">
            <DropdownMenuLabel className="px-4 py-3 flex flex-col">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-0.5">내 계정</span>
              <span className="text-slate-800 font-bold text-sm truncate">{userProfile?.full_name || '로그인 사용자'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                const closeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
                document.dispatchEvent(closeEvent);
                setTimeout(() => setProfileModalOpen(true), 150);
              }} 
              className="cursor-pointer py-3 px-4 focus:bg-indigo-50 focus:text-indigo-700 transition-colors"
            >
              <Settings className="mr-3 h-4 w-4" />
              <span className="font-semibold">프로필 설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout} 
              className="text-rose-600 cursor-pointer py-3 px-4 focus:bg-rose-50 focus:text-rose-700 transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-semibold">로그아웃</span>
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
