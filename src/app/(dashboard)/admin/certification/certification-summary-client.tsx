'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FullStudentEvaluation, CertificationRank } from '@/lib/certification-calculator';
import { EvaluationSheetModal } from './evaluation-sheet-modal';
import { EvaluationEditModal } from './evaluation-edit-modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import {
  Award,
  Search,
  FileSpreadsheet,
  Edit3,
  FileText,
  Lock,
  GraduationCap,
  Users,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sparkles,
  UploadCloud,
  Gift,
  Trophy,
  ChevronDown,
  Info,
  RotateCcw,
  Check,
  ShieldCheck,
  Zap,
  History,
  FileUp,
  MoreHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  getCachedCertificationSummaryList,
  awardStudentItemAction,
  bulkAwardItemsAction,
  cancelRewardAction,
  exportRewardLedgerExcelAction
} from './actions';
import { 
  StudentRewardRecord,
  CertificationPrizeConfig,
  DEFAULT_CERTIFICATION_PRIZE_CONFIG,
} from '@/lib/certification-calculator';
import { GradeBulkAwardModal } from './grade-bulk-award-modal';
import { RetroactiveAwardModal } from './retroactive-award-modal';
import { RetroactiveExcelModal } from './retroactive-excel-modal';
import { PrizeSettingsModal } from './prize-settings-modal';

interface CertificationSummaryClientProps {
  initialEvaluations: FullStudentEvaluation[];
  currentGrade: number;
  baseYear: number;
  isAdmin: boolean;
  userProfile: any;
  masterCertificates?: any[];
  initialPrizeConfig?: CertificationPrizeConfig;
}

const TARGET_MAJOR_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '건설과',
  '스마트공간건축과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
  '스마트융함섬유과',
];

