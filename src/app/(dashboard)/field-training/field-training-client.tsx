'use client';

import { MAJOR_SORT_ORDER } from '@/lib/types';

/**
 * 오늘 날짜 기준 실제 유효 실습/채용 상태 판별
 * 1. 실습 시작일(start_date)이 오늘보다 미래 ➔ [upcoming: 실습예정]
 * 2. 실습 진행 중 & 채용전환 등록되었으나 전환일이 미래 ➔ [ongoing: 실습진행중]
 * 3. 채용전환일 도래/경과 ➔ [converted: 채용전환]
 * 4. 복교 ➔ [returned: 복교]
 * 5. 현재 실습 중 ➔ [ongoing: 실습진행중]
 */
function getEffectiveRecordStatus(r: any, todayStr: string): 'upcoming' | 'ongoing' | 'converted' | 'returned' | 'none' {
  if (!r || !r.company) return 'none';
  if (r.hiring_status === '복교') return 'returned';
  
  // 시작일이 아직 도래하지 않은 경우 ➔ 실습예정
  if (r.start_date && r.start_date > todayStr) {
    return 'upcoming';
  }
  
  // 채용전환인 경우
  if (r.hiring_status === '채용전환') {
    const convDate = r.conversion_date || r.end_date;
    if (convDate && convDate > todayStr) {
      return 'ongoing'; // 전환일 전까지는 실습 진행중
    }
    return 'converted'; // 전환일 도래 시 채용전환
  }
  
  return 'ongoing';
}

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
  AlertCircle,
  X
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
  availableGrades: number[];
  classStructure: Record<number, Record<string, string[]>>;
}

