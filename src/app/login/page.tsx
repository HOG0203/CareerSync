'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { login } from '@/app/login/actions';
import * as React from 'react';

const initialState = { error: '' };

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex w-screen overflow-hidden animate-in fade-in duration-300">
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r border-slate-200/80 bg-white p-4 hidden md:flex flex-col gap-6 shrink-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-100">
          <div className="h-7 w-7 rounded-lg bg-blue-100 animate-pulse shrink-0" />
          <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div className="h-4 w-4 bg-slate-200 animate-pulse rounded shrink-0" />
              <div className="h-3.5 w-24 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-4 px-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
              <div className="h-3 w-14 bg-slate-100 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Skeleton */}
        <header className="h-14 border-b border-slate-200/80 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>

        {/* Dashboard Body Skeleton */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Title Section */}
          <div className="space-y-1.5">
            <div className="h-6 w-48 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-72 bg-slate-100 animate-pulse rounded" />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-16 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-4 bg-slate-200 animate-pulse rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-7 w-12 bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-28 bg-slate-100 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Large Content Area Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col gap-4 min-h-[300px]">
              <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
              <div className="flex-1 bg-slate-50/50 border border-dashed border-slate-200/60 rounded-lg animate-pulse" />
            </div>

            {/* List Area */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col gap-4 min-h-[300px]">
              <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
              <div className="space-y-3 flex-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-slate-200 animate-pulse" />
                      <div className="h-3 w-20 bg-slate-200 animate-pulse rounded" />
                    </div>
                    <div className="h-3 w-8 bg-slate-100 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MAJOR_SORT_ORDER } from '@/lib/types';
import { studentLogin, getActiveEnrolledMajors } from '@/app/login/actions';
import { GraduationCap, UserCheck, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [activeTab, setActiveTab] = React.useState<'staff' | 'student'>('staff');

  // 교직원 로그인 State
  const [staffState, staffFormAction, isStaffPending] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await login(formData);
    return result || initialState;
  }, initialState);

  // 학생 로그인 State
  const [studentState, studentFormAction, isStudentPending] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await studentLogin(formData);
    return result || initialState;
  }, initialState);

  const [selectedGrade, setSelectedGrade] = React.useState<string>('1');
  const [selectedMajor, setSelectedMajor] = React.useState<string>(MAJOR_SORT_ORDER[0] || '자동화기계과');

  // 현재학년도 기준 재학생 학과 목록 데이터
  const [activeMajorsData, setActiveMajorsData] = React.useState<{
    all: string[];
    byGrade: Record<number, string[]>;
  }>({
    all: MAJOR_SORT_ORDER,
    byGrade: { 1: MAJOR_SORT_ORDER, 2: MAJOR_SORT_ORDER, 3: MAJOR_SORT_ORDER }
  });

  React.useEffect(() => {
    getActiveEnrolledMajors().then((data) => {
      if (data && data.all.length > 0) {
        setActiveMajorsData(data);
        const gradeNum = parseInt(selectedGrade) || 1;
        const currentGradeMajors = data.byGrade[gradeNum] || data.all;
        if (currentGradeMajors.length > 0 && !currentGradeMajors.includes(selectedMajor)) {
          setSelectedMajor(currentGradeMajors[0]);
        }
      }
    }).catch(console.error);
  }, []);

  const currentGradeNum = parseInt(selectedGrade) || 1;
  const availableMajors = activeMajorsData.byGrade[currentGradeNum] && activeMajorsData.byGrade[currentGradeNum].length > 0
    ? activeMajorsData.byGrade[currentGradeNum]
    : activeMajorsData.all;

  const handleGradeChange = (newGrade: string) => {
    setSelectedGrade(newGrade);
    const gNum = parseInt(newGrade) || 1;
    const gradeMajors = activeMajorsData.byGrade[gNum] && activeMajorsData.byGrade[gNum].length > 0
      ? activeMajorsData.byGrade[gNum]
      : activeMajorsData.all;
    if (gradeMajors.length > 0 && !gradeMajors.includes(selectedMajor)) {
      setSelectedMajor(gradeMajors[0]);
    }
  };

  if (isStaffPending || isStudentPending) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/70 p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200/90 rounded-2xl overflow-hidden bg-white">
        <CardHeader className="text-center pb-3 pt-6">
          <div className="mb-3 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-slate-900">CareerSync 로그인</CardTitle>
          <CardDescription className="text-xs text-slate-500 font-medium mt-1">
            시스템에 접속할 사용자 유형을 선택해 주세요.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'staff' | 'student')} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner h-12 gap-1.5">
              <TabsTrigger 
                value="staff" 
                className={cn(
                  "flex items-center justify-center gap-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 h-full",
                  "text-slate-500 hover:text-slate-800",
                  "data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:font-black"
                )}
              >
                <UserCheck className={cn("h-4 w-4 shrink-0", activeTab === 'staff' ? "text-amber-300 stroke-[2.5px]" : "text-slate-400")} />
                <span>교직원 로그인</span>
              </TabsTrigger>
              <TabsTrigger 
                value="student" 
                className={cn(
                  "flex items-center justify-center gap-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 h-full",
                  "text-slate-500 hover:text-slate-800",
                  "data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:font-black"
                )}
              >
                <GraduationCap className={cn("h-4 w-4 shrink-0", activeTab === 'student' ? "text-amber-300 stroke-[2.5px]" : "text-slate-400")} />
                <span>학생 로그인</span>
              </TabsTrigger>
            </TabsList>

            {/* 1. 교직원 로그인 */}
            <TabsContent value="staff" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
              <form action={staffFormAction} className="flex flex-col">
                <div className="h-[295px] flex flex-col justify-between space-y-2.5">
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="username" className="text-xs font-bold text-slate-700">교직원 아이디</Label>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="교직원 아이디를 입력하세요"
                        required
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password" className="text-xs font-bold text-slate-700">비밀번호</Label>
                      <Input 
                        id="password" 
                        name="password" 
                        type="password" 
                        placeholder="비밀번호를 입력하세요" 
                        required 
                        className="h-9 rounded-xl text-xs" 
                      />
                    </div>

                    {staffState?.error && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-1.5 text-xs text-red-700">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-medium leading-tight">{staffState.error}</span>
                      </div>
                    )}
                  </div>

                  {/* 스타일 1번: 교직원 접속 및 권한 안내 박스 */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                      <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      교직원 접속 및 권한 안내
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-500 text-[11px] leading-relaxed">
                      <li>학생 맞춤형 취업·진로 지도 및 옥저인재인증제 관리 시스템입니다.</li>
                      <li>신규 계정 생성 및 메뉴 권한 설정은 <strong>메인관리자</strong>에게 문의해 주세요.</li>
                      <li>비밀번호를 분실하셨을 경우 관리자에게 초기화를 요청할 수 있습니다.</li>
                    </ul>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all mt-4" 
                  disabled={isStaffPending}
                >
                  {isStaffPending ? '로그인 중...' : '로그인'}
                </Button>
              </form>
            </TabsContent>

            {/* 2. 학생 로그인 */}
            <TabsContent value="student" className="mt-0 focus-visible:outline-none animate-in fade-in duration-200">
              <form action={studentFormAction} className="flex flex-col">
                <div className="h-[295px] flex flex-col justify-between space-y-2">
                  <div className="space-y-2">
                    {/* 행 1: 학년 / 학과 / 반 / 번호 4개 항목을 한 줄(12열 그리드)에 나란히 배치 */}
                    <div className="grid grid-cols-12 gap-1.5">
                      {/* 학년 (3칸) */}
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs font-bold text-slate-700">학년</Label>
                        <input type="hidden" name="grade" value={selectedGrade} />
                        <Select value={selectedGrade} onValueChange={handleGradeChange}>
                          <SelectTrigger className="h-9 rounded-xl text-xs font-semibold px-2">
                            <SelectValue placeholder="학년" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="1">1학년</SelectItem>
                            <SelectItem value="2">2학년</SelectItem>
                            <SelectItem value="3">3학년</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 학과 (4칸 - 현재학년도 재학생 학과만 표시) */}
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs font-bold text-slate-700">학과</Label>
                        <input type="hidden" name="major" value={selectedMajor} />
                        <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                          <SelectTrigger className="h-9 rounded-xl text-[11px] font-semibold px-2 truncate">
                            <SelectValue placeholder="학과" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {availableMajors.map((m) => (
                              <SelectItem key={m} value={m} className="text-xs font-medium">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 반 (2칸) */}
                      <div className="col-span-2 space-y-1">
                        <Label htmlFor="classInfo" className="text-xs font-bold text-slate-700">반</Label>
                        <Input
                          id="classInfo"
                          name="classInfo"
                          type="text"
                          placeholder="1"
                          required
                          className="h-9 rounded-xl text-xs text-center px-1 font-medium placeholder:text-slate-300 placeholder:font-normal"
                        />
                      </div>

                      {/* 번호 (3칸) */}
                      <div className="col-span-3 space-y-1">
                        <Label htmlFor="studentNumber" className="text-xs font-bold text-slate-700">번호</Label>
                        <Input
                          id="studentNumber"
                          name="studentNumber"
                          type="text"
                          placeholder="15"
                          required
                          className="h-9 rounded-xl text-xs text-center px-1 font-medium placeholder:text-slate-300 placeholder:font-normal"
                        />
                      </div>
                    </div>

                    {/* 행 2: 성명 */}
                    <div className="space-y-1">
                      <Label htmlFor="studentName" className="text-xs font-bold text-slate-700">성명</Label>
                      <Input
                        id="studentName"
                        name="studentName"
                        type="text"
                        placeholder="학생 이름을 입력하세요"
                        required
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    {/* 행 3: 비밀번호 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="student-password" className="text-xs font-bold text-slate-700">비밀번호</Label>
                        <span className="text-[10px] text-blue-600 font-bold">초기: 휴대폰 뒷 4자리</span>
                      </div>
                      <Input
                        id="student-password"
                        name="password"
                        type="password"
                        placeholder="비밀번호 입력"
                        required
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>

                    {studentState?.error && (
                      <div className="p-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5 text-xs text-amber-900">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                        <div className="flex-1 leading-tight font-medium text-[11px]">
                          {studentState.error}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 학생 로그인 안내 박스 */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                      <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      학생 로그인 안내
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-500 text-[11px] leading-relaxed">
                      <li>학교에 등록된 휴대폰 번호가 있어야 로그인할 수 있습니다.</li>
                      <li>연락처가 미등록된 경우 <strong>담임선생님께 연락처 등록을 요청</strong>해 주세요.</li>
                      <li>로그인 후 상단에서 비밀번호를 자유롭게 변경할 수 있습니다.</li>
                    </ul>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all mt-4" 
                  disabled={isStudentPending}
                >
                  {isStudentPending ? '로그인 중...' : '로그인'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}