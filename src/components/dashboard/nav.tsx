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
  Award,
  Loader2,
  History,
  KeyRound,
  FileCheck,
  UploadCloud,
  Scale,
  BookOpen,
  CalendarDays,
  ArrowLeftRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { handleClientLogout } from '@/lib/auth-helpers';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import * as React from 'react';
import ProfileSettingsModal from './profile-settings-modal';
import { ChangePasswordDialog } from '@/app/(dashboard)/student/certification/change-password-dialog';

export default function Nav({ 
  isAdmin = false, 
  isMasterAdmin = false,
  isSubAdmin = false,
  userProfile,
  customPermissions
}: { 
  isAdmin?: boolean; 
  isMasterAdmin?: boolean;
  isSubAdmin?: boolean;
  userProfile?: any;
  customPermissions?: string[] | null;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const [navigatingHref, setNavigatingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setNavigatingHref(null);
  }, [pathname, searchParams]);

  const handleLogout = async () => {
    await handleClientLogout();
  };

  const closeMobile = () => {
    setOpenMobile(false);
  };

  const handleNavClick = (href: string) => {
    if (pathname !== href) {
      setNavigatingHref(href);
    }
    closeMobile();
  };


  const userGrade = userProfile?.assigned_grade;
  const isHomeroomTeacher = userProfile?.role === 'teacher' && Boolean(userProfile?.assigned_class?.trim());
  const isLowerGradeTeacher = isHomeroomTeacher && (userGrade === 1 || userGrade === 2);
  const isStudent = userProfile?.role === 'student';

  // 3학년 담임교사 또는 관리자에게만 취업상세데이터 및 노동인권교육 표시 (비담임 교직원 제외)
  const canView3rdGradeDetailMenus = isAdmin || (isHomeroomTeacher && !isLowerGradeTeacher);

  // 학생인 경우 전용 메뉴 그룹
  const studentGroups = [
    {
      title: "나의 학교생활",
      icon: GraduationCap,
      items: [
        { href: '/student/certification', label: '옥저인재인증 평가표', icon: Award },
        { href: '/student/merit-demerit', label: '상벌점 내역 조회', icon: Scale },
      ]
    }
  ];

  // 교직원/관리자 그룹 기본 규칙
  const defaultStaffGroups = [
    {
      title: "취업진로관리",
      icon: Briefcase,
      items: [
        { href: '/employment-status', label: '취업진로현황', icon: Grid3X3 },
        ...(!isLowerGradeTeacher ? [{ href: '/field-training', label: '현장실습/도제OJT현황', icon: CalendarCheck }] : []),
        { href: '/company-info', label: '업체정보', icon: Factory },
        ...(canView3rdGradeDetailMenus ? [{ href: '/students', label: '취업상세데이터', icon: ClipboardList }] : []),
        ...(canView3rdGradeDetailMenus ? [{ href: '/labor-education', label: '노동인권교육', icon: ShieldAlert }] : []),
      ]
    },
    {
      title: "교수학습지원",
      icon: BookOpen,
      items: [
        { href: '/teaching-support/timetable', label: '시간표 조회/관리', icon: CalendarDays },
        { href: '/teaching-support/substitute', label: '결보강 처리', icon: ArrowLeftRight },
        { href: '/teaching-support/substitute/admin', label: '결보강 승인/관리', icon: ShieldCheck },
      ]
    },
    {
      title: "학생 및 생활지도",
      icon: GraduationCap,
      items: [
        ...((isAdmin || isHomeroomTeacher) ? [{ href: '/class-management', label: '학반 관리', icon: BookUser }] : []),
        { href: '/merit-demerit', label: '상벌점 관리', icon: Scale },
        ...((isAdmin || isHomeroomTeacher) ? [{ href: '/student-accounts', label: '학생 계정 관리', icon: UserCog }] : []),
        ...(isAdmin ? [{ href: '/admin/students', label: '학생 등록/진급', icon: UserPlus }] : []),
      ]
    },
    {
      title: "옥저인재인증제",
      icon: CheckCircle2,
      items: [
        { href: '/admin/certification', label: '종합 인증평가', icon: Award },
        { href: '/admin/certification/grades', label: '성적현황', icon: GraduationCap },
        { href: '/admin/certification/attendance', label: '출결현황', icon: CalendarCheck },
        { href: '/admin/certification/certificates', label: '자격증현황', icon: FileCheck },
        { href: '/admin/certification/import', label: '엑셀 일괄 등록', icon: UploadCloud },
      ]
    },
    ...(isAdmin ? [
      {
        title: "시스템 관리",
        icon: Settings,
        items: [
          { href: '/admin/users', label: '사용자 관리', icon: UserCog },
          ...(isMasterAdmin ? [
            { href: '/admin/login-history', label: '로그인 및 활동 이력', icon: KeyRound },
            { href: '/admin/audit-logs', label: '작업 이력 관리', icon: History },
          ] : []),
          ...((isMasterAdmin || isSubAdmin) ? [
            { href: '/admin/settings', label: '시스템 설정', icon: ShieldCheck },
          ] : []),
        ]
      }
    ] : [])
  ];

  // 전체 풀 (커스텀 권한 필터링용)
  const fullStaffGroups = [
    {
      title: "취업진로관리",
      icon: Briefcase,
      items: [
        { href: '/employment-status', label: '취업진로현황', icon: Grid3X3 },
        { href: '/field-training', label: '현장실습/도제OJT현황', icon: CalendarCheck },
        { href: '/company-info', label: '업체정보', icon: Factory },
        { href: '/students', label: '취업상세데이터', icon: ClipboardList },
        { href: '/labor-education', label: '노동인권교육', icon: ShieldAlert },
      ]
    },
    {
      title: "교수학습지원",
      icon: BookOpen,
      items: [
        { href: '/teaching-support/timetable', label: '시간표 조회/관리', icon: CalendarDays },
      ]
    },
    {
      title: "학생 및 생활지도",
      icon: GraduationCap,
      items: [
        { href: '/class-management', label: '학반 관리', icon: BookUser },
        { href: '/merit-demerit', label: '상벌점 관리', icon: Scale },
        { href: '/student-accounts', label: '학생 계정 관리', icon: UserCog },
        { href: '/admin/students', label: '학생 등록/진급', icon: UserPlus },
      ]
    },
    {
      title: "옥저인재인증제",
      icon: CheckCircle2,
      items: [
        { href: '/admin/certification', label: '종합 인증평가', icon: Award },
        { href: '/admin/certification/grades', label: '성적현황', icon: GraduationCap },
        { href: '/admin/certification/attendance', label: '출결현황', icon: CalendarCheck },
        { href: '/admin/certification/certificates', label: '자격증현황', icon: FileCheck },
        { href: '/admin/certification/import', label: '엑셀 일괄 등록', icon: UploadCloud },
      ]
    },
    {
      title: "시스템 관리",
      icon: Settings,
      items: [
        { href: '/admin/users', label: '사용자 관리', icon: UserCog },
        { href: '/admin/login-history', label: '로그인 및 활동 이력', icon: KeyRound },
        { href: '/admin/audit-logs', label: '작업 이력 관리', icon: History },
        { href: '/admin/settings', label: '시스템 설정', icon: ShieldCheck },
      ]
    }
  ];

  const staffGroups = customPermissions && Array.isArray(customPermissions)
    ? fullStaffGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => customPermissions.includes(item.href)),
        }))
        .filter(group => group.items.length > 0)
    : defaultStaffGroups;

  const groups = isStudent ? studentGroups : staffGroups;

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
        {/* 대시보드 - 최상단 단일 메뉴 (학생이 아닌 경우만 표시) */}
        {!isStudent && (
          <SidebarMenu>
            <SidebarMenuItem>
              {(() => {
                const isDashNav = navigatingHref === '/dashboard';
                const isDashActive = isDashNav || (navigatingHref === null && pathname === '/dashboard');
                return (
                  <SidebarMenuButton 
                    asChild 
                    isActive={isDashActive}
                    className={cn(
                      "h-10 px-3",
                      isDashActive ? "bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600" : ""
                    )}
                  >
                    <Link href="/dashboard" prefetch={false} onClick={() => handleNavClick('/dashboard')}>
                      <LayoutDashboard className={cn("mr-2 h-4 w-4 flex-shrink-0", isDashActive ? "text-blue-600" : "")} />
                      <span className="font-bold flex-1">대시보드</span>
                      {isDashNav && <div className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />}
                    </Link>
                  </SidebarMenuButton>
                );
              })()}
            </SidebarMenuItem>
          </SidebarMenu>
        )}


        {/* 카테고리별 그룹 */}
        {groups.map((group) => {
          if ((group as any).isSingle) {
            const item = group.items[0];
            const isItemNav = navigatingHref === item.href;
            const isActive = isItemNav || (navigatingHref === null && pathname === item.href);
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
                    <Link href={item.href} prefetch={false} onClick={() => handleNavClick(item.href)}>
                      <group.icon className={cn("mr-2 h-4 w-4 flex-shrink-0", isActive ? "text-blue-600" : "")} />
                      <span className="font-bold flex-1">{group.title}</span>
                      {isItemNav && <div className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            );
          }

          const isAnyItemActive = group.items.some(item => {
            if (navigatingHref === item.href) return true;
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
                        isAnyItemActive && "text-slate-900 font-bold"
                      )}
                    >
                      <group.icon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="font-bold">{group.title}</span>
                      <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 border-l border-slate-100 pl-2">
                      {group.items.map((item) => {
                        const isNavThis = navigatingHref === item.href;
                        const isSubActive = isNavThis || (navigatingHref === null && (() => {
                          const [path, query] = item.href.split('?');
                          const matchPath = pathname === path;
                          if (!matchPath) return false;
                          if (query) {
                            const tabVal = new URLSearchParams(query).get('tab');
                            return searchParams.get('tab') === tabVal || (!searchParams.get('tab') && tabVal === 'grades');
                          }
                          return true;
                        })());

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
                              <Link href={item.href} prefetch={false} onClick={() => handleNavClick(item.href)}>
                                <item.icon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {isNavThis && <div className="ml-auto h-3.5 w-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />}
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
      <SidebarFooter className="p-2 border-t border-slate-100 flex flex-col gap-1">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-600 hover:text-blue-600 hover:bg-blue-50 h-10 px-3 transition-colors"
          onClick={() => setIsPasswordModalOpen(true)}
        >
          <KeyRound className="mr-2 h-4 w-4 text-slate-500" />
          <span className="font-medium">비밀번호 변경</span>
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-10 px-3 transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="font-medium">로그아웃</span>
        </Button>
      </SidebarFooter>

      {userProfile?.role === 'student' ? (
        <ChangePasswordDialog 
          open={isPasswordModalOpen} 
          onOpenChange={setIsPasswordModalOpen} 
        />
      ) : (
        <ProfileSettingsModal 
          open={isPasswordModalOpen} 
          onOpenChange={setIsPasswordModalOpen} 
        />
      )}
    </>
  );
}
