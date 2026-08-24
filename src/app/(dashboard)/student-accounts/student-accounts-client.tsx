'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { resetStudentPasswordAction } from '@/lib/student-accounts';
import { getMajorOrderIndex } from '@/lib/student-utils';
import { updateStudentField } from '@/app/students/actions';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { 
  KeyRound, 
  Users, 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Lock, 
  Unlock, 
  Clock, 
  Loader2,
  PhoneOff,
  Edit2,
  Check,
  X,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface StudentAccountRow {
  id: string;
  student_name: string;
  graduation_year: number;

  grade: number;
  major: string;
  class_info: string;
  student_number: string;
  phone_number: string | null;
  has_custom_password: boolean;
  password_changed_at: string | null;
  last_login_at: string | null;
  login_count: number;
  last_reset_at: string | null;
}

interface StudentAccountsClientProps {
  initialStudents: StudentAccountRow[];
  baseYear: number;
  isAdmin: boolean;
  teacherGrade?: number | null;
  teacherMajor?: string | null;
  teacherClass?: string | null;
}

export function StudentAccountsClient({
  initialStudents,
  baseYear,
  isAdmin,
  teacherGrade,
  teacherMajor,
  teacherClass,
}: StudentAccountsClientProps) {
  const { toast } = useToast();
  const [students, setStudents] = React.useState<StudentAccountRow[]>(initialStudents);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedGrade, setSelectedGrade] = React.useState<string>(
    teacherGrade ? teacherGrade.toString() : 'all'
  );
  const [selectedMajor, setSelectedMajor] = React.useState<string>(
    teacherMajor ? teacherMajor : 'all'
  );
  const [selectedClass, setSelectedClass] = React.useState<string>(
    teacherClass ? teacherClass : 'all'
  );

  const [passwordFilter, setPasswordFilter] = React.useState<string>('all');
  const [pageSize, setPageSize] = React.useState<string>('50'); // 기본 50명씩 보기
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  const [resetTarget, setResetTarget] = React.useState<StudentAccountRow | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  // 연락처 인라인 수정 상태
  const [editingStudentId, setEditingStudentId] = React.useState<string | null>(null);
  const [phoneInputValue, setPhoneInputValue] = React.useState<string>('');
  const [isSavingPhone, setIsSavingPhone] = React.useState(false);

  // 필터 변경 시 1페이지로 리셋
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedGrade, selectedMajor, selectedClass, passwordFilter, searchTerm, pageSize]);


  // 전화번호 포맷터
  const formatPhoneNumber = (value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
  };

  const handleStartEditPhone = (student: StudentAccountRow) => {
    setEditingStudentId(student.id);
    setPhoneInputValue(student.phone_number || '');
  };

  const handleCancelEditPhone = () => {
    setEditingStudentId(null);
    setPhoneInputValue('');
  };

  const handleSavePhone = async (student: StudentAccountRow) => {
    setIsSavingPhone(true);
    const cleanPhone = phoneInputValue.trim() ? formatPhoneNumber(phoneInputValue) : null;

    const result = await updateStudentField(student.id, 'phone_number', cleanPhone);
    setIsSavingPhone(false);

    if (result.success) {
      toast({
        title: '연락처 수정 완료',
        description: `${student.student_name} 학생의 연락처가 ${cleanPhone ? cleanPhone : '(미등록)'}으로 저장되었습니다.`,
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? {
                ...s,
                phone_number: cleanPhone,
              }
            : s
        )
      );
      setEditingStudentId(null);
    } else {
      toast({
        title: '수정 실패',
        description: result.error || '연락처 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 1. 실제 재학생 데이터에 존재하는 학년 목록 추출
  const gradeOptions = React.useMemo(() => {
    const set = new Set<number>();
    initialStudents.forEach((s) => {
      if (s.grade) set.add(s.grade);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [initialStudents]);

  // 2. 실제 재학생 데이터에 존재하는 학과 목록 추출 (선택된 학년 반영)
  const majorOptions = React.useMemo(() => {
    const set = new Set<string>();
    initialStudents.forEach((s) => {
      if (selectedGrade !== 'all' && s.grade.toString() !== selectedGrade) return;
      if (s.major && s.major.trim()) set.add(s.major.trim());
    });
    return Array.from(set).sort((a, b) => {
      const orderA = getMajorOrderIndex(a);
      const orderB = getMajorOrderIndex(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b, 'ko');
    });
  }, [initialStudents, selectedGrade]);

  // 3. 실제 재학생 데이터에 존재하는 반 목록 추출 (선택된 학년 & 학과 반영)
  const classOptions = React.useMemo(() => {
    const set = new Set<string>();
    initialStudents.forEach((s) => {
      if (selectedGrade !== 'all' && s.grade.toString() !== selectedGrade) return;
      if (selectedMajor !== 'all') {
        const sMajor = (s.major || '').trim();
        const selMajor = selectedMajor.trim();
        if (sMajor !== selMajor && !sMajor.includes(selMajor) && !selMajor.includes(sMajor)) {
          return;
        }
      }
      if (s.class_info) set.add(s.class_info);
    });
    return Array.from(set).sort((a, b) => parseInt(a || '0') - parseInt(b || '0'));
  }, [initialStudents, selectedGrade, selectedMajor]);

  // 학과나 반이 현재 옵션에 없으면 'all'로 자동 초기화
  React.useEffect(() => {
    if (selectedMajor !== 'all' && !majorOptions.includes(selectedMajor)) {
      setSelectedMajor('all');
    }
  }, [selectedGrade, majorOptions, selectedMajor]);

  React.useEffect(() => {
    if (selectedClass !== 'all' && !classOptions.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [selectedGrade, selectedMajor, classOptions, selectedClass]);

  // 필터링 및 자연어 숫자 정렬
  const filteredStudents = React.useMemo(() => {
    const list = students.filter((s) => {
      if (selectedGrade !== 'all' && s.grade.toString() !== selectedGrade) return false;
      if (selectedMajor !== 'all') {
        const sMajor = (s.major || '').trim();
        const selMajor = selectedMajor.trim();
        if (sMajor !== selMajor && !sMajor.includes(selMajor) && !selMajor.includes(sMajor)) {
          return false;
        }
      }
      if (selectedClass !== 'all' && s.class_info !== selectedClass) return false;
      if (passwordFilter === 'custom' && !s.has_custom_password) return false;
      if (passwordFilter === 'default' && s.has_custom_password) return false;
      if (passwordFilter === 'no_phone' && s.phone_number) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nameMatch = s.student_name.toLowerCase().includes(term);
        const numMatch = (s.student_number || '').includes(term);
        const majorMatch = (s.major || '').toLowerCase().includes(term);
        return nameMatch || numMatch || majorMatch;
      }


      return true;
    });

    return list.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;

      const majorOrderA = getMajorOrderIndex(a.major);
      const majorOrderB = getMajorOrderIndex(b.major);
      if (majorOrderA !== majorOrderB) return majorOrderA - majorOrderB;
      if (a.major !== b.major) return a.major.localeCompare(b.major, 'ko');

      const classA = parseInt(a.class_info.replace(/[^0-9]/g, ''), 10) || 0;
      const classB = parseInt(b.class_info.replace(/[^0-9]/g, ''), 10) || 0;
      if (classA !== classB) return classA - classB;

      const numA = parseInt(a.student_number.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.student_number.replace(/[^0-9]/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;

      return a.student_name.localeCompare(b.student_name, 'ko');
    });
  }, [students, selectedGrade, selectedMajor, selectedClass, passwordFilter, searchTerm]);




  // 통계 계산
  const stats = React.useMemo(() => {
    const total = filteredStudents.length;
    const customCount = filteredStudents.filter((s) => s.has_custom_password).length;
    const noPhoneCount = filteredStudents.filter((s) => !s.phone_number).length;
    const activeCount = filteredStudents.filter((s) => s.login_count > 0).length;

    return { total, customCount, noPhoneCount, activeCount };
  }, [filteredStudents]);

  // 페이지네이션 계산
  const limit = pageSize === 'all' ? filteredStudents.length : parseInt(pageSize);
  const totalPages = pageSize === 'all' || limit <= 0 ? 1 : Math.max(1, Math.ceil(filteredStudents.length / limit));

  const paginatedStudents = React.useMemo(() => {
    if (pageSize === 'all') return filteredStudents;
    const start = (currentPage - 1) * limit;
    return filteredStudents.slice(start, start + limit);
  }, [filteredStudents, currentPage, pageSize, limit]);

  const startIndex = filteredStudents.length === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endIndex = pageSize === 'all' ? filteredStudents.length : Math.min(currentPage * limit, filteredStudents.length);

  // 비밀번호 초기화 실행 (낙관적 UI 업데이트 - 즉시 완료 처리)
  const handleConfirmReset = async () => {
    if (!resetTarget) return;

    const targetStudent = resetTarget;
    setResetTarget(null); // 확인 다이얼로그 즉시 닫기

    // 1. 낙관적 UI 업데이트: 즉시 화면의 상태 배지를 '기본'으로 전환
    const prevStudents = [...students];
    setStudents((prev) =>
      prev.map((s) =>
        s.id === targetStudent.id
          ? {
              ...s,
              has_custom_password: false,
              password_changed_at: null,
              last_reset_at: new Date().toISOString(),
            }
          : s
      )
    );

    // 2. 서버 액션 실행
    try {
      const result = await resetStudentPasswordAction(targetStudent.id);
      if (result.success) {
        toast({
          title: '비밀번호 초기화 완료',
          description: result.message,
        });
      } else {
        // 실패 시 이전 상태로 롤백
        setStudents(prevStudents);
        toast({
          title: '초기화 실패',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setStudents(prevStudents);
      toast({
        title: '초기화 실패',
        description: err?.message || '비밀번호 초기화 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="space-y-6">
      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">조회 학생수</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">로그인 이력 있음</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{stats.activeCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">비밀번호 직접 변경</p>
              <p className="text-2xl font-black text-indigo-600 mt-1">{stats.customCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Lock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">연락처 미등록 (로그인불가)</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{stats.noPhoneCount}명</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <PhoneOff className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 & 검색 바 */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
              {isAdmin && (
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="w-[110px] h-9 text-xs">
                    <SelectValue placeholder="학년" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">전체 학년</SelectItem>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g} value={g.toString()} className="text-xs">
                        {g}학년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {isAdmin && (
                <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                  <SelectTrigger className="w-[130px] h-9 text-xs">
                    <SelectValue placeholder="학과" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">전체 학과</SelectItem>
                    {majorOptions.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}


              {isAdmin && (
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-[100px] h-9 text-xs">
                    <SelectValue placeholder="반" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">전체 반</SelectItem>
                    {classOptions.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}반
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}


              <Select value={passwordFilter} onValueChange={setPasswordFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="비밀번호 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">전체 상태</SelectItem>
                  <SelectItem value="custom" className="text-xs">학생 직접 변경</SelectItem>
                  <SelectItem value="default" className="text-xs">기본 비밀번호 (초기)</SelectItem>
                  <SelectItem value="no_phone" className="text-xs">연락처 미등록</SelectItem>
                </SelectContent>
              </Select>

              {/* 페이지당 보기 개수 드롭다운 (기본 50명) */}
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-[125px] h-9 text-xs bg-slate-50">
                  <SelectValue placeholder="보기 개수" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50" className="text-xs">50명씩 보기</SelectItem>
                  <SelectItem value="100" className="text-xs">100명씩 보기</SelectItem>
                  <SelectItem value="all" className="text-xs">전체보기</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="이름, 번호, 학번 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 학생 목록 테이블 */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <Table className="w-full min-w-[900px]">
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-3">학년</TableHead>
                  <TableHead className="text-xs font-bold whitespace-nowrap py-3 px-3">학과</TableHead>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-2">반</TableHead>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-2">번호</TableHead>
                  <TableHead className="text-xs font-bold whitespace-nowrap py-3 px-3">이름</TableHead>
                  <TableHead className="text-xs font-bold whitespace-nowrap py-3 px-4">연락처</TableHead>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-3">비밀번호상태</TableHead>
                  <TableHead className="text-xs font-bold whitespace-nowrap py-3 px-4">최근로그인일시</TableHead>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-3">접속수</TableHead>
                  <TableHead className="text-center text-xs font-bold whitespace-nowrap py-3 px-3">비밀번호관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-xs text-slate-500 whitespace-nowrap">
                      조건에 맞는 학생 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStudents.map((student) => {
                    const phoneLast4 = student.phone_number
                      ? student.phone_number.replace(/[^0-9]/g, '').slice(-4)
                      : null;

                    return (
                      <TableRow key={student.id} className="hover:bg-slate-50/80 text-xs">
                        {/* 1. 학년 */}
                        <TableCell className="text-center font-medium whitespace-nowrap py-2.5 px-3">
                          {student.grade}학년
                        </TableCell>
                        {/* 2. 학과 */}
                        <TableCell className="text-slate-700 whitespace-nowrap py-2.5 px-3">
                          {student.major}
                        </TableCell>
                        {/* 3. 반 */}
                        <TableCell className="text-center font-medium whitespace-nowrap py-2.5 px-2">
                          {student.class_info}반
                        </TableCell>
                        {/* 4. 번호 */}
                        <TableCell className="text-center font-semibold text-slate-700 whitespace-nowrap py-2.5 px-2">
                          {student.student_number}번
                        </TableCell>
                        {/* 5. 이름 */}
                        <TableCell className="font-bold text-slate-900 whitespace-nowrap py-2.5 px-3">
                          {student.student_name}
                        </TableCell>
                        {/* 6. 연락처 */}
                        <TableCell className="whitespace-nowrap py-2 px-4">
                          {editingStudentId === student.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Input
                                autoFocus
                                type="text"
                                placeholder="010-0000-0000"
                                value={phoneInputValue}
                                onChange={(e) => setPhoneInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePhone(student);
                                  if (e.key === 'Escape') handleCancelEditPhone();
                                }}
                                disabled={isSavingPhone}
                                className="h-7 w-32 text-xs px-2 font-mono"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSavePhone(student)}
                                disabled={isSavingPhone}
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                              >
                                {isSavingPhone ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEditPhone}
                                disabled={isSavingPhone}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : student.phone_number ? (
                            <div className="group/phone inline-flex items-center gap-1.5 font-mono">
                              <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{student.phone_number}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 shrink-0 font-normal">
                                뒷4자리: {phoneLast4}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEditPhone(student)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded shrink-0 opacity-70 group-hover/phone:opacity-100 transition-opacity"
                                title="연락처 수정"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartEditPhone(student)}
                              className="h-6 px-2 text-[11px] font-normal text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:text-amber-800 shrink-0"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              연락처 등록
                            </Button>
                          )}
                        </TableCell>

                        {/* 7. 비밀번호상태 */}
                        <TableCell className="text-center whitespace-nowrap py-2.5 px-3">
                          {student.has_custom_password ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 text-[11px] px-2 py-0.5 font-medium shrink-0">
                                <Lock className="h-3 w-3 mr-1 shrink-0" />
                                변경됨
                              </Badge>
                              {student.password_changed_at && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({format(new Date(student.password_changed_at), 'MM/dd HH:mm')})
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-slate-600 text-[11px] px-2 py-0.5 font-normal shrink-0">
                              기본 (뒷4자리)
                            </Badge>
                          )}
                        </TableCell>

                        {/* 8. 최근로그인일시 */}
                        <TableCell className="text-slate-600 whitespace-nowrap py-2.5 px-4">
                          {student.last_login_at ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>
                                {format(new Date(student.last_login_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">접속 이력 없음</span>
                          )}
                        </TableCell>

                        {/* 9. 접속수 */}
                        <TableCell className="text-center font-bold text-slate-800 whitespace-nowrap py-2.5 px-3">
                          {student.login_count > 0 ? `${student.login_count}회` : '-'}
                        </TableCell>

                        {/* 10. 비밀번호관리 */}
                        <TableCell className="text-center whitespace-nowrap py-2.5 px-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetTarget(student)}
                            disabled={!student.phone_number}
                            className="h-7 px-2.5 text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200 shrink-0"
                          >
                            <RotateCcw className="h-3 w-3 mr-1 shrink-0" />
                            초기화
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 테이블 하단 페이지네이션 바 */}
          <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
            <div>
              <span>총 <strong className="text-slate-900">{filteredStudents.length}</strong>명 중 </span>
              <span>
                {filteredStudents.length === 0 ? '0' : `${startIndex} ~ ${endIndex}`}번째 표시
              </span>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                  title="처음으로"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                  title="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="px-2 text-xs font-semibold text-slate-800">
                  {currentPage} / {totalPages} 페이지
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                  title="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                  title="마지막으로"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 초기화 확인 모달 */}
      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                학생 비밀번호 초기화
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed pt-2">
              <strong>{resetTarget?.student_name}</strong> 학생({resetTarget?.class_info}반 {resetTarget?.student_number}번)의 비밀번호를 등록된 휴대전화 번호 뒷자리 4자리(<strong>{resetTarget?.phone_number ? resetTarget.phone_number.replace(/[^0-9]/g, '').slice(-4) : ''}</strong>)로 초기화하시겠습니까?
              <br /><br />
              <span className="text-blue-600 font-medium">
                * 학생이 직접 변경한 비밀번호 이력도 함께 초기화되며, 이후 전화번호 변경 시 다시 자동 동기화됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting} className="text-xs h-9">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold h-9"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  초기화 중...
                </>
              ) : (
                '비밀번호 초기화'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