export function FieldTrainingClient({
  initialStudents,
  baseYear,
  userProfile,
  availableGrades = [1, 2, 3],
  classStructure = {}
}: FieldTrainingClientProps) {
  const router = useRouter();
  const isAdmin = userProfile?.role === 'admin';
  const isTeacher = userProfile?.role === 'teacher';

  // 1. 학년/학과/반 필터 상태 (관리자: 전체 기본, 담임교사: 담당 학반 기본)
  const [selectedGrade, setSelectedGrade] = React.useState<number | 'ALL'>(
    isAdmin ? 'ALL' : (userProfile?.assigned_grade || 3)
  );
  const [selectedMajor, setSelectedMajor] = React.useState<string>(
    isAdmin ? 'ALL' : (userProfile?.assigned_major || 'ALL')
  );
  const [selectedClass, setSelectedClass] = React.useState<string>(
    isAdmin ? 'ALL' : (userProfile?.assigned_class || 'ALL')
  );
  const [selectedStartDate, setSelectedStartDate] = React.useState<string>('ALL');

  const [viewMode, setViewMode] = React.useState<'timeline' | 'grid'>('timeline');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('participating');
  
  // 편집 모달 관리
  const [selectedStudentForModal, setSelectedStudentForModal] = React.useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { toast } = useToast();

  // 학생 데이터 최신화
  const [students, setStudents] = React.useState(initialStudents);

  React.useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  // 학년 필터에 따른 학과 목록
  const availableMajors = React.useMemo(() => {
    if (selectedGrade === 'ALL') {
      const majorSet = new Set<string>();
      Object.values(classStructure).forEach(majorsObj => {
        Object.keys(majorsObj).forEach(m => majorSet.add(m));
      });
      return Array.from(majorSet).sort((a, b) => {
        const indexA = MAJOR_SORT_ORDER.indexOf(a);
        const indexB = MAJOR_SORT_ORDER.indexOf(b);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
    }
    const majorsObj = classStructure[selectedGrade] || {};
    return Object.keys(majorsObj).sort((a, b) => {
      const indexA = MAJOR_SORT_ORDER.indexOf(a);
      const indexB = MAJOR_SORT_ORDER.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [classStructure, selectedGrade]);

  // 학과 필터에 따른 반 목록
  const availableClasses = React.useMemo(() => {
    if (selectedMajor === 'ALL') return [];
    if (selectedGrade === 'ALL') {
      const classSet = new Set<string>();
      Object.values(classStructure).forEach(majorsObj => {
        const classes = majorsObj[selectedMajor] || [];
        classes.forEach(c => classSet.add(c));
      });
      return Array.from(classSet).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
    }
    const majorsObj = classStructure[selectedGrade] || {};
    return (majorsObj[selectedMajor] || []).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
  }, [classStructure, selectedGrade, selectedMajor]);

  // 학년/학과/반 필터 적용된 학생 목록 (KPI 통계 집계 기준)
  const baseFilteredStudents = React.useMemo(() => {
    return students.filter(s => {
      if (selectedGrade !== 'ALL' && s.grade !== selectedGrade) return false;
      if (selectedMajor !== 'ALL' && s.major !== selectedMajor) return false;
      if (selectedClass !== 'ALL' && s.class_info !== selectedClass) return false;
      return true;
    });
  }, [students, selectedGrade, selectedMajor, selectedClass]);

  // 학년/학과/반 필터가 적용된 학생들의 고유 실습 시작일자 목록 및 인원수 자동 집계
  const availableStartDates = React.useMemo(() => {
    const dateCountMap: Record<string, number> = {};
    baseFilteredStudents.forEach(s => {
      const records = s.training_records || [];
      records.forEach((r: any) => {
        if (r.start_date) {
          dateCountMap[r.start_date] = (dateCountMap[r.start_date] || 0) + 1;
        }
      });
    });

    return Object.entries(dateCountMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [baseFilteredStudents]);

  // 학년/학과/반 및 시작일자 필터까지 적용된 학생 목록 (KPI 통계 및 상태 칩 집계 기준)
  const dateFilteredStudents = React.useMemo(() => {
    return baseFilteredStudents.filter(s => {
      if (selectedStartDate !== 'ALL') {
        const hasStartDate = s.training_records?.some((r: any) => r.start_date === selectedStartDate);
        if (!hasStartDate) return false;
      }
      return true;
    });
  }, [baseFilteredStudents, selectedStartDate]);

  // 오늘 날짜 YYYY-MM-DD
  const todayStr = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // 검색 및 상태 필터까지 적용된 최종 학생 목록 (오늘 날짜 기준 스마트 상태 매칭)
  const filteredStudents = React.useMemo(() => {
    return dateFilteredStudents.filter(s => {
      const matchSearch = !searchTerm || 
        s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.student_number?.includes(searchTerm) ||
        s.major?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.class_info && `${s.class_info}반`.includes(searchTerm)) ||
        s.training_records?.some((r: any) => r.company?.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      const records = s.training_records || [];
      if (statusFilter === 'all') return true;
      if (statusFilter === 'participating') return !!(records && records.length > 0);
      if (statusFilter === 'none') return (!records || records.length === 0);
      if (statusFilter === 'stipend') return records.some((r: any) => r.stipend_status === 'O');

      const targetRecord = selectedStartDate !== 'ALL'
        ? (records.find((r: any) => r.start_date === selectedStartDate) || records[0])
        : records[0];

      const effectiveStatus = targetRecord ? getEffectiveRecordStatus(targetRecord, todayStr) : 'none';

      if (statusFilter === 'upcoming') return effectiveStatus === 'upcoming';
      if (statusFilter === 'ongoing') return effectiveStatus === 'ongoing';
      if (statusFilter === 'converted') return effectiveStatus === 'converted';
      if (statusFilter === 'returned') return effectiveStatus === 'returned';

      return true;
    }).sort((a, b) => {
      if (a.grade !== b.grade) return (b.grade || 3) - (a.grade || 3);
      const idxA = MAJOR_SORT_ORDER.indexOf(a.major);
      const idxB = MAJOR_SORT_ORDER.indexOf(b.major);
      if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      if (a.class_info !== b.class_info) return (a.class_info || '').localeCompare(b.class_info || '', 'ko', { numeric: true });
      const numA = parseInt(a.student_number) || 0;
      const numB = parseInt(b.student_number) || 0;
      if (numA !== numB) return numA - numB;
      return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
    });
  }, [dateFilteredStudents, searchTerm, statusFilter, selectedStartDate, todayStr]);

  // 하단 7종 상태 필터 칩에 표시될 카테고리별 인원수 집계 (학년/학과/반/시작일자 기준)
  const categoryCounts = React.useMemo(() => {
    let participatingCount = 0;
    let upcomingCount = 0;
    let ongoingCount = 0;
    let convertedCount = 0;
    let returnedCount = 0;

    dateFilteredStudents.forEach(s => {
      const records = s.training_records || [];
      if (records.length > 0) {
        participatingCount++;
        const targetRecord = selectedStartDate !== 'ALL'
          ? (records.find((r: any) => r.start_date === selectedStartDate) || records[0])
          : records[0];

        const effectiveStatus = getEffectiveRecordStatus(targetRecord, todayStr);

        if (effectiveStatus === 'upcoming') upcomingCount++;
        else if (effectiveStatus === 'converted') convertedCount++;
        else if (effectiveStatus === 'returned') returnedCount++;
        else if (effectiveStatus === 'ongoing') ongoingCount++;
      }
    });

    return {
      total: dateFilteredStudents.length,
      participatingCount,
      upcomingCount,
      ongoingCount,
      convertedCount,
      returnedCount,
      noneCount: dateFilteredStudents.length - participatingCount
    };
  }, [dateFilteredStudents, selectedStartDate, todayStr]);

  // 상단 5개 KPI 카드 통계 (현재 화면에 필터링된 모든 조건 및 검색 결과 실시간 반영)
  const stats = React.useMemo(() => {
    let upcomingCount = 0;
    let ongoingCount = 0;
    let convertedCount = 0;
    let returnedCount = 0;

    filteredStudents.forEach(s => {
      const records = s.training_records || [];
      if (records.length > 0) {
        const targetRecord = selectedStartDate !== 'ALL'
          ? (records.find((r: any) => r.start_date === selectedStartDate) || records[0])
          : records[0];

        const effectiveStatus = getEffectiveRecordStatus(targetRecord, todayStr);

        if (effectiveStatus === 'upcoming') upcomingCount++;
        else if (effectiveStatus === 'converted') convertedCount++;
        else if (effectiveStatus === 'returned') returnedCount++;
        else if (effectiveStatus === 'ongoing') ongoingCount++;
      }
    });

    return {
      total: filteredStudents.length,
      upcomingCount,
      ongoingCount,
      convertedCount,
      returnedCount,
    };
  }, [filteredStudents, selectedStartDate, todayStr]);

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
        {/* 1. 조회 학생 수 (하단 상태 필터 및 검색 적용 결과 실시간 반영) */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">조회 학생 수</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900">{filteredStudents.length}명</span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                (statusFilter !== 'all' || searchTerm)
                  ? "text-blue-700 bg-blue-50 border-blue-200"
                  : "text-slate-600 bg-slate-100 border-slate-200"
              )}>
                {(statusFilter !== 'all' || searchTerm) ? 'FILTERED' : 'TOTAL'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">
              {(statusFilter !== 'all' || searchTerm) 
                ? `전체 ${stats.total}명 중 필터 조회`
                : '현재 필터 조건 기준 전체'}
            </p>
          </div>
        </Card>

        {/* 2. 실습 예정 */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">실습 예정</span>
            <div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-sky-600">{stats.upcomingCount}명</span>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">UPCOMING</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">시작일자 도래 전 학생</p>
          </div>
        </Card>

        {/* 3. 현재 실습 진행중 */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">현재 실습 진행중</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-emerald-600">{stats.ongoingCount}명</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">ONGOING</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">현장실습 수행 중인 학생</p>
          </div>
        </Card>

        {/* 4. 채용 전환 완료 */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">채용 전환 완료</span>
            <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-purple-600">{stats.convertedCount}명</span>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">CONVERTED</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">실습 후 정규/계약 채용 전환</p>
          </div>
        </Card>

        {/* 5. 복교 및 중단 */}
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">복교 및 중단</span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-amber-600">{stats.returnedCount}명</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">RETURNED</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-1">실습 중도 복교 처리 건수</p>
          </div>
        </Card>
      </div>

      {/* 2. 툴바 & 뷰 모드 전환 및 검색 필터 */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-sm shrink-0 space-y-2 sm:space-y-2.5">
        {/* 상단 1열: 학년 탭 & 학과/반/시작일자 선택 드롭다운 & 초기화 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-2.5 pb-2 border-b border-slate-100">
          {/* 학년 선택 탭 */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedGrade('ALL');
                setSelectedMajor('ALL');
                setSelectedClass('ALL');
                setSelectedStartDate('ALL');
              }}
              className={cn(
                "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5",
                selectedGrade === 'ALL'
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
              )}
            >
              전체학년
            </button>
            {availableGrades.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setSelectedGrade(g);
                  setSelectedMajor('ALL');
                  setSelectedClass('ALL');
                  setSelectedStartDate('ALL');
                }}
                className={cn(
                  "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5",
                  selectedGrade === g
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200"
                )}
              >
                {g}학년
              </button>
            ))}
          </div>

          {/* 학과 & 반 & 시작일자 선택 셀렉터 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 학과 선택 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 hidden sm:inline">학과:</span>
              <select
                value={selectedMajor}
                onChange={(e) => {
                  setSelectedMajor(e.target.value);
                  setSelectedClass('ALL');
                  setSelectedStartDate('ALL');
                }}
                className="h-8 sm:h-8.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">전체 학과</option>
                {availableMajors.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 반 선택 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 hidden sm:inline">반:</span>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStartDate('ALL');
                }}
                disabled={availableClasses.length === 0 && selectedMajor !== 'ALL'}
                className="h-8 sm:h-8.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-40 cursor-pointer"
              >
                <option value="ALL">전체 반</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>{c}반</option>
                ))}
              </select>
            </div>

            {/* 시작일자 선택 (방안 1) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 hidden sm:inline">시작일:</span>
              <select
                value={selectedStartDate}
                onChange={(e) => setSelectedStartDate(e.target.value)}
                className="h-8 sm:h-8.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[170px]"
              >
                <option value="ALL">전체 시작일 ({availableStartDates.length}개 일자)</option>
                {availableStartDates.map(({ date, count }) => (
                  <option key={date} value={date}>
                    {date} ({count}명)
                  </option>
                ))}
              </select>
            </div>

            {/* 필터 초기화 버튼 */}
            {(selectedGrade !== (isAdmin ? 'ALL' : (userProfile?.assigned_grade || 3)) ||
              selectedMajor !== (isAdmin ? 'ALL' : (userProfile?.assigned_major || 'ALL')) ||
              selectedClass !== (isAdmin ? 'ALL' : (userProfile?.assigned_class || 'ALL')) ||
              selectedStartDate !== 'ALL' ||
              searchTerm ||
              statusFilter !== 'participating') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGrade(isAdmin ? 'ALL' : (userProfile?.assigned_grade || 3));
                  setSelectedMajor(isAdmin ? 'ALL' : (userProfile?.assigned_major || 'ALL'));
                  setSelectedClass(isAdmin ? 'ALL' : (userProfile?.assigned_class || 'ALL'));
                  setSelectedStartDate('ALL');
                  setSearchTerm('');
                  setStatusFilter('participating');
                }}
                className="h-8 px-2 text-xs font-bold text-slate-400 hover:text-slate-700 rounded-lg gap-1"
                title="필터 초기화"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">초기화</span>
              </Button>
            )}
          </div>
        </div>

        {/* 상단 2열: 뷰 모드 토글 + 검색창 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5">
          {/* 뷰 모드 토글 (모바일 1:1 세그먼트, 데스크톱 콤팩트) */}
          <div className="grid grid-cols-2 sm:flex bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 gap-0.5 sm:gap-1 w-full sm:w-auto">
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              onClick={() => setViewMode('timeline')}
              className={cn(
                "h-8.5 sm:h-9 px-2.5 sm:px-3.5 text-xs font-extrabold rounded-lg gap-1.5 transition-all justify-center",
                viewMode === 'timeline' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>간트 타임라인</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className={cn(
                "h-8.5 sm:h-9 px-2.5 sm:px-3.5 text-xs font-extrabold rounded-lg gap-1.5 transition-all justify-center",
                viewMode === 'grid' ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>카드/명부 뷰</span>
            </Button>
          </div>

          {/* 학생 & 업체 검색창 */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
            <Input
              placeholder="학생 성명, 번호, 실습처 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 sm:pl-9 pr-7 sm:pr-8 h-8.5 sm:h-9 text-[11px] sm:text-sm bg-slate-50 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:bg-white font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 하단: 상태 필터 칩 레일 (실습참여 전체, 실습예정 등 7종 원클릭 필터) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full pt-1">
          {/* 1. 전체 학생 */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'all'
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs ring-2 ring-slate-900/20"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <span>전체</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {categoryCounts.total}
            </span>
          </button>

          {/* 2. 실습참여 전체 (실습예정+실습중+채용전환+복교) 🌟 */}
          <button
            type="button"
            onClick={() => setStatusFilter('participating')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95 ring-1",
              statusFilter === 'participating'
                ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30 shadow-2xs"
                : "bg-blue-50 text-blue-800 border-blue-200 ring-blue-100 hover:bg-blue-100"
            )}
          >
            <span>✨ 실습참여 전체</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'participating' ? "bg-white/20 text-white" : "bg-blue-200 text-blue-900")}>
              {categoryCounts.participatingCount}
            </span>
          </button>

          {/* 3. 실습예정 */}
          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'upcoming'
                ? "bg-sky-600 text-white border-sky-600 ring-2 ring-sky-500/30 shadow-2xs"
                : "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100"
            )}
          >
            <span>실습예정</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'upcoming' ? "bg-white/20 text-white" : "bg-sky-200 text-sky-900")}>
              {categoryCounts.upcomingCount}
            </span>
          </button>

          {/* 4. 실습중 */}
          <button
            type="button"
            onClick={() => setStatusFilter('ongoing')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'ongoing'
                ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30 shadow-2xs"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            )}
          >
            <span>실습중</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'ongoing' ? "bg-white/20 text-white" : "bg-emerald-200 text-emerald-900")}>
              {categoryCounts.ongoingCount}
            </span>
          </button>

          {/* 5. 채용전환 */}
          <button
            type="button"
            onClick={() => setStatusFilter('converted')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'converted'
                ? "bg-purple-600 text-white border-purple-600 ring-2 ring-purple-500/30 shadow-2xs"
                : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
            )}
          >
            <span>채용전환</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'converted' ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900")}>
              {categoryCounts.convertedCount}
            </span>
          </button>

          {/* 6. 복교 */}
          <button
            type="button"
            onClick={() => setStatusFilter('returned')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'returned'
                ? "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-500/30 shadow-2xs"
                : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
            )}
          >
            <span>복교</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'returned' ? "bg-white/20 text-white" : "bg-rose-200 text-rose-900")}>
              {categoryCounts.returnedCount}
            </span>
          </button>

          {/* 7. 미실습 */}
          <button
            type="button"
            onClick={() => setStatusFilter('none')}
            className={cn(
              "h-8 sm:h-8.5 px-3 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 shrink-0 active:scale-95",
              statusFilter === 'none'
                ? "bg-slate-800 text-white border-slate-800 ring-2 ring-slate-700/30 shadow-2xs"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80"
            )}
          >
            <span>미실습</span>
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-black", statusFilter === 'none' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}>
              {categoryCounts.noneCount}
            </span>
          </button>
        </div>
      </div>

      {/* 3. 뷰 메인 렌더링 영역 */}
      <Card className="w-full bg-white border border-slate-200/80 shadow-sm rounded-xl overflow-hidden flex flex-col">
        {viewMode === 'timeline' ? (
          /* ===== [VIEW 1] 월별 그래픽 간트 타임라인 뷰 ===== */
          <div className="w-full flex flex-col overflow-hidden relative">
            {/* 범례 안내 바 (모바일에서 줄바꿈 없이 1줄 가로 스크롤) */}
            <div className="p-2 sm:p-2.5 px-3 sm:px-4 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0 text-xs overflow-x-auto custom-scrollbar scrollbar-hide whitespace-nowrap">
              <div className="flex items-center gap-2 sm:gap-2.5 font-semibold text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500 inline-block" />
                  실습예정 (하늘색)
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                  실습 진행중 (녹색)
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-600 inline-block" />
                  채용전환 (보라색)
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600 inline-block" />
                  복교/중단 (빨간색)
                </span>
                <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] text-blue-700 font-extrabold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 shrink-0">
                  <Badge className="bg-sky-500 text-white text-[8.5px] px-1 py-0 h-3.5 leading-none">O</Badge>
                  지원금 완료
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline-block ml-4">
                💡 실습 기간 막대를 클릭하면 해당 학생의 실습 및 지원금 정보를 바로 수정할 수 있습니다.
              </span>
            </div>

            {/* ===== [DESKTOP / TABLET TIMELINE VIEW] (md 이상 화면에서 표시: PC 화면 100% 핏) ===== */}
            <div className="hidden md:block w-full relative">
              <div className="w-full min-w-0">
                {/* 헤더 행: 좌측 고정 학생 정보 컬럼 + 가변 월별 컬럼 */}
                <div className="sticky top-0 z-30 bg-slate-100 border-b border-slate-200 flex text-xs font-extrabold text-slate-700 shadow-sm">
                  <div className="w-[260px] xl:w-[290px] shrink-0 p-2.5 pl-3.5 border-r border-slate-200 bg-slate-100 flex items-center sticky left-0 z-30 shadow-xs">
                    학생 기본 정보
                  </div>
                  <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                    {timelineMonths.map((m, idx) => (
                      <div key={m.key} className={cn("p-2 text-center border-r border-slate-200/80 bg-slate-100/90 text-xs font-black text-slate-800", idx === timelineMonths.length - 1 && "border-r-0")}>
                        {m.label} ({m.year.toString().slice(2)}년)
                      </div>
                    ))}

                    {/* 오늘 날짜 표시 라인 (헤더 영역 뱃지) */}
                    {todayPositionPercent > 0 && todayPositionPercent < 100 && (
                      <div 
                        className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
                        style={{ left: `${todayPositionPercent}%` }}
                      >
                        <span className="bg-rose-500 text-white font-black text-xs px-2 py-0.5 rounded-b shadow-sm whitespace-nowrap">
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
                          {/* 좌측 학생 프로필 정보 영역 (가로 스크롤 시 좌측 Sticky 고정) */}
                          <div className="w-[260px] xl:w-[290px] shrink-0 p-2.5 pl-3 border-r border-slate-200/80 flex items-center justify-between bg-white group-hover:bg-slate-50/70 sticky left-0 z-20 shadow-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                              {/* 1. 맨 앞 학년 뱃지 */}
                              <div className="h-8 px-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                                {s.grade ? `${s.grade}학년` : '3학년'}
                              </div>
                              {/* 2. 성명 학과 반 번호 및 하단 휴대전화번호 */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span className="font-black text-slate-900 text-xs shrink-0">{s.student_name}</span>
                                  <span className="text-[11px] text-slate-600 font-bold truncate">
                                    {s.major} {s.class_info ? `${s.class_info}반` : ''} {s.student_number ? `${s.student_number}번` : ''}
                                  </span>
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

                          {/* 우측 월별 타임라인 그리드 영역 */}
                          <div className="flex-1 relative bg-white group-hover:bg-slate-50/70 flex flex-col justify-center min-h-[52px]">
                            {/* 가변 월별 배경 세로 격자선 */}
                            <div className="absolute inset-0 grid pointer-events-none z-0" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                              {timelineMonths.map((m, idx) => (
                                <div key={m.key} className={cn("h-full border-r border-slate-100", idx === timelineMonths.length - 1 && "border-r-0")} />
                              ))}
                            </div>

                            {/* 오늘 날짜 세로 가이드라인 */}
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
                              <div className="relative z-10 p-1.5 flex flex-col justify-center gap-1.5 w-full min-h-[44px]">
                                {records.map((r: any) => {
                                  let startPct = 0;
                                  let endPct = 100;
                                  let convPct = 0;
                                  let startDateFormatted = '';
                                  let endDateFormatted = '';
                                  let convDateFormatted = '';

                                  const isConverted = r.hiring_status === '채용전환';
                                  const isReturned = r.hiring_status === '복교';

                                  if (r.start_date) {
                                    const sDate = parseISO(r.start_date);
                                    if (isValid(sDate)) {
                                      startDateFormatted = format(sDate, 'MM.dd');
                                      if (isBefore(sDate, timelineStart)) startPct = 0;
                                      else if (isAfter(sDate, timelineEnd)) startPct = 100;
                                      else startPct = Math.min(100, Math.max(0, (differenceInDays(sDate, timelineStart) / totalDays) * 100));
                                    }
                                  }

                                  if (isConverted) {
                                    endPct = 100; // 졸업(익년 2월)까지 연장
                                    endDateFormatted = '졸업';

                                    const convDateStr = r.conversion_date || r.end_date;
                                    if (convDateStr) {
                                      const cDate = parseISO(convDateStr);
                                      if (isValid(cDate)) {
                                        convDateFormatted = format(cDate, 'MM.dd');
                                        if (isBefore(cDate, timelineStart)) convPct = startPct;
                                        else if (isAfter(cDate, timelineEnd)) convPct = 100;
                                        else convPct = Math.min(100, Math.max(startPct, (differenceInDays(cDate, timelineStart) / totalDays) * 100));
                                      } else {
                                        convPct = Math.min(100, startPct + 35);
                                      }
                                    } else {
                                      convPct = Math.min(100, startPct + 35);
                                    }
                                  } else if (r.end_date) {
                                    const eDate = parseISO(r.end_date);
                                    if (isValid(eDate)) {
                                      endDateFormatted = format(eDate, 'MM.dd');
                                      if (isBefore(eDate, timelineStart)) endPct = 0;
                                      else if (isAfter(eDate, timelineEnd)) endPct = 100;
                                      else endPct = Math.min(100, Math.max(0, (differenceInDays(eDate, timelineStart) / totalDays) * 100));
                                    }
                                  }

                                  const barWidthPct = Math.max(2, endPct - startPct);
                                  // 채용전환 투톤 분할 비율 계산 (녹색 실습구간 vs 보라색 채용전환구간)
                                  const trainingRatio = isConverted && barWidthPct > 0 
                                    ? Math.min(90, Math.max(15, ((convPct - startPct) / barWidthPct) * 100)) 
                                    : 100;
                                  const conversionRatio = 100 - trainingRatio;

                                  return (
                                    <TooltipProvider key={r.id || r.training_order}>
                                      <Tooltip delayDuration={100}>
                                        <TooltipTrigger asChild>
                                          <div
                                            onClick={() => handleOpenModal(s)}
                                            className={cn(
                                              "h-7.5 sm:h-8 rounded-lg shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md relative overflow-hidden group/bar",
                                              isConverted
                                                ? "border-purple-400/80 p-0 flex items-stretch shadow-sm"
                                                : isReturned
                                                ? "bg-rose-600 border-rose-500 text-white flex items-center px-2 shadow-sm"
                                                : (r.start_date && r.start_date > todayStr)
                                                ? "bg-sky-500 border-sky-400 text-white flex items-center px-2 shadow-sm"
                                                : "bg-emerald-600 border-emerald-500 text-white flex items-center px-2 shadow-sm"
                                            )}
                                            style={{
                                              marginLeft: `${startPct}%`,
                                              width: `${barWidthPct}%`
                                            }}
                                          >
                                            {isConverted ? (
                                              /* [채용전환 전용 투톤 막대]: 좌측 녹색(현장실습) + 우측 보라색(채용전환) */
                                              <div className="flex w-full h-full text-xs font-extrabold">
                                                {/* 좌측 녹색 현장실습 구간 */}
                                                <div 
                                                  style={{ width: `${trainingRatio}%` }}
                                                  className="bg-emerald-600 text-white flex items-center justify-between px-2.5 border-r-2 border-white/90 shrink-0 min-w-0 overflow-hidden"
                                                  title="현장실습 기간"
                                                >
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="bg-black/25 text-white text-[10px] px-1.5 py-0.2 rounded font-black shrink-0">
                                                      {r.training_order}차 실습
                                                    </span>
                                                    <span className="truncate text-xs font-black">{r.company || '업체미입력'}</span>
                                                  </div>
                                                  <span className="text-xs font-mono font-extrabold text-white shrink-0 ml-1.5 tracking-tight">
                                                    {startDateFormatted}~{convDateFormatted || endDateFormatted}
                                                  </span>
                                                </div>

                                                {/* 우측 보라색 채용전환 구간 */}
                                                <div 
                                                  style={{ width: `${conversionRatio}%` }}
                                                  className="bg-purple-600 text-white flex items-center justify-between px-2.5 shrink-0 min-w-0 overflow-hidden flex-1"
                                                  title="채용전환 근무 기간 (~졸업)"
                                                >
                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="bg-white/20 text-purple-100 text-[10px] px-1.5 py-0.2 rounded-full font-black shrink-0">
                                                      ✨ 채용전환
                                                    </span>
                                                    <span className="text-xs font-mono font-extrabold text-purple-50 truncate tracking-tight">
                                                      ({convDateFormatted ? `${convDateFormatted}~졸업` : '전환~졸업'})
                                                    </span>
                                                  </div>
                                                  {r.stipend_status === 'O' && (
                                                    <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.2 rounded font-black shrink-0">
                                                      지원금O
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            ) : (
                                              /* 일반 실습 / 실습예정 / 복교 단일 막대 */
                                              <div className="flex items-center justify-between w-full min-w-0 gap-1.5 z-10 text-xs font-bold px-1">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                  <span className="bg-black/20 text-white text-[10px] px-1.5 py-0.2 rounded shrink-0 font-black">
                                                    {r.training_order}차
                                                  </span>
                                                  <span className="truncate font-black text-xs">{r.company || '업체미입력'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {r.stipend_status === 'O' && (
                                                    <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.2 rounded font-black shrink-0">
                                                      지원금O
                                                    </span>
                                                  )}
                                                  {startDateFormatted && (
                                                    <span className="text-xs font-mono font-extrabold text-white tracking-tight">
                                                      {startDateFormatted}~{endDateFormatted}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" sideOffset={6} className="bg-slate-900 text-white border-slate-700 text-xs p-3.5 space-y-2 rounded-xl shadow-2xl z-[9999] max-w-sm">
                                          <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <span className="font-black text-white text-sm truncate">{s.student_name}</span>
                                              <span className="text-slate-400 text-xs font-semibold shrink-0">({s.major} {s.class_info}반)</span>
                                            </div>
                                            <Badge className={cn(
                                              "text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs shrink-0", 
                                              isConverted ? "bg-purple-600 text-white" : isReturned ? "bg-rose-600 text-white" : (r.start_date && r.start_date > todayStr) ? "bg-sky-500 text-white" : "bg-emerald-600 text-white"
                                            )}>
                                              {isConverted ? "✨ 채용전환" : isReturned ? "🔄 복교" : (r.start_date && r.start_date > todayStr) ? "⏳ 실습예정" : "🟢 실습진행중"}
                                            </Badge>
                                          </div>

                                          <div className="space-y-1 text-xs text-slate-200">
                                            <p className="font-extrabold text-white flex items-center gap-1.5">
                                              <span>🏢 실습 업체:</span>
                                              <span className="text-emerald-300 font-black">{r.company || '미입력'}</span>
                                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-bold">({r.training_order}차 실습)</span>
                                            </p>
                                            <p className="text-slate-300 font-mono text-[11.5px] flex items-center gap-1">
                                              <span>📅 실습 기간:</span>
                                              <strong className="text-white font-bold">{r.start_date || '미정'} ~ {r.end_date || '미정'}</strong>
                                            </p>
                                            <p className="text-slate-300 text-[11.5px] flex items-center justify-between">
                                              <span>지원금 신청 여부:</span>
                                              <strong className={r.stipend_status === 'O' ? "text-emerald-400 font-black" : "text-slate-400 font-bold"}>
                                                {r.stipend_status === 'O' ? '신청완료 (O)' : '미신청 (X)'}
                                              </strong>
                                            </p>
                                          </div>

                                          {/* [채용전환 전용 상세 안내 카드] */}
                                          {isConverted && (
                                            <div className="p-2.5 rounded-lg bg-purple-950/80 border border-purple-500/50 space-y-1 text-xs text-purple-100 animate-in fade-in duration-200">
                                              <div className="flex items-center justify-between font-black text-purple-200 text-xs">
                                                <span className="flex items-center gap-1">✨ 채용전환 상세 정보</span>
                                                <span className="text-[10px] text-purple-300 font-bold font-mono">
                                                  {r.conversion_date && r.conversion_date > todayStr ? '⏳ 전환 예정' : '🎉 전환 완료'}
                                                </span>
                                              </div>
                                              <p className="text-[11.5px] text-purple-100 font-mono flex items-center justify-between pt-0.5">
                                                <span>채용 전환일:</span>
                                                <strong className="text-purple-200 font-black">{r.conversion_date || r.end_date || '미정'}</strong>
                                              </p>
                                              <p className="text-[11px] text-purple-200/90 font-mono flex items-center justify-between">
                                                <span>근무 유지 기간:</span>
                                                <strong className="text-emerald-300 font-black">{r.conversion_date || r.end_date || '전환일'} ~ 02.28 (졸업)</strong>
                                              </p>
                                            </div>
                                          )}

                                          {/* [복교 전용 상세 안내 카드] */}
                                          {isReturned && (
                                            <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/50 space-y-0.5 text-xs text-rose-100">
                                              <p className="font-black text-rose-300 text-xs flex items-center gap-1">⚠️ 복교 처리 정보</p>
                                              <p className="text-[11.5px] text-rose-100 font-medium">
                                                복교 사유: <strong className="text-white font-bold">{r.return_reason || '사유 미입력'}</strong>
                                              </p>
                                            </div>
                                          )}

                                          {/* [실습예정 전용 상세 안내 카드] */}
                                          {!isConverted && !isReturned && r.start_date && r.start_date > todayStr && (
                                            <div className="p-2 rounded-lg bg-sky-950/80 border border-sky-500/50 text-xs text-sky-100">
                                              <p className="font-black text-sky-300 text-xs flex items-center gap-1">⏳ 실습 파견 예정</p>
                                              <p className="text-[11.5px] text-sky-100 font-medium">
                                                <strong className="text-white font-bold">{r.start_date}</strong>부터 현장실습이 시작됩니다.
                                              </p>
                                            </div>
                                          )}

                                          <p className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-700/80 text-center font-medium">
                                            💡 클릭하면 실습 및 채용 정보를 바로 수정할 수 있습니다.
                                          </p>
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

            {/* ===== [MOBILE TIMELINE VIEW] (md 미만 모바일 전용: 가로 스크롤 0% 스마트폰 최적화) ===== */}
            <div className="block md:hidden flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50/50">
              {/* 모바일 고정 월 헤더 트랙 */}
              <div className="sticky top-0 z-30 bg-slate-100 border-b border-slate-200 flex text-[10px] font-extrabold text-slate-700 shadow-xs">
                <div className="w-28 shrink-0 p-2 pl-2.5 bg-slate-100 border-r border-slate-200 flex items-center font-extrabold text-[10px]">
                  학생 기본 정보
                </div>
                <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                  {timelineMonths.map((m, idx) => (
                    <div key={m.key} className={cn("py-2 text-center border-r border-slate-200/70 bg-slate-100/90 text-[9px] font-bold text-slate-800", idx === timelineMonths.length - 1 && "border-r-0")}>
                      {m.month}월
                    </div>
                  ))}
                </div>
              </div>

              {/* 모바일 학생별 타임라인 행 리스트 */}
              <div className="divide-y divide-slate-100 bg-white">
                {filteredStudents.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 italic text-xs font-medium">
                    조회 조건과 일치하는 실습 학생이 없습니다.
                  </div>
                ) : (
                  filteredStudents.map((s, sIdx) => {
                    const records = [...(s.training_records || [])].sort((a, b) => a.training_order - b.training_order);
                    const hasRecords = records.length > 0;

                    return (
                      <div key={s.id} onClick={() => handleOpenModal(s)} className="flex items-stretch hover:bg-slate-50 transition-colors cursor-pointer min-h-[48px]">
                        {/* 학생 학년 성명 & 학과 반 번호 컬럼 */}
                        <div className="w-28 shrink-0 p-1.5 pl-2 flex flex-col justify-center border-r border-slate-200/80 bg-white">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[9.5px] font-black text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100 shrink-0">
                              {s.grade || 3}학년
                            </span>
                            <span className="font-black text-slate-900 text-xs truncate">{s.student_name}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-500 font-semibold truncate mt-0.5">
                            {s.major} {s.class_info ? `${s.class_info}반` : ''} {s.student_number ? `${s.student_number}번` : ''}
                          </span>
                        </div>

                        {/* 100% 폭 화면 슬림 타임라인 바 */}
                        <div className="flex-1 relative bg-white flex flex-col justify-center p-1">
                          {/* 월 분할 배경 트랙 */}
                          <div className="absolute inset-0 grid pointer-events-none z-0" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                            {timelineMonths.map((m, idx) => (
                              <div key={m.key} className={cn("h-full border-r border-slate-100", idx === timelineMonths.length - 1 && "border-r-0")} />
                            ))}
                          </div>

                          {!hasRecords ? (
                            <span className="text-[9.5px] text-slate-300 italic text-center relative z-10">미배정</span>
                          ) : (
                            <div className="relative z-10 flex flex-col gap-1 w-full">
                              {records.map((r: any) => {
                                let startPct = 0;
                                let endPct = 100;
                                let convPct = 0;
                                
                                const isConverted = r.hiring_status === '채용전환';
                                const isReturned = r.hiring_status === '복교';
                                const isStipendDone = r.stipend_status === 'O';

                                if (r.start_date) {
                                  const d = parseISO(r.start_date);
                                  if (isValid(d)) startPct = Math.min(100, Math.max(0, (differenceInDays(d, timelineStart) / totalDays) * 100));
                                }
                                if (r.end_date) {
                                  const d = parseISO(r.end_date);
                                  if (isValid(d)) endPct = Math.min(100, Math.max(0, (differenceInDays(d, timelineStart) / totalDays) * 100));
                                }

                                const widthPct = Math.max(4, endPct - startPct);
                                const effectiveStatus = getEffectiveRecordStatus(r, todayStr);

                                return (
                                  <div 
                                    key={r.id}
                                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                    className={cn(
                                      "relative h-6.5 rounded-lg flex items-center justify-between px-1.5 text-[10px] font-black text-white shadow-2xs",
                                      effectiveStatus === 'upcoming' 
                                        ? "bg-gradient-to-r from-sky-400 to-sky-500 border border-sky-300"
                                        : isReturned
                                        ? "bg-gradient-to-r from-rose-500 to-rose-600 border border-rose-400"
                                        : effectiveStatus === 'converted'
                                        ? "bg-gradient-to-r from-purple-600 to-purple-700 border border-purple-400"
                                        : "bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400"
                                    )}
                                  >
                                    <span className="truncate">{r.company}</span>
                                    {isStipendDone && (
                                      <span className="bg-white text-blue-700 text-[8px] font-black px-1 rounded shadow-2xs shrink-0">O</span>
                                    )}
                                  </div>
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
        ) : (
          /* ===== [VIEW 2] 모바일 최적화 미니 스트립 막대(Concept 1) 카드 뷰 ===== */
          <div className="w-full p-3 sm:p-4 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredStudents.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 italic font-medium">
                  조회 조건과 일치하는 실습 학생 데이터가 없습니다.
                </div>
              ) : (
                filteredStudents.map((s, idx) => {
                  const records = [...(s.training_records || [])].sort((a, b) => a.training_order - b.training_order);
                  const hasRecords = records.length > 0;

                  return (
                    <Card key={s.id} className="bg-white border-slate-200/80 shadow-sm rounded-2xl p-3.5 space-y-3 hover:border-blue-300 transition-all flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* 상단 프로필 헤더 (학년 + 성명 학과 반 번호 + 휴대전화번호) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 px-2.5 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
                              {s.grade ? `${s.grade}학년` : '3학년'}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{s.student_name}</span>
                                <span className="text-xs text-slate-600 font-bold truncate">
                                  {s.major} {s.class_info ? `${s.class_info}반` : ''} {s.student_number ? `${s.student_number}번` : ''}
                                </span>
                              </h3>
                              <p className="text-[11px] text-slate-400 font-mono">{s.phone_number || '전화번호 미입력'}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenModal(s)}
                            className="h-7 px-2 text-[11px] font-bold text-blue-700 border-blue-200 hover:bg-blue-50 rounded-lg gap-1 shrink-0"
                          >
                            <Edit3 className="h-3 w-3" />
                            {isAdmin ? '실습 관리' : '실습 조회'}
                          </Button>
                        </div>

                        {/* 100% 폭 모바일 미니 스트립 막대 (Concept 1) */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                          {!hasRecords ? (
                            <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                              등록된 현장실습 이력이 없습니다.
                            </div>
                          ) : (
                            records.map((r: any) => {
                              let startPct = 0;
                              let endPct = 100;
                              let startDateFormatted = r.start_date || '미정';
                              let endDateFormatted = r.end_date || '미정';

                              const isConverted = r.hiring_status === '채용전환';
                              const isReturned = r.hiring_status === '복교';

                              if (r.start_date) {
                                const sDate = parseISO(r.start_date);
                                if (isValid(sDate)) {
                                  startDateFormatted = format(sDate, 'MM.dd');
                                  if (isBefore(sDate, timelineStart)) startPct = 0;
                                  else if (isAfter(sDate, timelineEnd)) startPct = 100;
                                  else startPct = Math.min(100, Math.max(0, (differenceInDays(sDate, timelineStart) / totalDays) * 100));
                                }
                              }

                              if (isConverted) {
                                endPct = 100;
                                endDateFormatted = '졸업';
                              } else if (r.end_date) {
                                const eDate = parseISO(r.end_date);
                                if (isValid(eDate)) {
                                  endDateFormatted = format(eDate, 'MM.dd');
                                  if (isBefore(eDate, timelineStart)) endPct = 0;
                                  else if (isAfter(eDate, timelineEnd)) endPct = 100;
                                  else endPct = Math.min(100, Math.max(0, (differenceInDays(eDate, timelineStart) / totalDays) * 100));
                                }
                              }

                              const barWidthPct = Math.max(8, endPct - startPct);

                              return (
                                <div key={r.id || r.training_order} className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                                  {/* 헤더: 차수, 업체명, 상태 뱃지, 지원금 버튼 */}
                                  <div className="flex items-center justify-between text-xs gap-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Badge variant="outline" className="bg-white font-extrabold text-slate-800 text-[10px] px-1.5 h-4 border-slate-300 shrink-0">
                                        {r.training_order}차
                                      </Badge>
                                      <span className="font-extrabold text-slate-900 truncate text-xs">{r.company || '업체 미지정'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge className={cn("text-[10px] font-extrabold px-1.5 py-0.2 rounded-full", isConverted ? "bg-purple-600 text-white" : isReturned ? "bg-rose-500 text-white" : "bg-emerald-600 text-white")}>
                                        {r.hiring_status || '진행중'}
                                      </Badge>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStipend(r.id, r.stipend_status)}
                                        className={cn(
                                          "px-1.5 py-0.5 rounded font-extrabold text-[10px] border transition-transform active:scale-95",
                                          r.stipend_status === 'O' ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-400 border-slate-200"
                                        )}
                                      >
                                        지원금 {r.stipend_status === 'O' ? 'O' : 'X'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* 100% 폭 모바일 월 트랙 (7월 · 8월 · 9월 · 10월 · 11월 · 12월 · 1월 · 2월) */}
                                  <div className="relative h-7 bg-slate-200/70 rounded-lg overflow-visible border border-slate-200 shadow-inner">
                                    {/* 월별 배경 세로 트랙 격자선 및 라벨 */}
                                    <div className="absolute inset-0 grid pointer-events-none overflow-hidden rounded-lg" style={{ gridTemplateColumns: `repeat(${timelineMonths.length}, minmax(0, 1fr))` }}>
                                      {timelineMonths.map((m, mIdx) => (
                                        <div key={m.key} className={cn("h-full border-r border-slate-300/40 flex items-end justify-center pb-0.5", mIdx === timelineMonths.length - 1 && "border-r-0")}>
                                          <span className="text-[8px] font-bold text-slate-400 leading-none">{m.month}월</span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* 100% 폭 트랙 위에 얹어지는 그라데이션 실습 기간 가로바 */}
                                    <div 
                                      className={cn(
                                        "absolute top-0.5 bottom-0.5 rounded-md shadow-md flex items-center px-1.5 transition-all z-10",
                                        isConverted 
                                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400 text-white"
                                          : isReturned
                                          ? "bg-gradient-to-r from-amber-500 to-rose-500 border-rose-400 text-white"
                                          : "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 border border-emerald-300 text-white"
                                      )}
                                      style={{
                                        left: `${startPct}%`,
                                        width: `${barWidthPct}%`
                                      }}
                                    >
                                      <span className="text-[9px] font-black tracking-tighter truncate drop-shadow-xs">
                                        {startDateFormatted} ~ {endDateFormatted}
                                      </span>
                                    </div>

                                    {/* 오늘 날짜 위치 마커 */}
                                    {todayPositionPercent > 0 && todayPositionPercent < 100 && (
                                      <div
                                        className="absolute top-0 bottom-0 z-20 pointer-events-none"
                                        style={{ left: `${todayPositionPercent}%` }}
                                      >
                                        {/* 세로 점선 */}
                                        <div className="absolute top-0 bottom-0 w-[1.5px] bg-red-500/80 border-l border-dashed border-red-400" />
                                        {/* 오늘 라벨 — 막대 위에 살짝 튀어나옴 */}
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded whitespace-nowrap leading-none shadow">
                                          오늘
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* 추가 상세 정보 */}
                                  {isConverted && r.conversion_date && (
                                    <p className="text-[10.5px] font-bold text-purple-700 bg-purple-50 p-1 px-2 rounded-lg border border-purple-100">
                                      🎉 채용 전환일: {r.conversion_date}
                                    </p>
                                  )}
                                  {isReturned && r.return_reason && (
                                    <p className="text-[10.5px] font-bold text-rose-700 bg-rose-50 p-1 px-2 rounded-lg border border-rose-100">
                                      ⚠️ 복교 사유: {r.return_reason}
                                    </p>
                                  )}
                                </div>
                              );
                            })
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

      {/* 실습 등록 및 편집 모달 (0ms 낙관적 실시간 즉시 반영 연동) */}
      <FieldTrainingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          router.refresh();
        }}
        student={selectedStudentForModal}
        isAdmin={isAdmin}
        onUpdateRecords={(studentId, updatedRecords) => {
          // [낙관적 0ms 실시간 즉시 반영]: 모달에서 저장/삭제 시 간트차트, KPI 통계, 필터 건수에 0.001초만에 즉시 반영
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, training_records: updatedRecords } : s));
          if (selectedStudentForModal && selectedStudentForModal.id === studentId) {
            setSelectedStudentForModal((prev: any) => prev ? { ...prev, training_records: updatedRecords } : null);
          }
        }}
      />
    </div>
  );
}
