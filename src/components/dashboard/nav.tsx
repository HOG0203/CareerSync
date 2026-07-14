'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
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
  ChevronRight,
  ClipboardList,
  UserCog,
  ShieldCheck,
  CheckCircle2,
  Briefcase,
  CalendarCheck,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/login/actions';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import * as React from 'react';

export default function Nav({ isAdmin = false, userProfile }: { isAdmin?: boolean; userProfile?: any }) {
  const [mounted, setMounted] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const closeMobile = () => {
    setOpenMobile(false);
  };

  const userGrade = userProfile?.assigned_grade;
  const isLowerGradeTeacher = userProfile?.role === 'teacher' && (userGrade === 1 || userGrade === 2);

  // 그룹 정의
  const groups = [
    {
      title: "취업진로관리",
      icon: Briefcase,
      items: [
        { href: '/employment-status', label: '취업진로현황', icon: Grid3X3 },
        { href: '/company-info', label: '업체정보', icon: Factory },
        ...(!isLowerGradeTeacher ? [{ href: '/students', label: '취업상세데이터', icon: ClipboardList }] : []),
      ]
    },
    {
      title: "학사 및 지도",
      icon: GraduationCap,
      items: [
        { href: '/class-management', label: '학반 관리', icon: BookUser },
        ...(!isLowerGradeTeacher ? [{ href: '/labor-education', label: '노동인권교육', icon: ShieldAlert }] : []),
        ...(isAdmin ? [{ href: '/admin/students', label: '학생 등록/진급', icon: UserPlus }] : []),
      ]
    },
    {
      title: "옥저인재인증제",
      icon: CheckCircle2,
      items: [
        { href: '/admin/certification/grades', label: '성적현황', icon: GraduationCap },
        { href: '/admin/certification/attendance', label: '출결현황', icon: CalendarCheck },
        { href: '/admin/certification/certificates', label: '자격증현황', icon: Award },
      ]
    },
    ...(isAdmin ? [
      {
        title: "시스템 관리",
        icon: Settings,
        items: [
          { href: '/admin/users', label: '사용자 관리', icon: UserCog },
          { href: '/admin/settings', label: '시스템 설정', icon: ShieldCheck },
        ]
      }
    ] : [])
  ];

  if (!mounted) {
    return (
      <>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <SidebarContent className="p-2 gap-4">
          <div className="h-10 w-full bg-slate-50 animate-pulse rounded-md" />
          <div className="h-10 w-full bg-slate-50 animate-pulse rounded-md mt-4" />
          <div className="h-10 w-full bg-slate-50 animate-pulse rounded-md mt-4" />
        </SidebarContent>
      </>
    );
  }



  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent className="p-2 gap-4">
        {/* 대시보드 - 최상단 단일 메뉴 */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === '/dashboard'}
              className={cn(
                "h-10 px-3",
                pathname === '/dashboard' ? "bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600" : ""
              )}
            >
              <Link href="/dashboard" onClick={closeMobile}>
                <LayoutDashboard className={cn("mr-2 h-4 w-4", pathname === '/dashboard' ? "text-blue-600" : "")} />
                <span className="font-bold">대시보드</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 카테고리별 그룹 */}
        {groups.map((group) => {
          if ((group as any).isSingle) {
            const item = group.items[0];
            const isActive = pathname === item.href;
            return (
              <SidebarMenu key={group.title}>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                    className={cn(
                      "h-10 px-3 text-slate-500 hover:text-slate-900 transition-colors",
                      isActive ? "bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600" : ""
                    )}
                  >
                    <Link href={item.href} onClick={closeMobile}>
                      <group.icon className={cn("mr-2 h-4 w-4", isActive ? "text-blue-600" : "")} />
                      <span className="font-bold">{group.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            );
          }

          const isAnyItemActive = group.items.some(item => {
            const [path, query] = item.href.split('?');
            const matchPath = pathname === path;
            if (!matchPath) return false;
            if (query) {
              const tabVal = new URLSearchParams(query).get('tab');
              return searchParams.get('tab') === tabVal || (!searchParams.get('tab') && tabVal === 'grades');
            }
            return true;
          });
          
          return (
            <Collapsible
              key={group.title}
              asChild
              defaultOpen={isAnyItemActive}
              className="group/collapsible"
            >
              <SidebarGroup className="p-0">
                <SidebarMenuItem className="list-none">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                      className={cn(
                        "h-10 px-3 text-slate-500 hover:text-slate-900 transition-colors",
                        isAnyItemActive && "text-slate-900"
                      )}
                    >
                      <group.icon className="mr-2 h-4 w-4" />
                      <span className="font-bold">{group.title}</span>
                      <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 border-l border-slate-100 pl-2">
                      {group.items.map((item) => {
                        const isSubActive = (() => {
                          const [path, query] = item.href.split('?');
                          const matchPath = pathname === path;
                          if (!matchPath) return false;
                          if (query) {
                            const tabVal = new URLSearchParams(query).get('tab');
                            return searchParams.get('tab') === tabVal || (!searchParams.get('tab') && tabVal === 'grades');
                          }
                          return true;
                        })();

                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton 
                              asChild 
                              isActive={isSubActive}
                              className={cn(
                                "h-9 transition-all",
                                isSubActive ? "text-blue-600 font-bold bg-blue-50/50" : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              <Link href={item.href} onClick={closeMobile}>
                                <item.icon className="mr-2 h-3.5 w-3.5" />
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-slate-50">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-10 px-3 transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="font-medium">로그아웃</span>
        </Button>
      </SidebarFooter>
    </>
  );
}
