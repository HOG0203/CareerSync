'use client';

import * as React from 'react';
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
  AlertDialogTrigger,
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
import { Trash2, GraduationCap, KeyRound, Loader2, MoreVertical, Search, Filter } from 'lucide-react';
import { updateUserRole, deleteUser, updateAssignedClass, resetUserPassword } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from 'next/navigation';

interface UserTableProps {
  initialProfiles: any[];
  graduationYears: number[];
  fullClassMapping: { year: number, major: string, className: string }[];
  baseYear: number;
}

export function UserTable({ initialProfiles, graduationYears, fullClassMapping, baseYear }: UserTableProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = React.useState(initialProfiles);

  // 서버 컴포넌트에서 전달된 initialProfiles 갱신 시 로컬 상태 동기화
  React.useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'all' | 'admin' | 'teacher'>('all');
  const [isAssignOpen, setIsAssignOpen] = React.useState(false);
  const [selectedProfile, setSelectedProfile] = React.useState<any>(null);
  const [isResetting, setIsResetting] = React.useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetOpen] = React.useState(false);

  // 필터링된 데이터
  const filteredProfiles = React.useMemo(() => {
    return profiles.filter(p => {
      const matchesSearch = 
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.username?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, searchTerm, roleFilter]);
  
  // 배정용 선택 상태
  const [assignAcademicYear, setAssignAcademicYear] = React.useState<string>('');
  const [assignGrade, setAssignGrade] = React.useState<string>('3');
  const [assignMajor, setAssignMajor] = React.useState<string>('');
  const [assignClass, setAssignClass] = React.useState<string>('');

  const { toast } = useToast();

  /**
   * 계산된 졸업연도 (GY = AY + (4 - G))
   * 예: 2026학년도 3학년 -> 2026 + 1 = 2027년 졸업
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
      // AY = GY - (4 - G)
      const ay = gy - (4 - grade);

      setAssignAcademicYear(String(ay));
      setAssignGrade(String(grade));
      setAssignMajor(selectedProfile.assigned_major || '');
      setAssignClass(selectedProfile.assigned_class || '');
    }
  }, [selectedProfile, isAssignOpen, baseYear]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      toast({ title: '역할 변경 완료' });
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: '변경 실패', description: result.error });
    }
  };

  const handleAssignSave = async () => {
    if (!assignAcademicYear || !assignGrade || !assignMajor || !assignClass || !calculatedGradYear) {
      toast({ variant: 'destructive', title: '입력 부족', description: '모든 정보를 선택해주세요.' });
      return;
    }

    const data = {
      year: calculatedGradYear,
      major: assignMajor,
      className: assignClass,
      grade: parseInt(assignGrade)
    };

    const result = await updateAssignedClass(selectedProfile.id, data);
    if (result.success) {
      setProfiles(prev => prev.map(p => p.id === selectedProfile.id ? { 
        ...p, 
        assigned_year: data.year, 
        assigned_major: data.major, 
        assigned_class: data.className,
        assigned_grade: data.grade
      } : p));
      toast({ title: '담당 학반 설정 완료' });
      setIsAssignOpen(false);
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: '설정 실패', description: result.error });
    }
  };

  const handleClearAssign = async () => {
    if (!selectedProfile) return;

    const data = {
      year: null,
      major: null,
      className: null,
      grade: null
    };

    const result = await updateAssignedClass(selectedProfile.id, data);
    if (result.success) {
      setProfiles(prev => prev.map(p => p.id === selectedProfile.id ? { 
        ...p, 
        assigned_year: null, 
        assigned_major: null, 
        assigned_class: null,
        assigned_grade: null
      } : p));
      toast({ title: '담당 학반 배정 해제 완료' });
      setIsAssignOpen(false);
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: '해제 실패', description: result.error });
    }
  };

  const handleDelete = async (userId: string) => {
    const result = await deleteUser(userId);
    if (result.success) {
      setProfiles(prev => prev.filter(p => p.id !== userId));
      toast({ title: '계정 삭제 완료' });
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
    }
  };

  const handleResetPassword = async (userId: string) => {
    setIsResetting(userId);
    try {
      const result = await resetUserPassword(userId);
      if (result.success) {
        toast({ 
          title: '비밀번호 초기화 완료', 
          description: '비밀번호가 123123으로 초기화되었습니다.' 
        });
      } else {
        toast({ 
          variant: 'destructive', 
          title: '초기화 실패', 
          description: result.error 
        });
      }
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: '오류 발생', 
        description: '비밀번호 초기화 중 알 수 없는 오류가 발생했습니다.' 
      });
    } finally {
      setIsResetting(null);
    }
  };

  // 표시용 학년도 계산 (AY = GY - (4 - G))
  const getDisplayAY = (gy: number, g: number) => {
    return gy - (4 - (g || 3));
  };

  return (
    <>
      <div className="p-4 border-b space-y-4">
        {/* 검색 및 필터 UI */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="이름 또는 아이디로 검색..." 
              className="pl-9 h-10 border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setRoleFilter('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                roleFilter === 'all' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              전체
            </button>
            <button 
              onClick={() => setRoleFilter('admin')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                roleFilter === 'admin' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              관리자
            </button>
            <button 
              onClick={() => setRoleFilter('teacher')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                roleFilter === 'teacher' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              교직원
            </button>
          </div>
        </div>
      </div>

      {/* 데스크톱 테이블 뷰 */}
      <div className="hidden md:block">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[150px]">아이디</TableHead>
              <TableHead>성명</TableHead>
              <TableHead className="w-[120px]">권한</TableHead>
              <TableHead>담당 학반</TableHead>
              <TableHead className="w-[180px]">등록일</TableHead>
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.map((profile) => (
              <TableRow key={profile.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-medium text-blue-600">{profile.username}</TableCell>
                <TableCell>{profile.full_name}</TableCell>
                <TableCell>
                  <Select defaultValue={profile.role} onValueChange={(v) => handleRoleChange(profile.id, v)}>
                    <SelectTrigger className="h-8 w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin" className="text-xs">관리자</SelectItem>
                      <SelectItem value="teacher" className="text-xs">교직원</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">
                  {profile.assigned_year ? (
                    <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-flex items-center gap-1">
                      {getDisplayAY(profile.assigned_year, profile.assigned_grade)}학년도 {profile.assigned_grade || 3}학년 {profile.assigned_major} {profile.assigned_class}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">미지정</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {profile.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setSelectedProfile(profile); setIsAssignOpen(true); }} title="담당 학반 설정">
                      <GraduationCap className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                      title="비밀번호 초기화 (123123)"
                      disabled={isResetting === profile.id}
                      onClick={() => { setSelectedProfile(profile); setIsResetOpen(true); }}
                    >
                      {isResetting === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => { setSelectedProfile(profile); setIsDeleteOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 뷰 */}
      <div className="md:hidden divide-y">
        {filteredProfiles.length > 0 ? (
          filteredProfiles.map((profile) => (
            <div key={profile.id} className="p-4 space-y-3 active:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                    {profile.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{profile.full_name}</h3>
                    <p className="text-xs text-blue-600 font-medium">{profile.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select defaultValue={profile.role} onValueChange={(v) => handleRoleChange(profile.id, v)}>
                    <SelectTrigger className="h-8 w-[80px] text-[10px] rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin" className="text-xs">관리자</SelectItem>
                      <SelectItem value="teacher" className="text-xs">교직원</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-xl">
                      <DropdownMenuLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest">관리 메뉴</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onSelect={() => { 
                          (document.activeElement as HTMLElement)?.blur();
                          setTimeout(() => {
                            setSelectedProfile(profile); 
                            setIsAssignOpen(true); 
                          }, 50);
                        }} 
                        className="gap-2 font-medium cursor-pointer"
                      >
                        <GraduationCap className="h-4 w-4 text-blue-500" /> 담당 학반 배정
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={() => { 
                          (document.activeElement as HTMLElement)?.blur();
                          setTimeout(() => {
                            setSelectedProfile(profile); 
                            setIsResetOpen(true); 
                          }, 50);
                        }} 
                        className="gap-2 font-medium cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4 text-amber-500" /> 비밀번호 초기화
                      </DropdownMenuItem>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">담당 학반</p>
                {profile.assigned_year ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    {getDisplayAY(profile.assigned_year, profile.assigned_grade)}학년도 {profile.assigned_grade || 3}학년 {profile.assigned_major} {profile.assigned_class}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">미지정</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  {profile.created_at ? format(new Date(profile.created_at), 'yyyy-MM-dd') : '-'} 등록
                </span>
                {profile.role === 'admin' && (
                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase">Administrator</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center text-slate-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {/* 비밀번호 초기화 확인 다이얼로그 */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>비밀번호 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              '{selectedProfile?.full_name}' 사용자의 비밀번호를 <span className="font-bold text-rose-600 underline">123123</span>으로 초기화하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedProfile && handleResetPassword(selectedProfile.id)} className="bg-amber-600 hover:bg-amber-700 rounded-xl text-white">초기화 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 계정 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>계정 삭제</AlertDialogTitle>
            <AlertDialogDescription>'{selectedProfile?.full_name}' 사용자를 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedProfile && handleDelete(selectedProfile.id)} className="bg-rose-600 hover:bg-rose-700 rounded-xl text-white">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 mr-6">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-slate-900 truncate">
                  담당 학반 설정
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wide mt-0.5 truncate">
                  {selectedProfile?.full_name} 선생님의 담당 학사 정보 설정
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">1. 학년도</Label>
                <Select value={assignAcademicYear} onValueChange={(v) => { setAssignAcademicYear(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl focus:ring-blue-500">
                    <SelectValue placeholder="학년도" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {[baseYear - 2, baseYear - 1, baseYear, baseYear + 1, baseYear + 2].sort((a, b) => b - a).map(y => (
                      <SelectItem key={y} value={String(y)} className="text-sm">{y}학년도</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">2. 학년</Label>
                <Select value={assignGrade} onValueChange={(v) => { setAssignGrade(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="1" className="text-sm">1학년</SelectItem>
                    <SelectItem value="2" className="text-sm">2학년</SelectItem>
                    <SelectItem value="3" className="text-sm">3학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">3. 학과 선택</Label>
              <Select value={assignMajor} onValueChange={(v) => { setAssignMajor(v); setAssignClass(''); }} disabled={!assignAcademicYear}>
                <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl focus:ring-blue-500">
                  <SelectValue placeholder={assignAcademicYear ? "학과를 선택하세요" : "학년도를 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableMajors.length > 0 ? (
                    availableMajors.map(m => <SelectItem key={m} value={m} className="text-sm">{m}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled>해당 연도 데이터 없음</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">4. 반 선택</Label>
              <Select value={assignClass} onValueChange={setAssignClass} disabled={!assignMajor || assignMajor === 'none'}>
                <SelectTrigger className="w-full h-11 border-slate-200 rounded-xl focus:ring-blue-500">
                  <SelectValue placeholder={assignMajor ? "반을 선택하세요" : "학과를 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableClasses.map(c => <SelectItem key={c} value={c} className="text-sm">{c}반</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {calculatedGradYear && (
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="h-5 w-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">i</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  위 설정은 <span className="font-black underline underline-offset-2">{calculatedGradYear}년 졸업 예정자</span> 데이터와 실시간으로 연결됩니다.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex flex-row gap-2 mt-0">
            <Button variant="ghost" onClick={() => setIsAssignOpen(false)} className="flex-1 rounded-xl h-11 font-bold">취소</Button>
            {selectedProfile?.assigned_year ? (
              <Button variant="outline" onClick={handleClearAssign} className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl h-11 font-black">배정 해제</Button>
            ) : null}
            <Button onClick={handleAssignSave} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 rounded-xl font-black h-11 shadow-lg shadow-blue-100">설정 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
