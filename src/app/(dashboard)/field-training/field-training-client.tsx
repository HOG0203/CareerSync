'use client';

import * as React from 'react';
import { 
  Calendar, 
  Building2, 
  Users, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  Search, 
  Grid3X3, 
  LayoutList, 
  HelpCircle, 
  Plus, 
  Edit3, 
  Award, 
  DollarSign, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldTrainingModal } from '../students/field-training-modal';
import { updateFieldTrainingStatusAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, isAfter, isBefore, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

import { useRouter } from 'next/navigation';

interface FieldTrainingClientProps {
  initialStudents: any[];
  baseYear: number;
  userProfile?: any;
  selectedGrade: number;
  targetMajor: string;
  targetClass: string;
}

export function FieldTrainingClient({
  initialStudents,
  baseYear,
  userProfile,
  selectedGrade,
  targetMajor,
  targetClass
}: FieldTrainingClientProps) {
  const router = useRouter();
  const isAdmin = userProfile?.role === 'admin';
  const [viewMode, setViewMode] = React.useState<'timeline' | 'grid'>('timeline');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  
  // 편집 모달 관리
  const [selectedStudentForModal, setSelectedStudentForModal] = React.useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { toast } = useToast();

  // 학생 데이터 최신화
  const [students, setStudents] = React.useState(initialStudents);

  React.useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  // 검색 및 필터링된 학생 데이터
  const filteredStudents = React.useMemo(() => {
    return students.filter(s => {
      const matchSearch = !searchTerm || 
        s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_number?.includes(searchTerm) ||
        s.training_records?.some((r: any) => r.company?.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'none') return (!s.training_records || s.training_records.length === 0);
      
      const records = s.training_records || [];
      if (statusFilter === 'ongoing') return records.some((r: any) => r.hiring_status === '진행중' || (!r.hiring_status && r.company));
      if (statusFilter === 'converted') return records.some((r: any) => r.hiring_status === '채용전환');
      if (statusFilter === 'returned') return records.some((r: any) => r.hiring_status === '복교');
      if (statusFilter === 'stipend') return records.some((r: any) => r.stipend_status === 'O');

      return true;
    });
  }, [students, searchTerm, statusFilter]);

  // KPI 집계 통계 계산
  const stats = React.useMemo(() => {
    const total = students.length;
    let participatingCount = 0;
    let ongoingCount = 0;
    let convertedCount = 0;
    let returnedCount = 0;
    let stipendCount = 0;

    students.forEach(s => {
      const records = s.training_records || [];
      if (records.length > 0) {
        participatingCount++;
        const latest = records[0]; // 최신 차수
        if (latest.hiring_status === '채용전환') convertedCount++;
        else if (latest.hiring_status === '복교') returnedCount++;
        else if (latest.company) ongoingCount++;

        if (records.some((r: any) => r.stipend_status === 'O')) {
          stipendCount++;
        }
      }
    });

    const participationRate = total > 0 ? Math.round((participatingCount / total) * 100) : 0;
    const stipendRate = participatingCount > 0 ? Math.round((stipendCount / participatingCount) * 100) : 0;

    return {
      total,
      participatingCount,
      participationRate,
      ongoingCount,
      convertedCount,
      returnedCount,
      stipendCount,
      stipendRate
    };
  }, [students]);

  // 동적 간트 타임라인 월범위 계산 (실제 데이터의 시작월~종료월 스캔 + 기본 범위 보장)
  const timelineMonths = React.useMemo(() => {
    // 기본 범위: 학사학년도 6월 ~ 익년 2월
    let minYear = baseYear;
    let minMonth = 6;
    let maxYear = baseYear + 1;
    let maxMonth = 2;

    // 등록된 학생들의 모든 실습 시작일 및 종료일 스캔하여 범위 자동 확장
    students.forEach(s => {
      (s.training_records || []).forEach((r: any) => {
        if (r.start_date) {
          const d = parseISO(r.start_date);
          if (isValid(d)) {
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            if (y < minYear || (y === minYear && m < minMonth)) {
              minYear = y;
              minMonth = m;
            }
          }
        }
        if (r.end_date) {
          const d = parseISO(r.end_date);
          if (isValid(d)) {
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            if (y > maxYear || (y === maxYear && m > maxMonth)) {
              maxYear = y;
              maxMonth = m;
            }
          }
        }
      });
    });

    const months: { year: number; month: number; label: string; key: string }[] = [];
    let curY = minYear;
    let curM = minMonth;

    while (curY < maxYear || (curY === maxYear && curM <= maxMonth)) {
      months.push({
        year: curY,
        month: curM,
        label: `${curM}월`,
        key: `${curY}-${String(curM).padStart(2, '0')}`
      });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return months;
  }, [baseYear, students]);

  // 타임라인 전체 시작일 (첫 월 1일) 및 종료일 (마지막 월 마지막 날)
  const timelineStart = React.useMemo(() => {
    if (timelineMonths.length === 0) return new Date(baseYear, 5, 1);
    const first = timelineMonths[0];
    return new Date(first.year, first.month - 1, 1);
  }, [baseYear, timelineMonths]);

  const timelineEnd = React.useMemo(() => {
    if (timelineMonths.length === 0) return new Date(baseYear + 1, 1, 28);
    const last = timelineMonths[timelineMonths.length - 1];
    return new Date(last.year, last.month, 0); // 전달 말일
  }, [baseYear, timelineMonths]);

  const totalDays = React.useMemo(() => Math.max(1, differenceInDays(timelineEnd, timelineStart)), [timelineStart, timelineEnd]);

  // 오늘 날짜 위치 계산 (%)
  const todayPositionPercent = React.useMemo(() => {
    const today = new Date();
    if (isBefore(today, timelineStart)) return 0;
    if (isAfter(today, timelineEnd)) return 100;
    const diff = differenceInDays(today, timelineStart);
    return Math.min(100, Math.max(0, (diff / totalDays) * 100));
  }, [timelineStart, timelineEnd, totalDays]);

  // 지원금 신청 상태 토글 동작
  const handleToggleStipend = async (recordId: string, currentStatus: string) => {
    if (!isAdmin) {
      toast({ variant: 'destructive', title: '권한 없음', description: '지원금 신청 상태 변경은 관리자만 가능합니다.' });
      return;
    }
    const newStatus = currentStatus === 'O' ? 'X' : 'O';
    const res = await updateFieldTrainingStatusAction(recordId, 'stipend_status', newStatus);
    if (res.success) {
      toast({ title: '지원금 신청 상태 변경 완료', description: `지원금 신청 상태가 [${newStatus}]로 변경되었습니다.` });
      // 로컬 state 반영
      setStudents(prev => prev.map(s => {
        if (!s.training_records) return s;
        const updatedRecords = s.training_records.map((r: any) => r.id === recordId ? { ...r, stipend_status: newStatus } : r);
        return { ...s, training_records: updatedRecords };
      }));
    } else {
      toast({ variant: 'destructive', title: '변경 실패', description: res.error });
    }
  };

  // 모달 열기 헬퍼
  const handleOpenModal = (student: any) => {
    setSelectedStudentForModal(student);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full gap-4 w-full overflow-hidden">
      {/* 1. 상단 KPI 집계 카드 대시보드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">전체 실습 참여율</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-900">{stats.participationRate}%</span>
              <span className="text-[11px] font-bold text-slate-500">({stats.participatingCount}/{stats.total}명)</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${stats.participationRate}%` }} />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">현재 실습 진행중</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-emerald-600">{stats.ongoingCount}명</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">ONGOING</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">현장실습 수행 중인 학생</p>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">채용 전환 완료</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-purple-600">{stats.convertedCount}명</span>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">CONVERTED</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">실습 후 정규/계약 채용 전환</p>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">복교 및 중단</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-amber-600">{stats.returnedCount}명</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">RETURNED</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">실습 중도 복교 처리 건수</p>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">지원금 신청 현황</span>
            <div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-sky-600">{stats.stipendCount}명</span>
              <span className="text-[11px] font-bold text-slate-500">({stats.stipendRate}%)</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">지원금 신청 완료 학생 수</p>
          </div>
        </Card>
      </div>

      {/* 2. 툴바 & 뷰 모드 전환 및 검색 필터 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm shrink-0">
        <div className="flex items-center gap-1.5">
          {/* 뷰 모드 토글 */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setViewMode('timeline')}
              className={cn("h-7 px-2.5 text-xs font-bold rounded-md gap-1.5", viewMode === 'timeline' && "bg-slate-900 text-white shadow-sm")}
            >
              <Calendar className="h-3.5 w-3.5" />
              월별 간트 타임라인
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className={cn("h-7 px-2.5 text-xs font-bold rounded-md gap-1.5", viewMode === 'grid' && "bg-slate-900 text-white shadow-sm")}
            >
              <LayoutList className="h-3.5 w-3.5" />
              학생별 카드/명부
            </Button>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          {/* 상태 필터 뱃지 버튼 */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('all')}
              className={cn("h-7 text-[11px] font-bold rounded-lg px-2", statusFilter === 'all' && "bg-blue-600 hover:bg-blue-700")}
            >
              전체 ({students.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'ongoing' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('ongoing')}
              className={cn("h-7 text-[11px] font-bold rounded-lg px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50", statusFilter === 'ongoing' && "bg-emerald-600 text-white hover:bg-emerald-700")}
            >
              실습중 ({stats.ongoingCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'converted' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('converted')}
              className={cn("h-7 text-[11px] font-bold rounded-lg px-2 text-purple-700 border-purple-200 hover:bg-purple-50", statusFilter === 'converted' && "bg-purple-600 text-white hover:bg-purple-700")}
            >
              채용전환 ({stats.convertedCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'returned' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('returned')}
              className={cn("h-7 text-[11px] font-bold rounded-lg px-2 text-amber-700 border-amber-200 hover:bg-amber-50", statusFilter === 'returned' && "bg-amber-600 text-white hover:bg-amber-700")}
            >
              복교 ({stats.returnedCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'none' ? 'default' : 'outline'}
              onClick={() => setStatusFilter('none')}
              className={cn("h-7 text-[11px] font-bold rounded-lg px-2 text-slate-600 border-slate-200", statusFilter === 'none' && "bg-slate-700 text-white")}
            >
              미실습 ({students.length - stats.participatingCount})
            </Button>
          </div>
        </div>

        {/* 학생 & 업체 검색창 */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="학생 성명, 번호, 실습처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-7 text-xs bg-slate-50 border-slate-200 rounded-lg focus-visible:bg-white"
          />
        </div>
      </div>

      {/* 3. 뷰 메인 렌더링 영역 */}
      <Card className="flex-1 min-h-0 bg-white border border-slate-200/80 shadow-sm rounded-xl overflow-hidden flex flex-col">
        {viewMode === 'timeline' ? (
          /* ===== [VIEW 1] 월별 그래픽 간트 타임라인 뷰 ===== */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
            {/* 범례 안내 바 */}
            <div className="p-2.5 px-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0 text-xs">
              <div className="flex items-center gap-3 font-semibold text-slate-600">
                <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  실습 일정 범례:
                </span>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                  실습 진행중
                </span>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600 inline-block" />
                  채용전환
                </span>
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                  복교/중단
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold ml-2">
                  <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[9px] px-1 py-0">O</Badge>
                  지원금 신청완료
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline-block">
                💡 실습 기간 막대를 클릭하면 해당 학생의 실습 및 지원금 정보를 바로 수정할 수 있습니다.
              </span>
            </div>

            {/* 메인 간트 테이블 표 (헤더 고정 + 바디 세로 스크롤) */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
              <div className="w-full" style={{ minWidth: `${Math.max(900, 240 + timelineMonths.length * 105)}px` }}>
                {/* 헤더 행: 학생 정보 컬럼 + 가변 월별 컬럼 */}
                <div className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 flex text-xs font-extrabold text-slate-700 shadow-sm">
                  <div className="w-[240px] shrink-0 p-2.5 pl-4 border-r border-slate-200 bg-slate-100 flex items-center">
                    학생 기본 정보 (성명 / 학번)
                  </div>
                  <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                    {timelineMonths.map((m, idx) => (
                      <div key={m.key} className={cn("p-2 text-center border-r border-slate-200/80 bg-slate-100/90 text-[11px] font-bold text-slate-800", idx === timelineMonths.length - 1 && "border-r-0")}>
                        {m.label} ({m.year.toString().slice(2)}년)
                      </div>
                    ))}

                    {/* 오늘 날짜 표시 라인 (헤더 영역 뱃지) */}
                    {todayPositionPercent > 0 && todayPositionPercent < 100 && (
                      <div 
                        className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
                        style={{ left: `${todayPositionPercent}%` }}
                      >
                        <span className="bg-rose-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-b shadow-sm whitespace-nowrap">
                          오늘 ({format(new Date(), 'MM.dd')})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 바디 행 리스트 */}
                <div className="divide-y divide-slate-100 relative">
                  {filteredStudents.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic font-medium">
                      조회 조건과 일치하는 현장실습 학생 데이터가 없습니다.
                    </div>
                  ) : (
                    filteredStudents.map((s, sIdx) => {
                      const records = [...(s.training_records || [])].sort((a, b) => a.training_order - b.training_order);
                      const hasRecords = records.length > 0;

                      return (
                        <div key={s.id} className="flex hover:bg-slate-50/70 transition-colors group min-h-[52px]">
                          {/* 좌측 학생 프로필 정보 영역 */}
                          <div className="w-[240px] shrink-0 p-2.5 pl-4 border-r border-slate-200/80 flex items-center justify-between bg-white group-hover:bg-slate-50/70">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                                {s.student_number ? `${s.student_number}번` : (sIdx + 1)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900 text-xs truncate">{s.student_name}</span>
                                  {s.major && (
                                    <span className="text-[10px] text-slate-500 font-semibold truncate">
                                      {s.class_info ? `${s.class_info}반` : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] text-slate-400 font-mono truncate">
                                  {s.phone_number || '전화번호 미입력'}
                                </p>
                              </div>
                            </div>
                            
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenModal(s)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0"
                              title="실습 기록 편집"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* 우측 월별 타임라인 그리드 영역 (실습 차수에 따라 높이 자동 가변 확장) */}
                          <div className="flex-1 relative bg-white group-hover:bg-slate-50/70 flex flex-col justify-center min-h-[52px]">
                            {/* 가변 월별 배경 세로 격자선 (절대위치로 전체 높이 추종) */}
                            <div className="absolute inset-0 grid pointer-events-none z-0" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                              {timelineMonths.map((m, idx) => (
                                <div key={m.key} className={cn("h-full border-r border-slate-100", idx === timelineMonths.length - 1 && "border-r-0")} />
                              ))}
                            </div>

                            {/* 오늘 날짜 세로 가이드라인 (몸통 영역) */}
                            {todayPositionPercent > 0 && todayPositionPercent < 100 && (
                              <div 
                                className="absolute top-0 bottom-0 z-10 w-[2px] bg-rose-400/80 pointer-events-none"
                                style={{ left: `${todayPositionPercent}%` }}
                              />
                            )}

                            {/* 실습 미배정 시 안내 */}
                            {!hasRecords ? (
                              <div className="relative z-10 flex items-center justify-center py-3 pointer-events-none">
                                <span className="text-[11px] text-slate-300 italic font-medium">현장실습 미배정</span>
                              </div>
                            ) : (
                              /* 다차수 실습 막대들 렌더링 (차수 개수만큼 세로로 자연스럽게 늘어남) */
                              <div className="relative z-10 p-1.5 flex flex-col justify-center gap-1.5 w-full min-h-[44px]">
                                {records.map((r: any) => {
                                  // 시작일과 종료일 기반 위치 계산
                                  let startPct = 0;
                                  let endPct = 100;
                                  let startDateFormatted = '';
                                  let endDateFormatted = '';

                                  if (r.start_date) {
                                    const sDate = parseISO(r.start_date);
                                    if (isValid(sDate)) {
                                      startDateFormatted = format(sDate, 'MM.dd');
                                      if (isBefore(sDate, timelineStart)) startPct = 0;
                                      else if (isAfter(sDate, timelineEnd)) startPct = 100;
                                      else startPct = (differenceInDays(sDate, timelineStart) / totalDays) * 100;
                                    }
                                  }

                                  if (r.end_date) {
                                    const eDate = parseISO(r.end_date);
                                    if (isValid(eDate)) {
                                      endDateFormatted = format(eDate, 'MM.dd');
                                      if (isBefore(eDate, timelineStart)) endPct = 0;
                                      else if (isAfter(eDate, timelineEnd)) endPct = 100;
                                      else endPct = (differenceInDays(eDate, timelineStart) / totalDays) * 100;
                                    }
                                  }

                                  const barWidthPct = Math.max(3, Math.min(100 - startPct, endPct - startPct));

                                  // D-Day 및 상태 판별
                                  let dDayText = '';
                                  if (r.end_date) {
                                    const eDate = parseISO(r.end_date);
                                    if (isValid(eDate)) {
                                      const daysLeft = differenceInDays(eDate, new Date());
                                      if (daysLeft > 0) dDayText = `D-${daysLeft}일`;
                                      else if (daysLeft === 0) dDayText = 'D-Day';
                                      else dDayText = '만료';
                                    }
                                  }

                                  // 상태에 따른 바 테마 스타일
                                  const isConverted = r.hiring_status === '채용전환';
                                  const isReturned = r.hiring_status === '복교';

                                  return (
                                    <TooltipProvider key={r.id || r.training_order}>
                                      <Tooltip delayDuration={100}>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={() => handleOpenModal(s)}
                                            className={cn(
                                              "h-7 rounded-lg px-2.5 text-white flex items-center justify-between text-xs font-bold shadow-sm transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer relative overflow-hidden group/bar",
                                              isConverted && "bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400",
                                              isReturned && "bg-gradient-to-r from-amber-500 to-rose-500 border border-amber-400",
                                              !isConverted && !isReturned && "bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-400"
                                            )}
                                            style={{
                                              marginLeft: `${Math.max(0, startPct)}%`,
                                              width: `${barWidthPct}%`,
                                              minWidth: '120px'
                                            }}
                                          >
                                            {/* 왼쪽: 차수 & 실습처 명칭 */}
                                            <div className="flex items-center gap-1.5 truncate pr-1">
                                              <span className="bg-white/20 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded shrink-0">
                                                {r.training_order}차
                                              </span>
                                              <span className="font-extrabold truncate text-[11px]">
                                                {r.company || '업체미지정'}
                                              </span>
                                            </div>

                                            {/* 오른쪽: 날짜, 지원금 뱃지 및 상태 정보 */}
                                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-medium">
                                              {startDateFormatted && endDateFormatted && (
                                                <span className="opacity-90 font-mono hidden lg:inline">
                                                  {startDateFormatted}~{endDateFormatted}
                                                </span>
                                              )}

                                              {/* 지원금 뱃지 */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleStipend(r.id, r.stipend_status);
                                                }}
                                                className={cn(
                                                  "px-1.5 py-0.2 rounded font-extrabold text-[9px] border transition-transform active:scale-95",
                                                  r.stipend_status === 'O' 
                                                    ? "bg-white text-emerald-700 border-emerald-200" 
                                                    : "bg-black/20 text-white/80 border-white/30 hover:bg-black/40"
                                                )}
                                                title="클릭하여 지원금 신청 상태 변경"
                                              >
                                                지원금 {r.stipend_status === 'O' ? 'O' : 'X'}
                                              </button>

                                              {/* 채용전환 / 복교 / D-Day 뱃지 */}
                                              {isConverted && (
                                                <span className="bg-white text-purple-700 font-extrabold text-[9px] px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                                  🎉 채용전환
                                                </span>
                                              )}
                                              {isReturned && (
                                                <span className="bg-white text-rose-700 font-extrabold text-[9px] px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                                  ↩️ 복교
                                                </span>
                                              )}
                                              {!isConverted && !isReturned && dDayText && (
                                                <span className="bg-emerald-900/40 text-emerald-100 text-[9.5px] font-bold px-1.5 py-0.2 rounded shrink-0">
                                                  {dDayText}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={6} className="bg-slate-900 text-white border-slate-800 text-xs p-3 space-y-1.5 rounded-xl shadow-2xl z-[9999] max-w-xs">
                                          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5">
                                            <span className="font-extrabold text-emerald-400 text-sm">{s.student_name} ({r.training_order}차 실습)</span>
                                            <Badge className={cn("text-[10px]", isConverted ? "bg-purple-500" : isReturned ? "bg-amber-500" : "bg-emerald-500")}>
                                              {r.hiring_status || '진행중'}
                                            </Badge>
                                          </div>
                                          <p className="font-bold text-slate-100 flex items-center gap-1">
                                            <Building2 className="h-3.5 w-3.5 text-blue-400" />
                                            {r.company}
                                          </p>
                                          <p className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            실습 기간: {r.start_date || '미정'} ~ {r.end_date || '미정'}
                                          </p>
                                          <div className="flex items-center justify-between text-[11px] pt-1">
                                            <span>지원금 신청 여부: <strong className={r.stipend_status === 'O' ? "text-emerald-400 font-bold" : "text-slate-400"}>{r.stipend_status === 'O' ? '신청완료 (O)' : '미신청 (X)'}</strong></span>
                                          </div>
                                          {isConverted && r.conversion_date && (
                                            <p className="text-[11px] text-purple-300 font-medium">✨ 채용 전환일: {r.conversion_date}</p>
                                          )}
                                          {isReturned && r.return_reason && (
                                            <p className="text-[11px] text-amber-300 font-medium">⚠️ 복교 사유: {r.return_reason}</p>
                                          )}
                                          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 text-center">클릭하여 이 실습 기록 수정하기</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===== [VIEW 2] 학생별 명부/카드 상세 뷰 ===== */
          <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 italic font-medium">
                  조회 조건과 일치하는 실습 학생 데이터가 없습니다.
                </div>
              ) : (
                filteredStudents.map((s, idx) => {
                  const records = s.training_records || [];
                  const latest = records[0];

                  return (
                    <Card key={s.id} className="bg-white border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col justify-between hover:border-blue-300 transition-all">
                      <div className="space-y-3">
                        {/* 상단 프로필 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-700 font-extrabold text-sm flex items-center justify-center shrink-0 border border-blue-100">
                              {s.student_number ? `${s.student_number}번` : (idx + 1)}
                            </div>
                            <div>
                              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                                {s.student_name}
                                <span className="text-xs text-slate-500 font-normal">({s.major} {s.class_info}반)</span>
                              </h3>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{s.phone_number || '전화번호 미입력'}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenModal(s)}
                            className="h-7 text-xs font-bold text-blue-700 border-blue-200 hover:bg-blue-50 rounded-lg gap-1"
                          >
                            <Edit3 className="h-3 w-3" />
                            실습관리
                          </Button>
                        </div>

                        {/* 실습 이력 리스트 */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          {records.length === 0 ? (
                            <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                              등록된 현장실습 이력이 없습니다.
                            </div>
                          ) : (
                            records.map((r: any) => (
                              <div key={r.id || r.training_order} className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="bg-slate-900 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded">
                                      {r.training_order}차
                                    </span>
                                    <span className="font-bold text-slate-900 truncate">{r.company || '업체미지정'}</span>
                                  </div>
                                  <Badge className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.2",
                                    r.hiring_status === '채용전환' && "bg-purple-100 text-purple-800 border-purple-200",
                                    r.hiring_status === '복교' && "bg-rose-100 text-rose-800 border-rose-200",
                                    (!r.hiring_status || r.hiring_status === '진행중') && "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  )}>
                                    {r.hiring_status || '진행중'}
                                  </Badge>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                  <span>📅 {r.start_date || '미정'} ~ {r.end_date || '미정'}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStipend(r.id, r.stipend_status)}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded font-bold text-[10px] border transition-transform active:scale-95",
                                      r.stipend_status === 'O' ? "bg-sky-100 text-sky-800 border-sky-300" : "bg-slate-200 text-slate-600 border-slate-300"
                                    )}
                                  >
                                    지원금: {r.stipend_status === 'O' ? '신청 (O)' : '미신청 (X)'}
                                  </button>
                                </div>

                                {r.hiring_status === '채용전환' && r.conversion_date && (
                                  <p className="text-[11px] font-bold text-purple-700 bg-purple-50 p-1 px-2 rounded border border-purple-100">
                                    🎉 채용 전환일: {r.conversion_date}
                                  </p>
                                )}
                                {r.hiring_status === '복교' && r.return_reason && (
                                  <p className="text-[11px] font-bold text-rose-700 bg-rose-50 p-1 px-2 rounded border border-rose-100">
                                    ⚠️ 복교 사유: {r.return_reason}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 실습 등록 및 편집 모달 */}
      <FieldTrainingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.refresh();
        }}
        student={selectedStudentForModal}
        isAdmin={isAdmin}
      />
    </div>
  );
}
