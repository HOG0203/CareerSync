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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Menu, Search, LogOut, Settings } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

export default function Header() {
  const avatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');
  const pathname = usePathname();
  const pageTitle = toTitleCase(pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard');
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  
  const pageTitleTranslations: {[key: string]: string} = {
    'Dashboard': '대시보드',
    'Students': '학생',
    'Reports': '보고서',
    'Users': '사용자 관리'
  }

  const handleLogout = async () => {
    await logout();
  };

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
          <Nav />
        </SheetContent>
      </Sheet>
      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">대시보드</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="capitalize">
              {pageTitleTranslations[pageTitle] || pageTitle}
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
              className="relative h-10 w-10 rounded-full p-0 overflow-hidden active:scale-90 transition-transform focus-visible:ring-0 select-none touch-manipulation"
            >
              <div className="h-full w-full flex items-center justify-center bg-slate-100 ring-2 ring-transparent active:ring-indigo-500 rounded-full overflow-hidden">
                {avatar && (
                  <Image
                    src={avatar.imageUrl}
                    width={40}
                    height={40}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    data-ai-hint={avatar.imageHint}
                  />
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl shadow-xl border-slate-100">
            <DropdownMenuLabel className="font-bold text-slate-500 text-xs uppercase tracking-widest px-4 py-3">내 계정</DropdownMenuLabel>
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
