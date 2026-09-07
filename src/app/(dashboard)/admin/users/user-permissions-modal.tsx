'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sliders, 
  RotateCcw, 
  Check, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Settings,
  BookOpen,
  Loader2,
  Info
} from 'lucide-react';
import { saveUserCustomPermissionsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export const ALL_SYSTEM_MENU_GROUPS = [
  {
    group: '취업진로관리',
    icon: Briefcase,
    color: 'text-indigo-600',
    items: [
      { href: '/employment-status', label: '취업진로현황', description: '전교생 취업/진학/진로 현황 종합 시트' },
      { href: '/field-training', label: '현장실습/도제OJT현황', description: '3학년 현장실습 및 도제 파견 현황' },
      { href: '/company-info', label: '업체정보', description: '협약/실습/취업 기업체 및 구인 관리' },
      { href: '/students', label: '취업상세데이터', description: '학생별 상세 취업 데이터 스프레드시트' },
      { href: '/labor-education', label: '노동인권교육', description: '노동인권교육 이수 현황 그리드' },
      { href: '/employment/grade', label: '내신등급 계산', description: '맞춤형 내신등급 산출 및 기업별 지원자 선별' },
      { href: '/employment/recommendation', label: '학교장 추천 선발', description: 'NCS, 성적, 인증점수, 면접 종합 추천 대상자 심사' },
    ],
  },
  {
    group: '교수학습지원',
    icon: BookOpen,
    color: 'text-blue-600',
    items: [
      { href: '/teaching-support/timetable', label: '시간표 조회/관리', description: '전체/학급/교사별 주간 시간표 조회 및 관리' },
      { href: '/teaching-support/substitute', label: '결보강 처리', description: '대화형 결보강 배정, 교환 및 보강 신청/발급' },
    ],
  },
  {
    group: '학생 및 생활지도',
    icon: GraduationCap,
    color: 'text-emerald-600',
    items: [
      { href: '/class-management', label: '학반 관리', description: '담당 학반 학생 명부 및 진로코스 배정' },
      { href: '/merit-demerit', label: '상벌점 관리', description: '학생 상점/벌점 부여 및 통계 관리' },
      { href: '/student-accounts', label: '학생 계정 관리', description: '학반별 학생 로그인 계정 및 비밀번호 관리' },
      { href: '/admin/students', label: '학생 등록/진급', description: '학생 엑셀 일괄 등록 및 학년 진급 처리' },
    ],
  },
  {
    group: '옥저인재인증제',
    icon: Award,
    color: 'text-sky-600',
    items: [
      { href: '/admin/certification', label: '종합 인증평가', description: '옥저인재인증 등급 및 점수 종합 집계' },
      { href: '/admin/certification/grades', label: '성적현황', description: '교과 성적 데이터 현황' },
      { href: '/admin/certification/attendance', label: '출결현황', description: '출결 일수 및 감점 현황' },
      { href: '/admin/certification/certificates', label: '자격증현황', description: '자격증 취득 데이터 현황' },
      { href: '/admin/certification/import', label: '엑셀 일괄 등록', description: '인증제 데이터 엑셀 업로드' },
    ],
  },
  {
    group: '시스템 관리',
    icon: Settings,
    color: 'text-amber-600',
    items: [
      { href: '/admin/users', label: '사용자 관리', description: '교직원 계정 및 권한 관리' },
      { href: '/admin/login-history', label: '로그인 및 활동 이력', description: '실시간 시스템 접속 및 활동 로그' },
      { href: '/admin/audit-logs', label: '작업 이력 관리', description: '데이터 변경 및 수정 감사 로그' },
      { href: '/admin/settings', label: '시스템 설정', description: '기준학년도, 배점 및 기준 설정' },
    ],
  },
];

export function getDefaultRoutesForUser(profile: any, subAdminList: string[] = [], masterUsername: string = ''): string[] {
  const isMaster = Boolean(masterUsername && profile?.username === masterUsername);
  const isSubAdmin = isMaster || (profile?.username && subAdminList.includes(profile.username));

  if (profile?.role === 'admin') {
    if (isMaster) {
      return ALL_SYSTEM_MENU_GROUPS.flatMap(g => g.items.map(i => i.href));
    }
    if (isSubAdmin) {
      // 서브관리자는 기본 권한에서 '로그인 및 활동 이력', '작업 이력 관리'를 제외 (시스템 설정, 사용자 관리, 교수학습지원 등 포함)
      return ALL_SYSTEM_MENU_GROUPS.flatMap(g => g.items.map(i => i.href))
        .filter(href => href !== '/admin/login-history' && href !== '/admin/audit-logs');
    }
    // 일반 관리자는 기본 권한에서 로그인 및 활동 이력, 작업 이력 관리, 시스템 설정 제외 (교수학습지원 등 포함)
    return ALL_SYSTEM_MENU_GROUPS.flatMap(g => g.items.map(i => i.href))
      .filter(href => href !== '/admin/login-history' && href !== '/admin/audit-logs' && href !== '/admin/settings');
  }
  if (profile?.role === 'student') {
    return ['/student/certification', '/student/merit-demerit'];
  }
  
  const grade = profile?.assigned_grade;
  const isHomeroom = Boolean(profile?.assigned_class?.trim());
  const isLower = isHomeroom && (grade === 1 || grade === 2);
  const isGrade3 = isHomeroom && !isLower;

  const routes = [
    '/employment-status',
    '/company-info',
    '/merit-demerit',
    '/admin/certification',
    '/admin/certification/grades',
    '/admin/certification/attendance',
    '/admin/certification/certificates',
    '/admin/certification/import',
    '/teaching-support/timetable',
    '/teaching-support/substitute',
  ];

  if (isGrade3) {
    routes.push('/field-training', '/students', '/labor-education');
  }

  if (isHomeroom) {
    routes.push('/class-management', '/student-accounts');
  }

  // 🌟 교수학습지원 메뉴(/teaching-support)는 모든 교직원/관리자 사용자에게 기본 공개 (접근 허용)

  return routes;
}

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  customPermissionsMap: Record<string, string[]>;
  subAdminList?: string[];
  masterUsername?: string;
  onSaved: (newMap: Record<string, string[]>) => void;
}