export function CertificationSummaryClient({
  initialEvaluations,
  currentGrade,
  baseYear,
  isAdmin,
  userProfile,
  masterCertificates = [],
  initialPrizeConfig,
}: CertificationSummaryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeGrade, setActiveGrade] = React.useState<number>(currentGrade);
  const [gradeDataMap, setGradeDataMap] = React.useState<Record<number, FullStudentEvaluation[]>>({
    [currentGrade]: initialEvaluations,
  });

  const [prizeConfig, setPrizeConfig] = React.useState<CertificationPrizeConfig>(
    initialPrizeConfig || DEFAULT_CERTIFICATION_PRIZE_CONFIG
  );
  const [isPrizeConfigModalOpen, setIsPrizeConfigModalOpen] = React.useState<boolean>(false);
  const [isLoadingGrade, setIsLoadingGrade] = React.useState<boolean>(false);

  const [selectedClass, setSelectedClass] = React.useState<string>('all');
  const [selectedMajor, setSelectedMajor] = React.useState<string>('all');
  const [rankFilter, setRankFilter] = React.useState<string>('all');
  const [onlyCertified, setOnlyCertified] = React.useState<boolean>(false);
  const [rewardFilter, setRewardFilter] = React.useState<'all' | 'prize_eligible' | 'prize_awarded' | 'award_eligible' | 'award_awarded'>('all');
  const [activeSemester, setActiveSemester] = React.useState<number>(1);
  const [search, setSearch] = React.useState<string>('');
  const [sortCriteria, setSortCriteria] = React.useState<'score_desc' | 'class_num' | 'score_asc' | 'name_asc'>('score_desc');

  // 체크박스 선택 (일괄 확정용)
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set());

  // 단일 확정 모달 상태
  const [awardModalTarget, setAwardModalTarget] = React.useState<{
    student: FullStudentEvaluation;
    rewardType: 'prize' | 'certificate_award';
    customItemName: string;
    remarks: string;
  } | null>(null);

  // 스냅샷 상세 조회 모달
  const [snapshotModalReward, setSnapshotModalReward] = React.useState<StudentRewardRecord | null>(null);

  // 로딩 상태
  const [isAwarding, setIsAwarding] = React.useState<boolean>(false);
  const [isBulkAwarding, setIsBulkAwarding] = React.useState<boolean>(false);
  const [isExportingLedger, setIsExportingLedger] = React.useState<boolean>(false);

  // 모달 상태
  const [sheetModalEval, setSheetModalEval] = React.useState<FullStudentEvaluation | null>(null);
  const [editModalEval, setEditModalEval] = React.useState<FullStudentEvaluation | null>(null);

  // 원클릭 학년 일괄 확정 및 소급 등록 모달 상태
  const [isGradeBulkModalOpen, setIsGradeBulkModalOpen] = React.useState<boolean>(false);
  const [retroSingleStudent, setRetroSingleStudent] = React.useState<FullStudentEvaluation | null>(null);
  const [isRetroSingleModalOpen, setIsRetroSingleModalOpen] = React.useState<boolean>(false);
  const [isRetroExcelModalOpen, setIsRetroExcelModalOpen] = React.useState<boolean>(false);

  const [pageSize, setPageSize] = React.useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = React.useState<number>(1);

  const currentEvaluations = gradeDataMap[activeGrade] || [];

  // 필터 또는 정렬 변경 시 페이지 1로 자동 리셋
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedStudentIds(new Set());
  }, [selectedClass, selectedMajor, rankFilter, onlyCertified, rewardFilter, search, sortCriteria, activeGrade, activeSemester, pageSize]);

  // 모달이 닫힐 때 Radix UI로 인해 body에 pointer-events: none이 남아 다른 버튼 클릭이 먹통되는 문제 원천 차단
  React.useEffect(() => {
    const unlockPointerEvents = () => {
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
        document.body.style.removeProperty('pointer-events');
        document.documentElement.style.pointerEvents = 'auto';
        document.documentElement.style.removeProperty('pointer-events');
      }
    };
    unlockPointerEvents();
    const t1 = setTimeout(unlockPointerEvents, 50);
    const t2 = setTimeout(unlockPointerEvents, 150);
    const t3 = setTimeout(unlockPointerEvents, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [
    isGradeBulkModalOpen,
    isRetroSingleModalOpen,
    isRetroExcelModalOpen,
    sheetModalEval,
    editModalEval,
    awardModalTarget,
    snapshotModalReward,
  ]);

  // 학년 변경 처리 (초고속 인메모리 캐싱 전환)
  const handleGradeChange = async (targetGradeNum: number) => {
    setActiveGrade(targetGradeNum);
    setSelectedClass('all');
    setSelectedMajor('all');
    setSelectedStudentIds(new Set());
    setCurrentPage(1);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('grade', String(targetGradeNum));
      window.history.replaceState(null, '', url.toString());
    }

    if (!gradeDataMap[targetGradeNum]) {
      setIsLoadingGrade(true);
      try {
        const data = await getCachedCertificationSummaryList(targetGradeNum);
        setGradeDataMap(prev => ({ ...prev, [targetGradeNum]: data }));
      } catch (err) {
        console.error('Failed to load grade data:', err);
      } finally {
        setIsLoadingGrade(false);
      }
    }
  };

  const refreshCurrentGradeData = async () => {
    try {
      const data = await getCachedCertificationSummaryList(activeGrade);
      // 현재 학년 데이터 갱신 및 타 학년 캐시 초기화(탭 전환 시 최신 서버 데이터 재로드 보장)
      setGradeDataMap({ [activeGrade]: data });
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  const handleOpenSingleAwardModal = (student: FullStudentEvaluation, rewardType: 'prize' | 'certificate_award') => {
    if (!isAdmin) {
      toast({ title: '권한 없음', description: '관리자만 포상을 확정할 수 있습니다.', variant: 'destructive' });
      return;
    }
    const defaultName = rewardType === 'prize'
      ? (student.rewardEligibility?.prize?.recommendedPrizeName || `${student.rank}등급 상품`)
      : '옥저인재인증상';
    setAwardModalTarget({
      student,
      rewardType,
      customItemName: defaultName,
      remarks: rewardType === 'prize' && student.rewardEligibility?.prize?.isUpgrade ? '승급 수령' : ''
    });
  };

  const handleConfirmSingleAward = async () => {
    if (!awardModalTarget) return;
    setIsAwarding(true);
    try {
      const res = await awardStudentItemAction({
        studentId: awardModalTarget.student.studentId,
        rewardType: awardModalTarget.rewardType,
        academicYear: baseYear,
        semester: activeSemester,
        gradeNum: activeGrade,
        itemName: awardModalTarget.customItemName,
        remarks: awardModalTarget.remarks,
      });

      if (!res.success) {
        toast({
          title: '수령 확정 실패',
          description: res.error || '오류가 발생했습니다.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '🎉 수령 확정 완료',
          description: `${awardModalTarget.student.studentName} 학생의 ${awardModalTarget.customItemName} 수령이 확정되었으며, 스냅샷이 영구 보존되었습니다.`,
        });
        setAwardModalTarget(null);
        await refreshCurrentGradeData();
      }
    } catch (err: any) {
      toast({
        title: '포상 확정 오류',
        description: err?.message || '처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsAwarding(false);
    }
  };

  const handleBulkAward = async (rewardType: 'prize' | 'certificate_award') => {
    if (!isAdmin) {
      toast({ title: '권한 없음', description: '관리자만 일괄 확정을 실행할 수 있습니다.', variant: 'destructive' });
      return;
    }
    if (selectedStudentIds.size === 0) return;
    const typeLabel = rewardType === 'prize' ? '등급별 상품' : '옥저인재인증상';
    const confirmMsg = `선택된 ${selectedStudentIds.size}명 중 자격 대상자에게 ${activeSemester}학기 ${typeLabel} 수령을 일괄 확정하시겠습니까?\n\n(확정 시점의 종합 점수와 4대 영역 점수가 영구 스냅샷으로 보존되며, 중복 수령 대상자는 자동 제외됩니다)`;
    if (!window.confirm(confirmMsg)) return;

    setIsBulkAwarding(true);
    try {
      const res = await bulkAwardItemsAction({
        studentIds: Array.from(selectedStudentIds),
        rewardType,
        academicYear: baseYear,
        semester: activeSemester,
        gradeNum: activeGrade,
      });

      if (!res.success) {
        toast({
          title: '일괄 확정 실패',
          description: res.error || '오류가 발생했습니다.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: '🎉 일괄 수령 확정 완료',
          description: `총 ${res.count}명이 정상 확정되었으며, ${res.skippedCount}명(기수령/기준미달)은 중복 방지 제외되었습니다.`,
        });
        setSelectedStudentIds(new Set());
        await refreshCurrentGradeData();
      }
    } catch (err: any) {
      toast({
        title: '일괄 확정 오류',
        description: err?.message || '처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkAwarding(false);
    }
  };

  const handleCancelReward = async (rewardId: string) => {
    if (!window.confirm('정말 이 수령 기록을 취소하시겠습니까?\n취소 시 중복 락이 해제되어 다시 지급 가능한 상태로 롤백됩니다.')) {
      return;
    }
    try {
      const res = await cancelRewardAction({ rewardId, gradeNum: activeGrade });
      if (!res.success) {
        toast({ title: '취소 실패', description: res.error || '오류 발생', variant: 'destructive' });
      } else {
        toast({ title: '수령 기록 취소 완료', description: '정상적으로 롤백되었습니다.' });
        setSnapshotModalReward(null);
        await refreshCurrentGradeData();
      }
    } catch (err: any) {
      toast({ title: '오류 발생', description: err?.message, variant: 'destructive' });
    }
  };

  const handleExportRewardLedger = async () => {
    if (!isAdmin) {
      toast({ title: '권한 없음', description: '관리자만 공문서 수령 대장 엑셀을 다운로드할 수 있습니다.', variant: 'destructive' });
      return;
    }
    setIsExportingLedger(true);
    try {
      const res = await exportRewardLedgerExcelAction({
        academicYear: baseYear,
        semester: activeSemester,
        grade: activeGrade,
        selectedClass: 'all',
      });

      if (!res.success || !res.data) {
        toast({ title: '엑셀 생성 실패', description: res.error || '오류 발생', variant: 'destructive' });
        return;
      }

      const byteCharacters = atob(res.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.fileName || `${baseYear}학년도_${activeGrade}학년_옥저인재인증_수령대장.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '📄 공문서 수령 대장 엑셀 다운로드 완료',
        description: '공문서 첨부 규격의 A4 수령 대장이 정상 다운로드되었습니다.',
      });
    } catch (err: any) {
      toast({ title: '다운로드 오류', description: err?.message, variant: 'destructive' });
    } finally {
      setIsExportingLedger(false);
    }
  };

  // 1. 고유 학과 및 학반 목록 추출 (지정 학과 우선순위 및 자연수 정렬)
  const uniqueMajors = React.useMemo(() => {
    const s = new Set<string>();
    currentEvaluations.forEach(e => { if (e.major) s.add(e.major); });
    return Array.from(s).sort((a, b) => {
      const idxA = TARGET_MAJOR_ORDER.findIndex(m => a.includes(m) || m.includes(a));
      const idxB = TARGET_MAJOR_ORDER.findIndex(m => b.includes(m) || m.includes(b));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, 'ko');
    });
  }, [currentEvaluations]);

  const uniqueClasses = React.useMemo(() => {
    const s = new Set<string>();
    currentEvaluations.forEach(e => { if (e.classInfo) s.add(e.classInfo); });
    return Array.from(s).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [currentEvaluations]);

  // 2. 권한 체크 헬퍼 (관리자 또는 전체 교사)
  const canEditStudent = (student: FullStudentEvaluation) => {
    if (isAdmin) return true;
    if (userProfile?.role === 'teacher') return true;
    return false;
  };

  // 3. 통계 계산
  const stats = React.useMemo(() => {
    const total = currentEvaluations.length;
    if (total === 0) {
      return { 
        avgScore: 0, 
        certifiedCount: 0, 
        certifiedRate: 0, 
        rankCounts: { S: 0, A: 0, B: 0, C: 0, D: 0 },
        prizeEligibleCount: 0,
        prizeAwardedCount: 0,
        awardEligibleCount: 0,
        awardAwardedCount: 0,
      };
    }

    const totalSum = currentEvaluations.reduce((acc, e) => acc + e.totalScore, 0);
    const avgScore = Math.round((totalSum / total) * 10) / 10;
    const certifiedCount = currentEvaluations.filter(e => e.isCertified).length;
    const certifiedRate = Math.round((certifiedCount / total) * 1000) / 10;

    const rankCounts = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    currentEvaluations.forEach(e => {
      rankCounts[e.rank] = (rankCounts[e.rank] || 0) + 1;
    });

    const prizeEligibleCount = currentEvaluations.filter(e => e.rewardEligibility?.prize?.eligible).length;
    const prizeAwardedCount = currentEvaluations.filter(e => (e.rewardsHistory || []).some(r => r.rewardType === 'prize' && r.status !== 'cancelled')).length;
    const awardEligibleCount = currentEvaluations.filter(e => e.rewardEligibility?.certificateAward?.eligible).length;
    const awardAwardedCount = currentEvaluations.filter(e => (e.rewardsHistory || []).some(r => r.rewardType === 'certificate_award' && r.status !== 'cancelled')).length;

    return { 
      avgScore, 
      certifiedCount, 
      certifiedRate, 
      rankCounts,
      prizeEligibleCount,
      prizeAwardedCount,
      awardEligibleCount,
      awardAwardedCount,
    };
  }, [currentEvaluations]);

  // 4. 필터링 및 정렬 로직 (기본: 종합 점수 높은 순 -> 학반/번호 자연수 순)
  const filteredList = React.useMemo(() => {
    return currentEvaluations
      .filter(e => {
        if (selectedClass !== 'all' && e.classInfo !== selectedClass) return false;
        if (selectedMajor !== 'all' && e.major !== selectedMajor) return false;
        if (rankFilter !== 'all' && e.rank !== rankFilter) return false;
        if (onlyCertified && !e.isCertified) return false;

        if (rewardFilter === 'prize_eligible' && !e.rewardEligibility?.prize?.eligible) return false;
        if (rewardFilter === 'prize_awarded' && !(e.rewardsHistory || []).some(r => r.rewardType === 'prize' && r.status !== 'cancelled')) return false;
        if (rewardFilter === 'award_eligible' && !e.rewardEligibility?.certificateAward?.eligible) return false;
        if (rewardFilter === 'award_awarded' && !(e.rewardsHistory || []).some(r => r.rewardType === 'certificate_award' && r.status !== 'cancelled')) return false;

        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = e.studentName.toLowerCase().includes(q);
          const matchNum = e.studentNumber.includes(q);
          const matchMajor = e.major.toLowerCase().includes(q);
          if (!matchName && !matchNum && !matchMajor) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortCriteria === 'score_desc') {
          // 1차: 종합 점수 내림차순
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          // 2차 동점 시: 학반 자연수 오름차순
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          // 3차: 번호 자연수 오름차순
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'class_num') {
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'score_asc') {
          if (a.totalScore !== b.totalScore) {
            return a.totalScore - b.totalScore;
          }
          const classComp = a.classInfo.localeCompare(b.classInfo, undefined, { numeric: true, sensitivity: 'base' });
          if (classComp !== 0) return classComp;
          return a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true, sensitivity: 'base' });
        }

        if (sortCriteria === 'name_asc') {
          return a.studentName.localeCompare(b.studentName, 'ko');
        }

        return 0;
      });
  }, [currentEvaluations, selectedClass, selectedMajor, rankFilter, onlyCertified, rewardFilter, search, sortCriteria]);

  const totalPages = pageSize === 'all' ? 1 : (Math.ceil(filteredList.length / pageSize) || 1);

  const paginatedList = React.useMemo(() => {
    if (pageSize === 'all') return filteredList;
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // 5. 엑셀 다운로드 (동적 라이브러리 로드로 초기 화면 초고속화)
  const handleExportExcel = async () => {
    if (!isAdmin) {
      toast({ title: '권한 없음', description: '관리자만 종합 평가 엑셀을 다운로드할 수 있습니다.', variant: 'destructive' });
      return;
    }
    if (filteredList.length === 0) return;

    const XLSX = await import('xlsx');

    const exportRows = filteredList.map(e => ({
      '학년': `${activeGrade}학년`,
      '학과': e.major,
      '학반': e.classInfo,
      '번호': e.studentNumber,
      '성명': e.studentName,
      '종합점수': e.totalScore,
      '인증등급': `${e.rank}랭크`,
      '인증서발급여부': e.isCertified ? '발급대상' : '미달',
      '직업공통능력(25점)': e.vocationalCommonScore,
      '전공능력(25점)': e.majorScore,
      '취업역량강화(25점)': e.employmentScore,
      '인성능력(25점)': e.characterScore,
      '출결점수(10점)': e.details.attendance.score,
      '자격증목록': e.certificatesList.join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${activeGrade}학년_옥저인재인증평가`);
    XLSX.writeFile(wb, `${baseYear}학년도_${activeGrade}학년_옥저인재인증제_평가결과.xlsx`);
  };


  const getRankBadge = (rank: CertificationRank) => {
    switch (rank) {
      case 'S': return <Badge className="bg-amber-500 hover:bg-amber-600 font-extrabold text-white">S랭크</Badge>;
      case 'A': return <Badge className="bg-blue-600 hover:bg-blue-700 font-extrabold text-white">A랭크</Badge>;
      case 'B': return <Badge className="bg-emerald-600 hover:bg-emerald-700 font-extrabold text-white">B랭크</Badge>;
      case 'C': return <Badge className="bg-slate-500 hover:bg-slate-600 font-extrabold text-white">C랭크</Badge>;
      default: return <Badge className="bg-rose-500 hover:bg-rose-600 font-extrabold text-white">D랭크</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-full pb-20 sm:pb-16">
      {/* 1. 상단 종합 현황 KPI 대시보드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">평균 인증 점수</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.avgScore}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 ml-1">/ 100점</span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">인증 대상 (70점↑)</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Award className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-600">{stats.certifiedCount}</span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-600">명</span>
              <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded ml-0.5">
                {stats.certifiedRate}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">최상위 S·A 랭크</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-amber-600">{stats.rankCounts.S + stats.rankCounts.A}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 ml-1">
              명 (S:{stats.rankCounts.S} / A:{stats.rankCounts.A})
            </span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs rounded-xl p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500">평가 대상 인원</span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{currentEvaluations.length}</span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 ml-1">명 재학</span>
          </div>
        </Card>
      </div>

      {/* 2. 필터 툴바 & 엑셀 액션 */}
      <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl p-3 sm:p-4 shrink-0">
        <div className="flex flex-col gap-3 sm:gap-4">
          
          {/* 상단 1열: 학년/학기 선택 + 검색창 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* 학년 및 학기 탭 선택 */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="grid grid-cols-3 sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                {[3, 2, 1].map((g) => (
                  <Button
                    key={g}
                    type="button"
                    variant={activeGrade === g ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleGradeChange(g)}
                    className={cn(
                      "h-8 sm:h-7 px-3 text-xs font-extrabold rounded-lg transition-all",
                      activeGrade === g ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {g}학년
                  </Button>
                ))}
              </div>

              {/* 학년도 배지 */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50/90 border border-indigo-200/80 rounded-xl text-xs font-black text-indigo-700 shadow-2xs shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                <span>{baseYear}학년도 인증제</span>
              </div>
            </div>

            {/* 검색창 */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="학생명, 학번, 학과 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 sm:h-8 text-xs bg-slate-50/80 border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* 중단 2열: 학과/학반 선택 & 랭크 & 포상 필터 */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
            {/* 학과 & 학반 선택 */}
            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[135px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="전체 학과" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-semibold">전체 학과</SelectItem>
                  {uniqueMajors.map(m => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-[115px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="전체 반" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-semibold">전체 학반</SelectItem>
                  {uniqueClasses.map(c => (
                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 등급 선택 */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 overflow-x-auto custom-scrollbar shrink-0">
              {['all', 'S', 'A', 'B', 'C', 'D'].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={rankFilter === r ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setRankFilter(r)}
                  className={cn(
                    "h-7 px-2.5 text-[11px] font-bold rounded-lg transition-all shrink-0",
                    rankFilter === r ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {r === 'all' ? '전체' : `${r}랭크`}
                </Button>
              ))}
            </div>

            {/* 인증 대상만 토글 */}
            <Button
              type="button"
              variant={onlyCertified ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOnlyCertified(!onlyCertified)}
              className={cn(
                "h-9 sm:h-8 text-xs font-bold rounded-xl border gap-1.5 transition-all w-full sm:w-auto justify-center",
                onlyCertified 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs" 
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>70점↑ 인증 대상만 ({stats.certifiedCount}명)</span>
            </Button>

            {/* 상품 지급 대상자만 토글 */}
            <Button
              type="button"
              variant={rewardFilter === 'prize_eligible' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRewardFilter(rewardFilter === 'prize_eligible' ? 'all' : 'prize_eligible')}
              className={cn(
                "h-9 sm:h-8 text-xs font-bold rounded-xl border gap-1.5 transition-all w-full sm:w-auto justify-center",
                rewardFilter === 'prize_eligible'
                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Gift className="h-3.5 w-3.5 text-blue-500" />
              <span>상품 지급 대상 ({stats.prizeEligibleCount}명)</span>
            </Button>

            {/* 옥저인재인증상 수여 대상자만 토글 */}
            <Button
              type="button"
              variant={rewardFilter === 'award_eligible' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRewardFilter(rewardFilter === 'award_eligible' ? 'all' : 'award_eligible')}
              className={cn(
                "h-9 sm:h-8 text-xs font-bold rounded-xl border gap-1.5 transition-all w-full sm:w-auto justify-center",
                rewardFilter === 'award_eligible'
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>인증상 수여 대상 ({stats.awardEligibleCount}명)</span>
            </Button>
          </div>

          {/* 하단 3열: 정렬 & 표시개수 & 엑셀 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:flex gap-2">
              {/* 정렬 기준 선택 */}
              <Select value={sortCriteria} onValueChange={(val: any) => setSortCriteria(val)}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[140px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score_desc" className="text-xs font-semibold">🏆 점수 높은순 (기본)</SelectItem>
                  <SelectItem value="class_num" className="text-xs">🔢 학반/번호순</SelectItem>
                  <SelectItem value="score_asc" className="text-xs">📉 점수 낮은순</SelectItem>
                  <SelectItem value="name_asc" className="text-xs">🔤 이름 가나다순</SelectItem>
                </SelectContent>
              </Select>

              {/* 표시 개수 선택 */}
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(val === 'all' ? 'all' : Number(val))}>
                <SelectTrigger className="h-8 text-xs w-full sm:w-[120px] bg-slate-50/80 border-slate-200 rounded-xl font-medium">
                  <SelectValue placeholder="표시 개수" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">전체 보기 (전원)</SelectItem>
                  <SelectItem value="50" className="text-xs">50명씩 보기</SelectItem>
                  <SelectItem value="100" className="text-xs">100명씩 보기</SelectItem>
                  <SelectItem value="200" className="text-xs">200명씩 보기</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 우측 액션 버튼 영역 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 모든 사용자가 접근 가능한 엑셀 일괄 입력 버튼 */}
              <Link href="/admin/certification/import">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50/50 border-slate-200 rounded-xl gap-1.5 shadow-2xs transition-all"
                  title="봉사활동, 직기초, 취업역량, 예체능/대회 실적 엑셀 일괄 입력/등록"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
                  <span>엑셀 일괄 입력</span>
                </Button>
              </Link>

              {/* 관리자 전용 액션 버튼들 (일괄 확정, 소급 등록, 공문서 대장, 상품 설정, 종합 평가 엑셀) */}
              {isAdmin && (
                <>
                  {/* 원클릭 대상자 일괄 확정 버튼 */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsGradeBulkModalOpen(true)}
                    className="h-8 px-3 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-xl gap-1.5 shadow-xs transition-all hover:scale-[1.02]"
                  >
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                    <span>⚡ 대상자 일괄 확정</span>
                  </Button>

                  {/* 과거 수령 소급 등록 드롭다운 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border-slate-200 rounded-xl gap-1.5 shadow-2xs"
                      >
                        <History className="h-3.5 w-3.5 text-slate-600" />
                        <span>과거 수령 소급 등록</span>
                        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-lg border border-slate-200">
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setIsRetroExcelModalOpen(true);
                        }}
                        className="text-xs font-semibold py-2 cursor-pointer gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>📄 엑셀 일괄 소급 등록</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setRetroSingleStudent(null);
                          setIsRetroSingleModalOpen(true);
                        }}
                        className="text-xs font-semibold py-2 cursor-pointer gap-2"
                      >
                        <Edit3 className="h-4 w-4 text-indigo-600" />
                        <span>✏️ 개별 학생 소급 등록</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* 공문서 첨부용 엑셀 대장 버튼 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isExportingLedger}
                    onClick={handleExportRewardLedger}
                    className="h-8 px-3 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200 rounded-xl gap-1.5 shadow-2xs transition-all"
                    title="공문서 첨부용 옥저인재인증제 수령 대장 엑셀 다운로드 (학과-반별 개별 시트 및 총괄 요약)"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{isExportingLedger ? '엑셀 생성 중...' : '공문서 수령 대장 엑셀'}</span>
                  </Button>

                  {/* 🎁 등급별 상품 설정 버튼 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrizeConfigModalOpen(true)}
                    className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-pink-700 bg-white hover:bg-pink-50/50 border-slate-200 rounded-xl gap-1.5 shadow-2xs transition-all"
                    title="인증제 등급별 상품 및 인증상 명칭 설정"
                  >
                    <Gift className="h-3.5 w-3.5 text-pink-600" />
                    <span>상품 설정</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="h-8 px-3 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white border-slate-200 rounded-xl gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>종합 평가 엑셀</span>
                  </Button>
                </>
              )}
            </div>
          </div>

        </div>
      </Card>

      {/* 3. 학생 종합 평가 목록 (데스크톱: 테이블 / 모바일: 카드 리스트) */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <span className="text-xs font-bold text-slate-500">
            총 <span className="text-indigo-600 font-extrabold">{filteredList.length}</span>명 중{' '}
            <span className="text-slate-800 font-extrabold">
              {filteredList.length === 0 ? 0 : pageSize === 'all' ? `전체 ${filteredList.length}` : `${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredList.length)}`}
            </span>
            명 {pageSize !== 'all' && `(${currentPage} / ${totalPages}p)`}
          </span>

          {selectedStudentIds.size > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl shadow-2xs">
              <span className="text-xs font-bold text-indigo-900">
                선택 <span className="text-indigo-600 font-extrabold">{selectedStudentIds.size}</span>명:
              </span>
              <Button
                type="button"
                size="sm"
                disabled={isBulkAwarding}
                onClick={() => handleBulkAward('prize')}
                className="h-6 px-2 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1 shadow-2xs"
              >
                <Gift className="h-3 w-3" />
                <span>상품 확정</span>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isBulkAwarding}
                onClick={() => handleBulkAward('certificate_award')}
                className="h-6 px-2 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg gap-1 shadow-2xs"
              >
                <Trophy className="h-3 w-3" />
                <span>인증상 수여</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedStudentIds(new Set())}
                className="h-6 px-1.5 text-[11px] text-slate-500 hover:text-slate-800"
              >
                선택 해제
              </Button>
            </div>
          )}
        </div>

        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden flex flex-col">
          
          {/* ========================================================================= */}
          {/* [모바일 전용] 학생 카드 뷰 (화면폭 < 768px) */}
          {/* ========================================================================= */}
          <div className="block md:hidden divide-y divide-slate-100">
            {paginatedList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                조회된 학생 평가 데이터가 없습니다.
              </div>
            ) : (
              paginatedList.map((student) => {
                const hasEditAuth = canEditStudent(student);
                const isSelected = selectedStudentIds.has(student.studentId);

                const prizeRewards = (student.rewardsHistory || []).filter(r => r.rewardType === 'prize' && r.status !== 'cancelled');
                const latestPrize = prizeRewards[prizeRewards.length - 1];
                const prizeEligible = student.rewardEligibility?.prize?.eligible;

                const awardRecord = (student.rewardsHistory || []).find(r => r.rewardType === 'certificate_award' && r.status !== 'cancelled');
                const awardEligible = student.rewardEligibility?.certificateAward?.eligible;

                return (
                  <div key={student.studentId} className={cn(
                    "p-3.5 sm:p-4 flex flex-col gap-3 transition-colors",
                    isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/60"
                  )}>
                    {/* 상단: 체크박스 + 학생 정보 + 랭크 배지 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedStudentIds);
                            if (checked) next.add(student.studentId);
                            else next.delete(student.studentId);
                            setSelectedStudentIds(next);
                          }}
                          className="mt-0.5"
                          aria-label={`${student.studentName} 선택`}
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                              {student.studentName}
                            </span>
                            <span className="text-xs text-slate-400 font-medium shrink-0">
                              ({student.studentNumber}번)
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                            {student.major} • <strong className="text-slate-700">{student.classInfo}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {getRankBadge(student.rank)}
                        {student.isCertified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                            인증 대상
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
                            미달
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 점수 진행바 */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-bold text-slate-600">종합 인증 점수</span>
                        <span className="font-black text-indigo-700 text-sm">
                          {student.totalScore}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">/ 100점</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, student.totalScore)}%` }}
                        />
                      </div>
                    </div>

                    {/* 4대 영역별 점수 4열 그리드 */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">직업공통(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.vocationalCommonScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">전공능력(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.majorScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">취업역량(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.employmentScore}점</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[9px] text-slate-400 block truncate font-medium">인성능력(25)</span>
                        <span className="font-extrabold text-slate-800 text-xs">{student.characterScore}점</span>
                      </div>
                    </div>

                    {/* 포상 및 인증상 수령 상태 (모바일) */}
                    <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-slate-600 font-bold">
                          <Gift className="h-3.5 w-3.5 text-blue-600" />
                          <span>등급 상품:</span>
                        </div>
                        <div>
                          {latestPrize ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSnapshotModalReward(latestPrize)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[10px] font-bold"
                              >
                                <span>{latestPrize.itemName} 수령</span>
                                <Info className="h-2.5 w-2.5 opacity-70" />
                              </button>
                              {prizeEligible && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenSingleAwardModal(student, 'prize')}
                                  className="h-5 px-1.5 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded"
                                >
                                  승급확정
                                </Button>
                              )}
                            </div>
                          ) : prizeEligible ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenSingleAwardModal(student, 'prize')}
                              className="h-6 px-2 text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
                            >
                              상품 확정
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {student.rank === 'D' ? 'D랭크 제외' : '대상 아님'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center gap-1 text-slate-600 font-bold">
                          <Trophy className="h-3.5 w-3.5 text-amber-600" />
                          <span>옥저인재인증상:</span>
                        </div>
                        <div>
                          {awardRecord ? (
                            <button
                              type="button"
                              onClick={() => setSnapshotModalReward(awardRecord)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold"
                            >
                              <span>수여 완료</span>
                              <Info className="h-2.5 w-2.5 opacity-70" />
                            </button>
                          ) : awardEligible ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenSingleAwardModal(student, 'certificate_award')}
                              className="h-6 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg"
                            >
                              인증상 수여
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {student.totalScore < 70 ? '70점 미달' : '대상 아님'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 모바일 액션 버튼 바 */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSheetModalEval(student)}
                        className="h-8 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 rounded-xl gap-1.5 justify-center"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>평가표 보기</span>
                      </Button>

                      {hasEditAuth ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditModalEval(student)}
                          className="h-8 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border-slate-200 rounded-xl gap-1.5 justify-center"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                          <span>실적 수정</span>
                        </Button>
                      ) : (
                        <div className="h-8 flex items-center justify-center gap-1 text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60 select-none">
                          <Lock className="h-3 w-3" />
                          <span>조회 전용</span>
                        </div>
                      )}

                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRetroSingleStudent(student);
                            setIsRetroSingleModalOpen(true);
                          }}
                          className="col-span-2 h-7 text-[11px] font-medium text-slate-500 hover:text-indigo-600 gap-1.5 justify-center border border-dashed border-slate-200 rounded-xl"
                        >
                          <History className="h-3 w-3 text-slate-400" />
                          <span>과거 수령 이력 소급 등록</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ========================================================================= */}
          {/* [태블릿/데스크톱 전용] 종합 평가 테이블 (화면폭 >= 768px) */}
          {/* ========================================================================= */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="text-xs table-fixed w-full min-w-[1080px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  {isAdmin && (
                    <TableHead className="w-[40px] text-center">
                      <Checkbox
                        checked={paginatedList.length > 0 && paginatedList.every(s => selectedStudentIds.has(s.studentId))}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedStudentIds);
                          if (checked) {
                            paginatedList.forEach(s => next.add(s.studentId));
                          } else {
                            paginatedList.forEach(s => next.delete(s.studentId));
                          }
                          setSelectedStudentIds(next);
                        }}
                        aria-label="현재 페이지 전체 선택"
                      />
                    </TableHead>
                  )}
                  <TableHead className="font-extrabold text-slate-700 w-[160px]">학생 정보</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[85px]">종합 점수</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[80px]">인증 등급</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[95px]">인증서 발급</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[230px]">4대 영역별 점수</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[160px]">🎁 등급별 상품</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[130px]">🏆 옥저인재인증상</TableHead>
                  <TableHead className="font-extrabold text-slate-700 text-center w-[110px]">평가 및 관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-12 text-slate-400">
                      조회된 학생 평가 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedList.map((student) => {
                    const hasEditAuth = canEditStudent(student);
                    const isSelected = selectedStudentIds.has(student.studentId);

                    const prizeRewards = (student.rewardsHistory || []).filter(r => r.rewardType === 'prize' && r.status !== 'cancelled');
                    const latestPrize = prizeRewards[prizeRewards.length - 1];
                    const prizeEligible = student.rewardEligibility?.prize?.eligible;

                    const awardRecord = (student.rewardsHistory || []).find(r => r.rewardType === 'certificate_award' && r.status !== 'cancelled');
                    const awardEligible = student.rewardEligibility?.certificateAward?.eligible;

                    return (
                      <TableRow key={student.studentId} className={cn(
                        "transition-colors",
                        isSelected ? "bg-indigo-50/40 hover:bg-indigo-50/70" : "hover:bg-slate-50/60"
                      )}>
                        {/* 0. 선택 체크박스 (관리자 전용) */}
                        {isAdmin && (
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedStudentIds);
                                if (checked) next.add(student.studentId);
                                else next.delete(student.studentId);
                                setSelectedStudentIds(next);
                              }}
                              aria-label={`${student.studentName} 선택`}
                            />
                          </TableCell>
                        )}

                        {/* 1. 학생 정보 */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">{student.studentName}</span>
                              <span className="text-[11px] text-slate-400 font-medium">({student.studentNumber}번)</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <span>{student.major}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-slate-700">{student.classInfo}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. 종합 점수 */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base font-black text-indigo-700">
                              {student.totalScore}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">점</span>
                            </span>
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 rounded-full transition-all"
                                style={{ width: `${Math.min(100, student.totalScore)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. 인증 등급 */}
                        <TableCell className="text-center">
                          {getRankBadge(student.rank)}
                        </TableCell>

                        {/* 4. 인증서 발급 */}
                        <TableCell className="text-center">
                          {student.isCertified ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[11px] gap-1 px-2 py-0.5">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>발급 대상</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-semibold text-[11px] px-2 py-0.5">
                              미달
                            </Badge>
                          )}
                        </TableCell>

                        {/* 5. 4대 영역별 점수 */}
                        <TableCell>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-center text-[10px]">
                            <div className="bg-slate-50 p-1 rounded-md border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">직공</span>
                              <span className="font-bold text-slate-800">{student.vocationalCommonScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-md border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">전공</span>
                              <span className="font-bold text-slate-800">{student.majorScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-md border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">취업</span>
                              <span className="font-bold text-slate-800">{student.employmentScore}</span>
                            </div>
                            <div className="bg-slate-50 p-1 rounded-md border border-slate-200/60">
                              <span className="text-slate-400 block text-[9px]">인성</span>
                              <span className="font-bold text-slate-800">{student.characterScore}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 6. 🎁 등급별 상품 수령 */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            {latestPrize ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setSnapshotModalReward(latestPrize)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[11px] font-bold transition-all shadow-2xs group"
                                  title="클릭 시 확정 당시 스냅샷 확인 및 취소"
                                >
                                  <Gift className="h-3 w-3 text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
                                  <span className="truncate max-w-[95px]">{latestPrize.itemName}</span>
                                </button>
                                <span className="text-[9px] text-slate-400">
                                  {latestPrize.awardedDate ? latestPrize.awardedDate.replace(/-/g, '.') : `${latestPrize.academicYear}년`}
                                </span>
                                {isAdmin && prizeEligible && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleOpenSingleAwardModal(student, 'prize')}
                                    className="h-5 px-1.5 text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-md mt-0.5 shadow-2xs"
                                  >
                                    🚀 승급 추가확정
                                  </Button>
                                )}
                              </div>
                            ) : prizeEligible ? (
                              isAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenSingleAwardModal(student, 'prize')}
                                  className="h-6 px-2 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg gap-1 shadow-2xs"
                                >
                                  <Gift className="h-3 w-3" />
                                  <span>확정</span>
                                </Button>
                              ) : (
                                <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  지급 대상
                                </span>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {student.rank === 'D' ? 'D랭크 제외' : '대상 아님'}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 7. 🏆 옥저인재인증상 */}
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {awardRecord ? (
                              <div className="flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => setSnapshotModalReward(awardRecord)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-black transition-all shadow-2xs group"
                                  title="클릭 시 확정 당시 스냅샷 확인 및 취소"
                                >
                                  <Trophy className="h-3 w-3 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
                                  <span>수여 완료</span>
                                </button>
                                <span className="text-[9px] text-amber-700/80 font-medium mt-0.5">
                                  {awardRecord.awardedDate ? awardRecord.awardedDate.replace(/-/g, '.') : `${awardRecord.academicYear}년`}
                                </span>
                              </div>
                            ) : awardEligible ? (
                              isAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleOpenSingleAwardModal(student, 'certificate_award')}
                                  className="h-6 px-2 text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg gap-1 shadow-2xs"
                                >
                                  <Trophy className="h-3 w-3" />
                                  <span>인증상 수여</span>
                                </Button>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  수여 대상
                                </span>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {student.totalScore < 70 ? '70점 미달' : '대상 아님'}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* 8. 평가 및 관리 액션 버튼 */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSheetModalEval(student)}
                              className="h-7 px-2 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200 rounded-lg gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>평가표</span>
                            </Button>

                            {hasEditAuth ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setEditModalEval(student)}
                                className="h-7 px-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border-slate-200 rounded-lg gap-1"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                <span>수정</span>
                              </Button>
                            ) : (
                              <div className="text-[11px] text-slate-300 flex items-center gap-0.5 px-1.5 py-1 select-none" title="해당 학급 담임교사 또는 관리자만 수정 가능합니다.">
                                <Lock className="h-3 w-3" />
                                <span>조회</span>
                              </div>
                            )}

                            {/* 과거 수령 소급 등록 더보기 드롭다운 */}
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-6 p-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                    title="더보기 (소급 등록)"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-slate-200">
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setRetroSingleStudent(student);
                                      setIsRetroSingleModalOpen(true);
                                    }}
                                    className="text-xs font-semibold py-2 cursor-pointer gap-2"
                                  >
                                    <History className="h-3.5 w-3.5 text-indigo-600" />
                                    <span>과거 수령 이력 소급 등록</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 바 */}
          {totalPages > 1 && (
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between sm:justify-center gap-1 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                className="h-8 px-2.5 text-xs font-bold"
              >
                이전
              </Button>
              <div className="flex items-center gap-1 mx-1 sm:mx-3">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <Button 
                      key={pageNum} 
                      variant={currentPage === pageNum ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setCurrentPage(pageNum)} 
                      className={cn(
                        "h-8 w-8 p-0 font-bold text-xs", 
                        currentPage === pageNum ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                className="h-8 px-2.5 text-xs font-bold"
              >
                다음
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* 공식 평가표 조회 모달 */}
      <EvaluationSheetModal
        evaluation={sheetModalEval}
        open={!!sheetModalEval}
        onOpenChange={(open) => !open && setSheetModalEval(null)}
        canEdit={sheetModalEval ? canEditStudent(sheetModalEval) : false}
        currentUserProfile={userProfile}
        isAdmin={isAdmin}
        onDataMutated={async () => {
          const data = await getCachedCertificationSummaryList(activeGrade);
          setGradeDataMap(prev => ({ ...prev, [activeGrade]: data }));
          if (sheetModalEval) {
            const updated = data.find(d => d.studentId === sheetModalEval.studentId);
            if (updated) setSheetModalEval(updated);
            else setSheetModalEval(null);
          }
          router.refresh();
        }}
        onEditClick={() => {
          if (sheetModalEval) {
            setEditModalEval(sheetModalEval);
            setSheetModalEval(null);
          }
        }}
      />

      {/* 수동 보정/수정 폼 모달 */}
      <EvaluationEditModal
        evaluation={editModalEval}
        baseYear={baseYear}
        open={!!editModalEval}
        onOpenChange={(open) => !open && setEditModalEval(null)}
        masterCertificates={masterCertificates}
        onSaveSuccess={async () => {
          const data = await getCachedCertificationSummaryList(activeGrade);
          setGradeDataMap(prev => ({ ...prev, [activeGrade]: data }));
          router.refresh();
        }}
      />

      {/* 단일 학생 포상/인증상 확정 모달 */}
      <Dialog open={!!awardModalTarget} onOpenChange={(open) => !open && setAwardModalTarget(null)}>
        <DialogContent className="max-w-md w-[92vw] rounded-2xl p-5 bg-white">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              {awardModalTarget?.rewardType === 'prize' ? (
                <>
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Gift className="h-4 w-4" />
                  </div>
                  <span>등급별 상품 수령 확정</span>
                </>
              ) : (
                <>
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <span>옥저인재인증상 수여 확정</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              확정 즉시 학생의 당시 평가 점수와 영역별 실적이 영구 스냅샷으로 락(Lock)됩니다.
            </DialogDescription>
          </DialogHeader>

          {awardModalTarget && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">대상 학생:</span>
                  <span className="font-bold text-slate-900">
                    {awardModalTarget.student.studentName} ({awardModalTarget.student.major} {awardModalTarget.student.classInfo} {awardModalTarget.student.studentNumber}번)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">학년도:</span>
                  <span className="font-semibold text-slate-800">{baseYear}학년도</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">현재 성적:</span>
                  <span className="font-extrabold text-indigo-700">
                    {awardModalTarget.student.rank}랭크 ({awardModalTarget.student.totalScore}점)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-item-name" className="text-xs font-bold text-slate-700">
                  지급 품목명 / 상장 명칭
                </Label>
                <Input
                  id="custom-item-name"
                  value={awardModalTarget.customItemName}
                  onChange={(e) => setAwardModalTarget({ ...awardModalTarget, customItemName: e.target.value })}
                  placeholder="예: 텀블러, 문화상품권 1만원, 옥저인재인증상..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reward-remarks" className="text-xs font-bold text-slate-700">
                  비고 (선택 사항)
                </Label>
                <Input
                  id="reward-remarks"
                  value={awardModalTarget.remarks}
                  onChange={(e) => setAwardModalTarget({ ...awardModalTarget, remarks: e.target.value })}
                  placeholder="예: 1학기말 정기지급, A등급 승급 수령 등"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                ℹ️ <strong>행정 불변성 안내</strong>: 확정 시점의 총점({awardModalTarget.student.totalScore}점) 및 4대 영역 점수가 불변 스냅샷으로 저장되어 행정 감사 및 대장 출력 시 원본으로 보장됩니다.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAwarding}
              onClick={() => setAwardModalTarget(null)}
              className="text-xs font-semibold rounded-xl"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isAwarding}
              onClick={handleConfirmSingleAward}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
            >
              {isAwarding ? '확정 처리 중...' : '확정 및 스냅샷 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스냅샷 상세 조회 및 취소/롤백 모달 */}
      <Dialog open={!!snapshotModalReward} onOpenChange={(open) => !open && setSnapshotModalReward(null)}>
        <DialogContent className="max-w-lg w-[92vw] rounded-2xl p-5 bg-white">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>수령 확정 영구 스냅샷 상세</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              지급 확정 시점에 캡처된 공식 행정 원본 데이터입니다.
            </DialogDescription>
          </DialogHeader>

          {snapshotModalReward && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">구분 / 품목명</span>
                  <Badge className="font-extrabold text-xs bg-indigo-600 text-white">
                    {snapshotModalReward.rewardType === 'prize' ? '등급별 상품' : '옥저인재인증상'}: {snapshotModalReward.itemName}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">지급 시점:</span>
                  <span className="font-bold text-slate-800">
                    {snapshotModalReward.academicYear}학년도 {snapshotModalReward.semester ? `${snapshotModalReward.semester}학기 ` : ''}{(snapshotModalReward as any).gradeNum ? `(${(snapshotModalReward as any).gradeNum}학년)` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">확정 일시:</span>
                  <span className="font-medium text-slate-700">
                    {snapshotModalReward.awardedDate || (snapshotModalReward.createdAt ? new Date(snapshotModalReward.createdAt).toLocaleString('ko-KR') : '-')}
                  </span>
                </div>
                {snapshotModalReward.awardedBy && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">처리 담당자:</span>
                    <span className="font-medium text-slate-700">{snapshotModalReward.awardedBy}</span>
                  </div>
                )}
                {snapshotModalReward.remarks && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">비고:</span>
                    <span className="font-medium text-slate-700">{snapshotModalReward.remarks}</span>
                  </div>
                )}
              </div>

              {/* 당시 스냅샷 점수 내역 */}
              {snapshotModalReward.snapshotData && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 block">📸 확정 당시 불변 성적 스냅샷</span>
                    {(snapshotModalReward.snapshotData as any).isRetroactive && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        과거 오프라인 소급 등록 건
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-600 font-medium">당시 종합 점수 / 등급</span>
                      <span className="text-sm font-black text-indigo-700">
                        {snapshotModalReward.snapshotData.rank}랭크
                        {(snapshotModalReward.snapshotData as any).isRetroactive && snapshotModalReward.snapshotData.totalScore === 0 ? (
                          <span className="text-xs font-normal text-slate-500 ml-1.5">(점수 미기록)</span>
                        ) : (
                          ` (${snapshotModalReward.snapshotData.totalScore}점)`
                        )}
                      </span>
                    </div>

                    {(snapshotModalReward.snapshotData as any).isRetroactive && snapshotModalReward.snapshotData.totalScore === 0 ? (
                      <div className="text-[11px] text-slate-500 py-1 border-t border-slate-200 leading-relaxed">
                        ※ 과거 오프라인 대장 수령 내역을 소급 등록한 데이터로, 당시 4대 영역별 세부 점수는 전산에 보존되지 않았습니다. (수령 등급 및 품목 보존)
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1 text-center pt-1 border-t border-slate-200">
                        <div className="bg-white p-1.5 rounded border text-[10px]">
                          <span className="text-slate-400 block text-[9px]">직업공통</span>
                          <span className="font-bold text-slate-800">{snapshotModalReward.snapshotData.vocationalCommonScore ?? (snapshotModalReward.snapshotData as any).domainScores?.vocationalCommon ?? 0}점</span>
                        </div>
                        <div className="bg-white p-1.5 rounded border text-[10px]">
                          <span className="text-slate-400 block text-[9px]">전공능력</span>
                          <span className="font-bold text-slate-800">{snapshotModalReward.snapshotData.majorScore ?? (snapshotModalReward.snapshotData as any).domainScores?.major ?? 0}점</span>
                        </div>
                        <div className="bg-white p-1.5 rounded border text-[10px]">
                          <span className="text-slate-400 block text-[9px]">취업역량</span>
                          <span className="font-bold text-slate-800">{snapshotModalReward.snapshotData.employmentScore ?? (snapshotModalReward.snapshotData as any).domainScores?.employment ?? 0}점</span>
                        </div>
                        <div className="bg-white p-1.5 rounded border text-[10px]">
                          <span className="text-slate-400 block text-[9px]">인성능력</span>
                          <span className="font-bold text-slate-800">{snapshotModalReward.snapshotData.characterScore ?? (snapshotModalReward.snapshotData as any).domainScores?.character ?? 0}점</span>
                        </div>
                      </div>
                    )}

                    {(snapshotModalReward.snapshotData as any).certificates && (snapshotModalReward.snapshotData as any).certificates.length > 0 && (
                      <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">당시 취득 자격증: </span>
                        {(snapshotModalReward.snapshotData as any).certificates.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between w-full">
            {isAdmin && snapshotModalReward && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleCancelReward(snapshotModalReward.id)}
                className="text-xs font-bold rounded-xl gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>수령 취소 (롤백)</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSnapshotModalReward(null)}
              className="text-xs font-semibold rounded-xl ml-auto"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 하단 선택 일괄 확정 플로팅 액션 바 */}
      {selectedStudentIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
              {selectedStudentIds.size}명 선택됨
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              ({baseYear}학년도 사정)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button
              type="button"
              size="sm"
              disabled={isBulkAwarding}
              onClick={() => handleBulkAward('prize')}
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl gap-1.5 shadow-sm"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>{isBulkAwarding ? '처리 중...' : '선택 대상 상품 일괄 확정'}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isBulkAwarding}
              onClick={() => handleBulkAward('certificate_award')}
              className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl gap-1.5 shadow-sm"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>{isBulkAwarding ? '처리 중...' : '선택 대상 인증상 일괄 수여'}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedStudentIds(new Set())}
              className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}

      {/* 학년 전체 대상자 원클릭 일괄 확정 모달 */}
      <GradeBulkAwardModal
        open={isGradeBulkModalOpen}
        onOpenChange={setIsGradeBulkModalOpen}
        grade={activeGrade}
        academicYear={baseYear}
        evaluations={currentEvaluations}
        prizeConfig={prizeConfig}
        onSuccess={refreshCurrentGradeData}
      />

      {/* 과거 수령 내역 개별 소급 등록 모달 */}
      <RetroactiveAwardModal
        open={isRetroSingleModalOpen}
        onOpenChange={setIsRetroSingleModalOpen}
        targetStudent={retroSingleStudent}
        evaluations={currentEvaluations}
        academicYear={baseYear}
        grade={activeGrade}
        onSuccess={refreshCurrentGradeData}
      />

      {/* 과거 수령 내역 엑셀 대량 일괄 소급 등록 모달 */}
      <RetroactiveExcelModal
        open={isRetroExcelModalOpen}
        onOpenChange={setIsRetroExcelModalOpen}
        evaluations={currentEvaluations}
        academicYear={baseYear}
        grade={activeGrade}
        onSuccess={refreshCurrentGradeData}
      />

      {/* 등급별 상품 및 포상 명칭 설정 모달 (관리자 전용) */}
      <PrizeSettingsModal
        open={isPrizeConfigModalOpen}
        onOpenChange={setIsPrizeConfigModalOpen}
        initialConfig={prizeConfig}
        onSuccess={async (newConfig) => {
          setPrizeConfig(newConfig);
          await refreshCurrentGradeData();
        }}
      />
    </div>
  );
}

