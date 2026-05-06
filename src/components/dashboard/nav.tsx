'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ShieldAlert,
  Grid3X3,
  BookUser,
  UserPlus,
  GraduationCap,
  Factory,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/login/actions';

const baseMenuItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/employment-status', label: '취업현황', icon: Grid3X3 },
  { href: '/company-info', label: '업체정보', icon: Factory },
  { href: '/labor-education', label: '노동인권교육', icon: ShieldAlert },
  { href: '/students', label: '취업상세데이터', icon: Users },
  { href: '/class-management', label: '학반 관리', icon: BookUser },
];

export default function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
  };

  const menuItems = isAdmin 
    ? [
        ...baseMenuItems, 
        { href: '/admin/students', label: '학생 등록 및 진급 관리', icon: UserPlus },
        { href: '/admin/grades/summary', label: '옥저인증', icon: LayoutDashboard },
        { href: '/admin/users', label: '사용자 관리', icon: ShieldAlert },
        { href: '/admin/settings', label: '설정', icon: Settings },
      ]
    : baseMenuItems;

  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Button
                asChild
                variant={pathname === item.href ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </SidebarFooter>
    </>
  );
}