export function UserPermissionsModal({
  isOpen,
  onClose,
  profile,
  customPermissionsMap,
  subAdminList = [],
  masterUsername = '',
  onSaved,
}: UserPermissionsModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [selectedRoutes, setSelectedRoutes] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  const isCustom = profile ? customPermissionsMap[profile.id] !== undefined : false;
  const defaultRoutes = React.useMemo(() => (profile ? getDefaultRoutesForUser(profile, subAdminList, masterUsername) : []), [profile, subAdminList, masterUsername]);

  // 모달 열릴 때 권한 초기화
  React.useEffect(() => {
    if (isOpen && profile) {
      const saved = customPermissionsMap[profile.id];
      if (saved && Array.isArray(saved)) {
        setSelectedRoutes(saved);
      } else {
        setSelectedRoutes(getDefaultRoutesForUser(profile, subAdminList, masterUsername));
      }
    }
  }, [isOpen, profile, customPermissionsMap, subAdminList]);

  if (!profile) return null;

  const handleToggleRoute = (href: string) => {
    setSelectedRoutes(prev =>
      prev.includes(href) ? prev.filter(r => r !== href) : [...prev, href]
    );
  };

  const handleToggleGroup = (groupItems: { href: string }[]) => {
    const groupHrefs = groupItems.map(i => i.href);
    const allChecked = groupHrefs.every(h => selectedRoutes.includes(h));

    if (allChecked) {
      setSelectedRoutes(prev => prev.filter(h => !groupHrefs.includes(h)));
    } else {
      setSelectedRoutes(prev => Array.from(new Set([...prev, ...groupHrefs])));
    }
  };

  // 개별 커스텀 권한 저장 (낙관적 UI 즉시 적용)
  const handleSave = async () => {
    const prevMap = { ...customPermissionsMap };
    const updatedMap = { ...customPermissionsMap, [profile.id]: selectedRoutes };

    // 모달 즉시 닫고 UI 즉시 반영 (0ms)
    onSaved(updatedMap);
    onClose();
    toast({
      title: '메뉴 권한 저장 완료',
      description: `${profile.full_name || profile.username} 선생님께 ${selectedRoutes.length}개 메뉴 권한이 즉시 적용되었습니다.`,
    });

    try {
      const res = await saveUserCustomPermissionsAction(profile.id, selectedRoutes, profile.full_name || profile.username);
      if (!res.success) {
        onSaved(prevMap);
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    } catch (err: any) {
      onSaved(prevMap);
      toast({ variant: 'destructive', title: '저장 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  // 기본값으로 복원 (낙관적 UI 즉시 적용)
  const handleResetToDefault = async () => {
    if (!window.confirm(`${profile.full_name || profile.username} 사용자의 메뉴 권한을 직책/담임 기본 규칙으로 복원하시겠습니까?`)) {
      return;
    }

    const prevMap = { ...customPermissionsMap };
    const updatedMap = { ...customPermissionsMap };
    delete updatedMap[profile.id];

    // 모달 즉시 닫고 UI 즉시 반영 (0ms)
    onSaved(updatedMap);
    onClose();
    toast({
      title: '기본 권한으로 복원 완료',
      description: '해당 사용자의 개별 오버라이드가 삭제되고 기본 규칙이 즉시 적용됩니다.',
    });

    try {
      const res = await saveUserCustomPermissionsAction(profile.id, null, profile.full_name || profile.username);
      if (!res.success) {
        onSaved(prevMap);
        toast({ variant: 'destructive', title: '복원 실패', description: res.error });
      }
    } catch (err: any) {
      onSaved(prevMap);
      toast({ variant: 'destructive', title: '복원 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  const userRoleLabel = profile.role === 'admin'
    ? '시스템 관리자'
    : profile.assigned_class
    ? `${profile.assigned_grade || 3}학년 ${profile.assigned_major || ''} ${profile.assigned_class} 담임교사`
    : '비담임 교직원';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b bg-slate-50/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-3xs">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{profile.full_name || profile.username} 선생님 메뉴 권한 설정</span>
                  {isCustom ? (
                    <Badge className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                      커스텀 설정 중
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
                      기본 규칙 적용
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  직책: <span className="font-bold text-slate-700">{userRoleLabel}</span> | 체크한 페이지만 네비게이션에 노출됩니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 안내 배너 */}
        <div className="p-3 px-5 bg-indigo-50/70 border-b border-indigo-100/60 flex items-center justify-between text-xs text-indigo-900 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="font-medium">
              현재 <strong className="font-black text-indigo-700">{selectedRoutes.length}개</strong> 메뉴 선택됨 (기본 권한: {defaultRoutes.length}개)
            </span>
          </div>
          {isCustom && (
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-200 transition-all flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              <span>기본값으로 복원</span>
            </button>
          )}
        </div>

        {/* 메뉴 체크박스 리스트 */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 bg-white">
          {ALL_SYSTEM_MENU_GROUPS.map((group) => {
            const groupHrefs = group.items.map(i => i.href);
            const checkedCount = groupHrefs.filter(h => selectedRoutes.includes(h)).length;
            const isAllGroupChecked = checkedCount === groupHrefs.length;

            return (
              <div key={group.group} className="rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                {/* 그룹 헤더 */}
                <div className="p-3 px-4 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <group.icon className={cn("h-4 w-4", group.color)} />
                    <span className="text-xs font-black text-slate-800">{group.group}</span>
                    <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4 bg-white text-slate-600 border-slate-200">
                      {checkedCount} / {group.items.length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleGroup(group.items)}
                    className="h-6 text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 rounded-md"
                  >
                    {isAllGroupChecked ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>

                {/* 그룹 아이템 목록 */}
                <div className="divide-y divide-slate-100 p-1">
                  {group.items.map((item) => {
                    const isChecked = selectedRoutes.includes(item.href);
                    const isDefaultAllowed = defaultRoutes.includes(item.href);

                    return (
                      <label
                        key={item.href}
                        className={cn(
                          "flex items-start gap-3 p-2.5 px-3 rounded-lg cursor-pointer transition-all hover:bg-slate-50/80",
                          isChecked && "bg-indigo-50/30"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleRoute(item.href)}
                          className="mt-0.5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{item.label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.href})</span>
                            {isDefaultAllowed && (
                              <Badge className="text-[9px] font-bold px-1.5 py-0 h-3.5 bg-slate-100 text-slate-500 border-none">
                                기본 포함
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-400">
            * 변경된 권한은 저장 즉시 해당 사용자의 사이드바 및 모바일 탭에 반영됩니다.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100"
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>저장하기</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
