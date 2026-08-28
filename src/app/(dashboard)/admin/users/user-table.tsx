'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  GraduationCap, 
  KeyRound, 
  Loader2, 
  MoreVertical, 
  Search, 
  Sliders, 
  Users, 
  ShieldCheck, 
  RotateCcw,
  CheckCircle2,
  Lock,
  UserCog,
  Sparkles,
  Crown
} from 'lucide-react';
import { updateUserRole, deleteUser, updateAssignedClass, resetUserPassword, transferMasterAdminAction, toggleSubAdminAction } from './actions';
import { UserPermissionsModal } from './user-permissions-modal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface UserTableProps {
  initialProfiles: any[];
  graduationYears: number[];
  fullClassMapping: { year: number; major: string; className: string }[];
  baseYear: number;
  initialCustomPermissionsMap?: Record<string, string[]>;
  isMasterAdmin?: boolean;
  isSubAdmin?: boolean;
  subAdminList?: string[];
  masterAdminInfo?: { username: string; name: string };
  currentUserId?: string;
}

export function UserTable({ 
  initialProfiles, 
  graduationYears, 
  fullClassMapping, 
  baseYear,
  initialCustomPermissionsMap = {},
  isMasterAdmin = false,
  isSubAdmin = false,
  subAdminList = [],
  masterAdminInfo = { username: '이호중', name: '이호중' },
  currentUserId
}: UserTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [profiles, setProfiles] = React.useState(initialProfiles);
  const [customPermissionsMap, setCustomPermissionsMap] = React.useState<Record<string, string[]>>(initialCustomPermissionsMap);
  const [currentMasterAdmin, setCurrentMasterAdmin] = React.useState(masterAdminInfo);
  const [currentSubAdmins, setCurrentSubAdmins] = React.useState<string[]>(subAdminList);
  const [isTogglingSubAdmin, setIsTogglingSubAdmin] = React.useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = React.useState(false);
  const [transferTargetProfile, setTransferTargetProfile] = React.useState<any>(null);

  // 로그인한 사용자의 권한 등급 (1: 메인관리자, 2: 서브관리자, 3: 일반관리자, 4: 일반교직원)
  const currentUserProfile = React.useMemo(() => {
    return profiles.find(p => p.id === currentUserId);
  }, [profiles, currentUserId]);

  const currentUserRank: number = React.useMemo(() => {
    if (isMasterAdmin) return 1;
    if (isSubAdmin) return 2;
    if (currentUserProfile?.role === 'admin') return 3;
    return 4;
  }, [isMasterAdmin, isSubAdmin, currentUserProfile]);

  const getProfileRank = React.useCallback((p: any): number => {
    if (!p) return 4;
    if (
      p.username === currentMasterAdmin.username ||
      p.full_name === '이호중' ||
      p.username === '이호중'
    ) {
      return 1;
    }
    if (p.role === 'admin') {
      if (p.username && currentSubAdmins.includes(p.username)) {
        return 2;
      }
      return 3;
    }
    return 4;
  }, [currentMasterAdmin, currentSubAdmins]);

  const canManageUsers = currentUserRank <= 2;

  // 서버 컴포넌트에서 전달된 props 갱신 시 로컬 상태 동기화
  React.useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);

  React.useEffect(() => {
    setCustomPermissionsMap(initialCustomPermissionsMap);
  }, [initialCustomPermissionsMap]);

  React.useEffect(() => {
    setCurrentMasterAdmin(masterAdminInfo);
  }, [masterAdminInfo]);

  React.useEffect(() => {
    setCurrentSubAdmins(subAdminList);
  }, [subAdminList]);

  const handleToggleSubAdmin = async (targetUsername: string) => {
    setIsTogglingSubAdmin(targetUsername);
    try {
      const res = await toggleSubAdminAction(targetUsername);
      if (res.error) {
        toast({ title: '설정 실패', description: res.error, variant: 'destructive' });
      } else {
        const nextList = res.subAdminList || [];
        setCurrentSubAdmins(nextList);
        toast({
          title: res.isSubAdmin ? '서브관리자 임명 완료' : '서브관리자 해제 완료',
          description: `${targetUsername} 사용자가 ${res.isSubAdmin ? '서브관리자로 임명되었습니다.' : '서브관리자에서 해제되었습니다.'}`,
        });
        router.refresh();
      }
    } catch (err: any) {
      toast({ title: '오류 발생', description: err.message, variant: 'destructive' });
    } finally {
      setIsTogglingSubAdmin(null);
    }
  };

  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'all' | 'admin' | 'teacher'>('all');
  const [gradeFilter, setGradeFilter] = React.useState<string>('all');
  const [permFilter, setPermFilter] = React.useState<string>('all');

  const [isAssignOpen, setIsAssignOpen] = React.useState(false);
  const [selectedProfile, setSelectedProfile] = React.useState<any>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = React.useState(false);
  const [selectedPermissionProfile, setSelectedPermissionProfile] = React.useState<any>(null);
  const [isResetting, setIsResetting] = React.useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetOpen] = React.useState(false);

  // 배정용 선택 상태
  const [assignAcademicYear, setAssignAcademicYear] = React.useState<string>('');
  const [assignGrade, setAssignGrade] = React.useState<string>('3');
  const [assignMajor, setAssignMajor] = React.useState<string>('');
  const [assignClass, setAssignClass] = React.useState<string>('');

  // 1. 요약 통계 계산 (학생 계정 관리 스타일)
  const stats = React.useMemo(() => {
    const totalCount = profiles.length;
    const adminCount = profiles.filter(p => p.role === 'admin').length;
    const homeroomCount = profiles.filter(p => Boolean(p.assigned_class)).length;
    const customPermCount = Object.keys(customPermissionsMap).length;

    return { totalCount, adminCount, homeroomCount, customPermCount };
  }, [profiles, customPermissionsMap]);

  // 2. 필터링된 데이터
  const filteredProfiles = React.useMemo(() => {
    return profiles.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !term ||
        p.full_name?.toLowerCase().includes(term) ||
        p.username?.toLowerCase().includes(term) ||
        p.assigned_major?.toLowerCase().includes(term) ||
        p.assigned_class?.toLowerCase().includes(term);

      const matchesRole = roleFilter === 'all' || p.role === roleFilter;

      let matchesGrade = true;
      if (gradeFilter === '1') matchesGrade = p.assigned_grade === 1;
      else if (gradeFilter === '2') matchesGrade = p.assigned_grade === 2;
      else if (gradeFilter === '3') matchesGrade = p.assigned_grade === 3 || (!p.assigned_grade && Boolean(p.assigned_class));
      else if (gradeFilter === 'unassigned') matchesGrade = !p.assigned_class;

      let matchesPerm = true;
      const isCustom = customPermissionsMap[p.id] !== undefined;
      if (permFilter === 'custom') matchesPerm = isCustom;
      else if (permFilter === 'default') matchesPerm = !isCustom;

      return matchesSearch && matchesRole && matchesGrade && matchesPerm;
    });
  }, [profiles, searchTerm, roleFilter, gradeFilter, permFilter, customPermissionsMap]);

  /**
   * 계산된 졸업연도 (GY = AY + (4 - G))
   */
  const calculatedGradYear = React.useMemo(() => {
    if (!assignAcademicYear || !assignGrade) return null;
    return parseInt(assignAcademicYear) + (4 - parseInt(assignGrade));
  }, [assignAcademicYear, assignGrade]);

  const availableMajors = React.useMemo(() => {
    if (!calculatedGradYear) return [];
    return Array.from(new Set(
      fullClassMapping
        .filter(item => item.year === calculatedGradYear)
        .map(item => item.major)
    )).sort();
  }, [calculatedGradYear, fullClassMapping]);

  const availableClasses = React.useMemo(() => {
    if (!calculatedGradYear || !assignMajor) return [];
    return fullClassMapping
      .filter(item => item.year === calculatedGradYear && item.major === assignMajor)
      .map(item => item.className)
      .sort();
  }, [calculatedGradYear, assignMajor, fullClassMapping]);

  React.useEffect(() => {
    if (selectedProfile && isAssignOpen) {
      const gy = selectedProfile.assigned_year || (baseYear + 1);
      const grade = selectedProfile.assigned_grade || 3;
      const ay = gy - (4 - grade);

      setAssignAcademicYear(String(ay));
      setAssignGrade(String(grade));
      setAssignMajor(selectedProfile.assigned_major || '');
      setAssignClass(selectedProfile.assigned_class || '');
    }
  }, [selectedProfile, isAssignOpen, baseYear]);

  // 1. 역할 변경 (낙관적 UI 즉시 적용)
  const handleRoleChange = async (userId: string, newRole: string) => {
    const prevProfiles = [...profiles];
    // 즉시 로컬 상태 반영 (0ms)
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
    toast({ title: '역할 변경 완료' });

    try {
      const result = await updateUserRole(userId, newRole);
      if (!result.success) {
        setProfiles(prevProfiles);
        toast({ variant: 'destructive', title: '변경 실패', description: result.error });
      }
    } catch (err: any) {
      setProfiles(prevProfiles);
      toast({ variant: 'destructive', title: '변경 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  // 2. 담당 학반 배정 저장 (낙관적 UI 즉시 적용)
  const handleAssignSave = async () => {
    if (!selectedProfile || !assignAcademicYear || !assignGrade || !assignMajor || !assignClass || !calculatedGradYear) {
      toast({ variant: 'destructive', title: '입력 부족', description: '모든 정보를 선택해주세요.' });
      return;
    }

    const data = {
      year: calculatedGradYear,
      major: assignMajor,
      className: assignClass,
      grade: parseInt(assignGrade)
    };

    const targetId = selectedProfile.id;
    const prevProfiles = [...profiles];

    // 모달 즉시 닫고 UI 즉시 갱신 (0ms)
    setIsAssignOpen(false);
    setProfiles(prev => prev.map(p => p.id === targetId ? { 
      ...p, 
      assigned_year: data.year, 
      assigned_major: data.major, 
      assigned_class: data.className,
      assigned_grade: data.grade
    } : p));
    toast({ title: '담당 학반 설정 완료' });

    try {
      const result = await updateAssignedClass(targetId, data);
      if (!result.success) {
        setProfiles(prevProfiles);
        toast({ variant: 'destructive', title: '설정 실패', description: result.error });
      }
    } catch (err: any) {
      setProfiles(prevProfiles);
      toast({ variant: 'destructive', title: '설정 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  // 3. 담당 학반 배정 해제 (낙관적 UI 즉시 적용)
  const handleClearAssign = async () => {
    if (!selectedProfile) return;

    const targetId = selectedProfile.id;
    const prevProfiles = [...profiles];

    const data = {
      year: null,
      major: null,
      className: null,
      grade: null
    };

    // 모달 즉시 닫고 UI 즉시 갱신 (0ms)
    setIsAssignOpen(false);
    setProfiles(prev => prev.map(p => p.id === targetId ? { 
      ...p, 
      assigned_year: null, 
      assigned_major: null, 
      assigned_class: null,
      assigned_grade: null
    } : p));
    toast({ title: '담당 학반 배정 해제 완료' });

    try {
      const result = await updateAssignedClass(targetId, data);
      if (!result.success) {
        setProfiles(prevProfiles);
        toast({ variant: 'destructive', title: '배정 해제 실패', description: result.error });
      }
    } catch (err: any) {
      setProfiles(prevProfiles);
      toast({ variant: 'destructive', title: '배정 해제 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  // 4. 계정 삭제 (낙관적 UI 즉시 적용)
  const handleDelete = async (userId: string) => {
    const prevProfiles = [...profiles];

    // 모달 즉시 닫고 목록에서 즉시 제거 (0ms)
    setIsDeleteOpen(false);
    setProfiles(prev => prev.filter(p => p.id !== userId));
    toast({ title: '사용자 삭제 완료' });

    try {
      const result = await deleteUser(userId);
      if (!result.success) {
        setProfiles(prevProfiles);
        toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
      }
    } catch (err: any) {
      setProfiles(prevProfiles);
      toast({ variant: 'destructive', title: '삭제 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  // 5. 비밀번호 초기화 (낙관적 UI 즉시 적용)
  const handleResetPassword = async (userId: string) => {
    setIsResetOpen(false);
    toast({ 
      title: '비밀번호 초기화 완료', 
      description: '비밀번호가 123123으로 초기화되었습니다.' 
    });

    try {
      const result = await resetUserPassword(userId);
      if (!result.success) {
        toast({ 
          variant: 'destructive', 
          title: '초기화 실패', 
          description: result.error 
        });
      }
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: '오류 발생', 
        description: error?.message || '비밀번호 초기화 중 오류가 발생했습니다.' 
      });
    }
  };

  // 6. 메인관리자 권한 이양 (낙관적 UI 즉시 적용)
  const handleTransferMasterAdmin = async () => {
    if (!transferTargetProfile) return;
    const prevMaster = currentMasterAdmin;
    const target = transferTargetProfile;

    // 즉시 로컬 상태 반영 (0ms)
    setIsTransferModalOpen(false);
    setCurrentMasterAdmin({
      username: target.username,
      name: target.full_name || target.username,
    });
    setProfiles(prev => prev.map(p => p.id === target.id ? { ...p, role: 'admin' } : p));
    toast({
      title: '👑 메인관리자 권한 이양 완료',
      description: `${target.full_name || target.username} 선생님께 메인관리자 최종 권한이 이양되었습니다.`,
    });

    try {
      const result = await transferMasterAdminAction(target.username);
      if (!result.success) {
        setCurrentMasterAdmin(prevMaster);
        toast({ variant: 'destructive', title: '이양 실패', description: result.error });
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setCurrentMasterAdmin(prevMaster);
      toast({ variant: 'destructive', title: '이양 실패', description: err?.message || '오류가 발생했습니다.' });
    }
  };

  const getDisplayAY = (gy: number, g: number) => {
    return gy - (4 - (g || 3));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. 요약 통계 카드 4개 그리드 (Student-Accounts 테마 일원화) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">전체 등록 계정</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.totalCount}명</p>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">시스템 관리자</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.adminCount}명</p>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">담임 배정 교원</p>
              <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{stats.homeroomCount}명</p>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl">
          <CardContent className="p-3 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">개별 권한 설정</p>
              <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{stats.customPermCount}명</p>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
              <Sliders className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. 필터 & 검색 바 카드 */}
      <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* 검색창 */}
            <div className="relative w-full md:w-80 order-1 md:order-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="이름, 아이디, 학과, 반 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-xs sm:text-sm bg-white rounded-xl border-slate-200"
              />
            </div>

            {/* 필터 그룹 */}
            <div className="flex flex-wrap items-center gap-2 order-2 md:order-1">
              {/* 직책 세그먼트 버튼 */}
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200/60">
                <button 
                  onClick={() => setRoleFilter('all')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                    roleFilter === 'all' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  전체
                </button>
                <button 
                  onClick={() => setRoleFilter('admin')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                    roleFilter === 'admin' ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  관리자
                </button>
                <button 
                  onClick={() => setRoleFilter('teacher')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                    roleFilter === 'teacher' ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  교직원
                </button>
              </div>

              {/* 학년/배정 필터 */}
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[120px] h-10 text-xs bg-white rounded-xl border-slate-200">
                  <SelectValue placeholder="학년/배정" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs">전체 학년</SelectItem>
                  <SelectItem value="3" className="text-xs">3학년 담임</SelectItem>
                  <SelectItem value="2" className="text-xs">2학년 담임</SelectItem>
                  <SelectItem value="1" className="text-xs">1학년 담임</SelectItem>
                  <SelectItem value="unassigned" className="text-xs">비담임 교직원</SelectItem>
                </SelectContent>
              </Select>

              {/* 권한 유형 필터 */}
              <Select value={permFilter} onValueChange={setPermFilter}>
                <SelectTrigger className="w-[130px] h-10 text-xs bg-white rounded-xl border-slate-200">
                  <SelectValue placeholder="권한 유형" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs">전체 권한 유형</SelectItem>
                  <SelectItem value="default" className="text-xs">기본 규칙 적용</SelectItem>
                  <SelectItem value="custom" className="text-xs">개별 커스텀 권한</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. 계정 목록 테이블 카드 */}
      <Card className="border-slate-200/80 shadow-xs bg-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b py-4 px-4 sm:px-6 bg-white flex flex-row items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900">계정 및 권한 목록</CardTitle>
              <Badge variant="outline" className="text-[11px] font-bold px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-200 rounded-lg">
                총 {filteredProfiles.length}명
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              각 교직원의 권한 설정, 담당 학반 배정 및 비밀번호를 관리합니다.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* 데스크톱 테이블 뷰 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200/80">
                <TableRow>
                  <TableHead className="w-[160px] font-bold text-slate-700">아이디</TableHead>
                  <TableHead className="w-[120px] font-bold text-slate-700">성명</TableHead>
                  <TableHead className="w-[120px] font-bold text-slate-700">직책</TableHead>
                  <TableHead className="font-bold text-slate-700">담당 학반</TableHead>
                  <TableHead className="w-[130px] font-bold text-slate-700">메뉴 권한</TableHead>
                  <TableHead className="w-[140px] font-bold text-slate-700">등록일</TableHead>
                  <TableHead className="w-[160px] text-right font-bold text-slate-700">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filteredProfiles.length > 0 ? (
                  filteredProfiles.map((profile) => {
                    const targetRank = getProfileRank(profile);
                    const isThisUserMasterAdmin = targetRank === 1;
                    const isThisUserSubAdmin = targetRank === 2;
                    const isThisUserGeneralAdmin = targetRank === 3;
                    
                    // 상위 관리자만 하위 관리자/교직원의 권한 및 정보를 수정할 수 있음 (상위 > 하위)
                    const canManageThisUser = currentUserRank < targetRank;

                    const hasCustomPermissions = customPermissionsMap[profile.id] !== undefined;
                    const customCount = customPermissionsMap[profile.id]?.length;

                    return (
                      <TableRow key={profile.id} className="hover:bg-slate-50/70 transition-colors">
                        <TableCell className="font-bold text-blue-600">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 border",
                              isThisUserMasterAdmin 
                                ? "bg-amber-100 text-amber-800 border-amber-300" 
                                : isThisUserSubAdmin
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-blue-50 text-blue-600 border-blue-100"
                            )}>
                              {isThisUserMasterAdmin ? '👑' : isThisUserSubAdmin ? '🥈' : (profile.full_name?.[0] || profile.username?.[0] || '?')}
                            </div>
                            <span>{profile.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{profile.full_name}</span>
                            {isThisUserMasterAdmin ? (
                              <Badge className="text-[10px] font-black bg-amber-50 text-amber-800 border-amber-300 shadow-2xs py-0 px-1.5">
                                메인
                              </Badge>
                            ) : isThisUserSubAdmin ? (
                              <Badge className="text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs py-0 px-1.5">
                                서브
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isThisUserMasterAdmin ? (
                            <Badge className="text-xs font-black bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1 shadow-2xs py-1 px-2.5">
                              <Crown className="h-3 w-3 text-amber-600" />
                              메인관리자
                            </Badge>
                          ) : isThisUserSubAdmin ? (
                            <Badge className="text-xs font-black bg-indigo-50 text-indigo-800 border-indigo-200 flex items-center gap-1 shadow-2xs py-1 px-2.5">
                              <ShieldCheck className="h-3 w-3 text-indigo-600" />
                              서브관리자
                            </Badge>
                          ) : currentUserRank <= 2 && canManageThisUser ? (
                            <Select defaultValue={profile.role} onValueChange={(v) => handleRoleChange(profile.id, v)}>
                              <SelectTrigger className="h-8 w-[95px] text-xs font-semibold rounded-lg bg-white border-slate-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="admin" className="text-xs font-bold text-emerald-700">관리자</SelectItem>
                                <SelectItem value="teacher" className="text-xs font-bold text-slate-700">교직원</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={cn(
                              "text-xs font-bold py-1 px-2.5",
                              profile.role === 'admin' 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {profile.role === 'admin' ? '일반 관리자' : '교직원'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {profile.assigned_year ? (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-flex items-center gap-1">
                              {getDisplayAY(profile.assigned_year, profile.assigned_grade)}학년도 {profile.assigned_grade || 3}학년 {profile.assigned_major} {profile.assigned_class}
                            </span>
                          ) : (
                            <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-100">
                              비담임
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {hasCustomPermissions ? (
                            <Badge className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 w-fit">
                              <Sliders className="h-3 w-3" />
                              개별 ({customCount}개)
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200 w-fit">
                              기본 규칙
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">
                          {profile.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* 메뉴 권한 설정: 상위 관리자(1,2)가 하위 사용자 관리 시 가능 */}
                            {currentUserRank <= 2 && canManageThisUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" 
                                onClick={() => { setSelectedPermissionProfile(profile); setIsPermissionsOpen(true); }} 
                                title="메뉴 권한 개별 설정"
                              >
                                <Sliders className="h-4 w-4" />
                              </Button>
                            )}

                            {/* 담당 학반 설정: 상위 관리자만 하위 사용자 배정 가능 */}
                            {canManageThisUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50" 
                                onClick={() => { setSelectedProfile(profile); setIsAssignOpen(true); }} 
                                title="담당 학반 설정"
                              >
                                <GraduationCap className="h-4 w-4" />
                              </Button>
                            )}

                            {/* 비밀번호 초기화: 상위 관리자만 하위 사용자 초기화 가능 */}
                            {canManageThisUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                                title="비밀번호 초기화 (123123)"
                                disabled={isResetting === profile.id}
                                onClick={() => { setSelectedProfile(profile); setIsResetOpen(true); }}
                              >
                                {isResetting === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                              </Button>
                            )}

                            {/* 서브관리자 임명/해제: 오직 메인관리자만 가능 & 메인관리자 본인 제외 */}
                            {currentUserRank === 1 && !isThisUserMasterAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                  "h-8 w-8 rounded-lg transition-colors",
                                  isThisUserSubAdmin 
                                    ? "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" 
                                    : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                )}
                                onClick={() => handleToggleSubAdmin(profile.username)} 
                                title={isThisUserSubAdmin ? "서브관리자 해제" : "서브관리자 임명"}
                                disabled={isTogglingSubAdmin === profile.username}
                              >
                                {isTogglingSubAdmin === profile.username ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                              </Button>
                            )}

                            {/* 메인관리자 권한 이양: 오직 메인관리자만 가능 & 본인 제외 */}
                            {currentUserRank === 1 && !isThisUserMasterAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                                onClick={() => { setTransferTargetProfile(profile); setIsTransferModalOpen(true); }} 
                                title="메인관리자 권한 이양"
                              >
                                <Crown className="h-4 w-4" />
                              </Button>
                            )}

                            {/* 계정 삭제: 상위 관리자(1,2)가 하위 사용자 삭제 시 가능 */}
                            {currentUserRank <= 2 && canManageThisUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50" 
                                onClick={() => { setSelectedProfile(profile); setIsDeleteOpen(true); }}
                                title="사용자 삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center text-slate-400">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-medium">검색 조건에 일치하는 사용자가 없습니다.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* 모바일 카드 리스트 뷰 */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredProfiles.length > 0 ? (
              filteredProfiles.map((profile) => {
                const targetRank = getProfileRank(profile);
                const isThisUserMasterAdmin = targetRank === 1;
                const isThisUserSubAdmin = targetRank === 2;
                const isThisUserGeneralAdmin = targetRank === 3;
                
                // 상위 관리자만 하위 관리자/교직원의 권한 및 정보를 수정할 수 있음 (상위 > 하위)
                const canManageThisUser = currentUserRank < targetRank;
                const hasCustomPermissions = customPermissionsMap[profile.id] !== undefined;

                return (
                  <div key={profile.id} className="p-3.5 space-y-2.5 active:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border",
                          isThisUserMasterAdmin 
                            ? "bg-amber-100 text-amber-800 border-amber-300" 
                            : isThisUserSubAdmin
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {isThisUserMasterAdmin ? '👑' : isThisUserSubAdmin ? '🥈' : (profile.full_name?.[0] || profile.username?.[0] || '?')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-sm truncate">{profile.full_name}</h3>
                            {isThisUserMasterAdmin ? (
                              <Badge className="text-[9px] font-black bg-amber-50 text-amber-800 border-amber-300 shrink-0">
                                👑 메인관리자
                              </Badge>
                            ) : isThisUserSubAdmin ? (
                              <Badge className="text-[9px] font-black bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0">
                                🥈 서브관리자
                              </Badge>
                            ) : hasCustomPermissions ? (
                              <Badge className="text-[9px] font-bold px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                개별 권한
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-blue-600 font-medium truncate">{profile.username}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isThisUserMasterAdmin || isThisUserSubAdmin || !(currentUserRank <= 2 && canManageThisUser) ? (
                          <Badge className={cn(
                            "text-[10px] font-bold py-0.5 px-2",
                            isThisUserMasterAdmin 
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : isThisUserSubAdmin
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : profile.role === 'admin' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {isThisUserMasterAdmin ? '메인' : isThisUserSubAdmin ? '서브' : profile.role === 'admin' ? '관리자' : '교직원'}
                          </Badge>
                        ) : (
                          <Select defaultValue={profile.role} onValueChange={(v) => handleRoleChange(profile.id, v)}>
                            <SelectTrigger className="h-8 w-[80px] text-[10px] rounded-lg bg-white border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="admin" className="text-xs font-bold text-emerald-700">관리자</SelectItem>
                              <SelectItem value="teacher" className="text-xs font-bold text-slate-700">교직원</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 rounded-lg">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-200">
                            <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest">관리 메뉴</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {currentUserRank <= 2 && canManageThisUser && (
                              <DropdownMenuItem 
                                onSelect={() => { 
                                  (document.activeElement as HTMLElement)?.blur();
                                  setTimeout(() => {
                                    setSelectedPermissionProfile(profile); 
                                    setIsPermissionsOpen(true); 
                                  }, 50);
                                }} 
                                className="gap-2 font-medium cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50"
                              >
                                <Sliders className="h-4 w-4" /> 메뉴 권한 설정
                              </DropdownMenuItem>
                            )}
                            {canManageThisUser && (
                              <>
                                <DropdownMenuItem 
                                  onSelect={() => { 
                                    (document.activeElement as HTMLElement)?.blur();
                                    setTimeout(() => {
                                      setSelectedProfile(profile); 
                                      setIsAssignOpen(true); 
                                    }, 50);
                                  }} 
                                  className="gap-2 font-medium cursor-pointer text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                                >
                                  <GraduationCap className="h-4 w-4" /> 담당 학반 배정
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onSelect={() => { 
                                    (document.activeElement as HTMLElement)?.blur();
                                    setTimeout(() => {
                                      setSelectedProfile(profile); 
                                      setIsResetOpen(true); 
                                    }, 50);
                                  }} 
                                  className="gap-2 font-medium cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50"
                                >
                                  <KeyRound className="h-4 w-4" /> 비밀번호 초기화
                                </DropdownMenuItem>
                              </>
                            )}
                            {currentUserRank === 1 && !isThisUserMasterAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={() => handleToggleSubAdmin(profile.username)} 
                                  className="gap-2 font-medium text-indigo-700 focus:text-indigo-800 focus:bg-indigo-50 cursor-pointer"
                                >
                                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                                  {isThisUserSubAdmin ? '서브관리자 해제' : '서브관리자 임명'}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onSelect={() => { 
                                    (document.activeElement as HTMLElement)?.blur();
                                    setTimeout(() => {
                                      setTransferTargetProfile(profile); 
                                      setIsTransferModalOpen(true); 
                                    }, 50);
                                  }} 
                                  className="gap-2 font-medium text-amber-700 focus:text-amber-800 focus:bg-amber-50 cursor-pointer"
                                >
                                  <Crown className="h-4 w-4 text-amber-600" /> 메인관리자 권한 이양
                                </DropdownMenuItem>
                              </>
                            )}
                            {currentUserRank <= 2 && canManageThisUser && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={() => { 
                                    (document.activeElement as HTMLElement)?.blur();
                                    setTimeout(() => {
                                      setSelectedProfile(profile); 
                                      setIsDeleteOpen(true); 
                                    }, 50);
                                  }} 
                                  className="gap-2 font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" /> 계정 삭제
                                </DropdownMenuItem>
                              </>
                            )}
                            {!canManageThisUser && currentUserRank !== 1 && (
                              <div className="px-3 py-2 text-[11px] text-slate-400 font-medium text-center">
                                권한 제어 불가 (상위/동급)
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-slate-400">담당 학반</span>
                      {profile.assigned_year ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {getDisplayAY(profile.assigned_year, profile.assigned_grade)}학년도 {profile.assigned_grade || 3}학년 {profile.assigned_major} {profile.assigned_class}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">비담임</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center text-slate-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 초기화 확인 다이얼로그 */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl">
          <AlertDialogHeader className="p-5 border-b bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-slate-900">비밀번호 초기화</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-500 mt-0.5">
                  '{selectedProfile?.full_name || selectedProfile?.username}' 사용자의 비밀번호를 <strong className="text-amber-700 font-black">123123</strong>으로 초기화합니다.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-4 bg-slate-50 flex items-center justify-end gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-xs font-bold border-slate-200">취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedProfile && handleResetPassword(selectedProfile.id)} 
              className="h-9 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
            >
              초기화 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 계정 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl">
          <AlertDialogHeader className="p-5 border-b bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-slate-900">계정 삭제</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-500 mt-0.5">
                  '{selectedProfile?.full_name || selectedProfile?.username}' 사용자를 영구 삭제하시겠습니까?
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-4 bg-slate-50 flex items-center justify-end gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-xs font-bold border-slate-200">취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedProfile && handleDelete(selectedProfile.id)} 
              className="h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold"
            >
              삭제 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 담당 학반 설정 다이얼로그 */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[480px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  담당 학반 배정
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  <span className="font-bold text-slate-800">{selectedProfile?.full_name}</span> 선생님의 담당 학사 정보를 설정합니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">1. 학년도</Label>
                <Select value={assignAcademicYear} onValueChange={(v) => { setAssignAcademicYear(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-10 border-slate-200 rounded-xl">
                    <SelectValue placeholder="학년도" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {[baseYear - 2, baseYear - 1, baseYear, baseYear + 1, baseYear + 2].sort((a, b) => b - a).map(y => (
                      <SelectItem key={y} value={String(y)} className="text-xs">{y}학년도</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">2. 학년</Label>
                <Select value={assignGrade} onValueChange={(v) => { setAssignGrade(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-10 border-slate-200 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="1" className="text-xs">1학년</SelectItem>
                    <SelectItem value="2" className="text-xs">2학년</SelectItem>
                    <SelectItem value="3" className="text-xs">3학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">3. 학과 선택</Label>
              <Select value={assignMajor} onValueChange={(v) => { setAssignMajor(v); setAssignClass(''); }} disabled={!assignAcademicYear}>
                <SelectTrigger className="w-full h-10 border-slate-200 rounded-xl">
                  <SelectValue placeholder={assignAcademicYear ? "학과를 선택하세요" : "학년도를 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableMajors.length > 0 ? (
                    availableMajors.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled className="text-xs">해당 연도 데이터 없음</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">4. 반 선택</Label>
              <Select value={assignClass} onValueChange={setAssignClass} disabled={!assignMajor || assignMajor === 'none'}>
                <SelectTrigger className="w-full h-10 border-slate-200 rounded-xl">
                  <SelectValue placeholder={assignMajor ? "반을 선택하세요" : "학과를 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableClasses.map(c => <SelectItem key={c} value={c} className="text-xs">{c}반</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {calculatedGradYear && (
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 flex items-center gap-2.5 text-xs text-blue-800">
                <div className="h-5 w-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-blue-600">i</span>
                </div>
                <span>
                  선택 시 <strong className="underline underline-offset-2">{calculatedGradYear}년 졸업 예정자</strong> 데이터와 실시간 연결됩니다.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <div>
              {selectedProfile?.assigned_year && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClearAssign} 
                  className="h-9 px-3 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"
                >
                  배정 해제
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsAssignOpen(false)} 
                className="h-9 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </Button>
              <Button 
                type="button" 
                onClick={handleAssignSave} 
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                설정 저장
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 메인관리자 권한 이양 확인 다이얼로그 */}
      <AlertDialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[440px] rounded-2xl p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl">
          <AlertDialogHeader className="p-5 border-b bg-amber-50/70">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                <Crown className="h-6 w-6" />
              </div>
              <div className="text-left">
                <AlertDialogTitle className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  메인관리자 권한 이양
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-amber-900 font-medium mt-0.5">
                  최고 관리자 최종 제어권을 다른 교직원에게 이양합니다.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="p-5 space-y-3.5 bg-white text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">현재 메인관리자</span>
                <span className="font-bold text-slate-800">{currentMasterAdmin?.name} ({currentMasterAdmin?.username})</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between items-center">
                <span className="text-amber-700 font-bold">이양 대상자</span>
                <span className="font-black text-blue-600 text-sm">
                  {transferTargetProfile?.full_name || transferTargetProfile?.username} ({transferTargetProfile?.username})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1 text-[11px]">
                ⚠️ 권한 이양 시 유의사항
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-700">
                <li>이양 즉시 대상자에게 <strong>사용자 생성/삭제 및 권한 설정의 최종 권한</strong>이 부여됩니다.</li>
                <li>본인 계정은 <strong>일반 관리자</strong>로 전환됩니다.</li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferMasterAdmin}
              className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs gap-1.5"
            >
              <Crown className="h-3.5 w-3.5" />
              권한 이양 확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 사용자별 메뉴 권한 설정 모달 */}
      <UserPermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
        profile={selectedPermissionProfile}
        customPermissionsMap={customPermissionsMap}
        subAdminList={currentSubAdmins}
        onSaved={(newMap) => setCustomPermissionsMap(newMap)}
      />
    </div>
  );
}
