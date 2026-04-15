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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, GraduationCap, KeyRound, Loader2 } from 'lucide-react';
import { updateUserRole, deleteUser, updateAssignedClass, resetUserPassword } from './actions';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface UserTableProps {
  initialProfiles: any[];
  graduationYears: number[];
  fullClassMapping: { year: number, major: string, className: string }[];
  baseYear: number;
}

export function UserTable({ initialProfiles, graduationYears, fullClassMapping, baseYear }: UserTableProps) {
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = React.useState(initialProfiles);
  const [isAssignOpen, setIsAssignOpen] = React.useState(false);
  const [selectedProfile, setSelectedProfile] = React.useState<any>(null);
  const [isResetting, setIsResetting] = React.useState<string | null>(null);
  
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
    } else {
      toast({ variant: 'destructive', title: '해제 실패', description: result.error });
    }
  };

  const handleDelete = async (userId: string) => {
    const result = await deleteUser(userId);
    if (result.success) {
      setProfiles(prev => prev.filter(p => p.id !== userId));
      toast({ title: '계정 삭제 완료' });
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
            {profiles.map((profile) => (
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

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                          title="비밀번호 초기화 (123123)"
                          disabled={isResetting === profile.id}
                        >
                          {isResetting === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>비밀번호 초기화</AlertDialogTitle>
                          <AlertDialogDescription>
                            '{profile.full_name}' 사용자의 비밀번호를 <span className="font-bold text-rose-600 underline">123123</span>으로 초기화하시겠습니까?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleResetPassword(profile.id)} className="bg-amber-600 hover:bg-amber-700 rounded-xl">초기화 실행</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>계정 삭제</AlertDialogTitle>
                          <AlertDialogDescription>'{profile.full_name}' 사용자를 삭제하시겠습니까?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(profile.id)} className="bg-rose-600 hover:bg-rose-700 rounded-xl">삭제</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 모바일 카드 리스트 뷰 */}
      <div className="md:hidden divide-y">
        {profiles.map((profile) => (
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
              <Select defaultValue={profile.role} onValueChange={(v) => handleRoleChange(profile.id, v)}>
                <SelectTrigger className="h-8 w-[80px] text-[10px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">관리자</SelectItem>
                  <SelectItem value="teacher" className="text-xs">교직원</SelectItem>
                </SelectContent>
              </Select>
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 border-blue-100 text-blue-600 font-bold" onClick={() => { setSelectedProfile(profile); setIsAssignOpen(true); }}>
                  <GraduationCap className="h-3.5 w-3.5" /> 배정
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs gap-1.5 border-amber-100 text-amber-600 font-bold" disabled={isResetting === profile.id}>
                      {isResetting === profile.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} 비번초기화
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>비밀번호 초기화</AlertDialogTitle>
                      <AlertDialogDescription>
                        '{profile.full_name}' 사용자의 비밀번호를 <span className="font-bold text-rose-600 underline">123123</span>으로 초기화하시겠습니까?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleResetPassword(profile.id)} className="bg-amber-600 hover:bg-amber-700 rounded-xl">초기화 실행</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-rose-100 text-rose-500 hover:bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-[400px] rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>계정 삭제</AlertDialogTitle>
                      <AlertDialogDescription>'{profile.full_name}' 사용자를 삭제하시겠습니까?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">취소</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(profile.id)} className="bg-rose-600 hover:bg-rose-700 rounded-xl">삭제</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="w-[95vw] max-w-[400px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
            <DialogTitle>담당 학반 설정</DialogTitle>
            <DialogDescription className="text-indigo-100 text-xs">{selectedProfile?.full_name} 선생님의 담당 정보를 선택하세요.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. 학년도 선택</Label>
                <Select value={assignAcademicYear} onValueChange={(v) => { setAssignAcademicYear(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-10 border-slate-200"><SelectValue placeholder="학년도" /></SelectTrigger>
                  <SelectContent>
                    {[baseYear - 2, baseYear - 1, baseYear, baseYear + 1, baseYear + 2].sort((a, b) => b - a).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}학년도</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. 학년 선택</Label>
                <Select value={assignGrade} onValueChange={(v) => { setAssignGrade(v); setAssignMajor(''); setAssignClass(''); }}>
                  <SelectTrigger className="w-full h-10 border-slate-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1학년</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="3">3학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">3. 학과 선택</Label>
              <Select value={assignMajor} onValueChange={(v) => { setAssignMajor(v); setAssignClass(''); }} disabled={!assignAcademicYear}>
                <SelectTrigger className="w-full h-10 border-slate-200"><SelectValue placeholder={assignAcademicYear ? "학과 선택" : "학년도를 먼저 선택하세요"} /></SelectTrigger>
                <SelectContent>
                  {availableMajors.length > 0 ? (
                    availableMajors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled>해당 연도 데이터 없음</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">4. 반 선택</Label>
              <Select value={assignClass} onValueChange={setAssignClass} disabled={!assignMajor || assignMajor === 'none'}>
                <SelectTrigger className="w-full h-10 border-slate-200"><SelectValue placeholder={assignMajor ? "반 선택" : "학과를 먼저 선택하세요"} /></SelectTrigger>
                <SelectContent>
                  {availableClasses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {calculatedGradYear && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700 font-medium">
                * 위 설정은 <span className="font-bold">{calculatedGradYear}년 졸업 예정자</span> 데이터와 연결됩니다.
              </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row gap-2 mt-0">
            <div className="flex flex-row gap-2 w-full">
              <Button variant="ghost" onClick={() => setIsAssignOpen(false)} className="flex-1 rounded-xl h-11 px-0">취소</Button>
              {selectedProfile?.assigned_year && (
                <Button variant="outline" onClick={handleClearAssign} className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl h-11 px-0 font-bold">배정 해제</Button>
              )}
              <Button onClick={handleAssignSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold h-11 px-0 shadow-lg shadow-indigo-100">설정 저장</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
