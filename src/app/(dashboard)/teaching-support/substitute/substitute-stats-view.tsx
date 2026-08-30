'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/substitute/substitute-stats-view.tsx
// [수업계 전용] 결보강 승인, NEIS 연계, 보강수당 지급 관리, 대장 및 시수 통계
// ==============================================================================

import * as React from 'react';
import { SubstituteApplication, ApplicationStatus } from '@/lib/substitute/types';
import { ParsedTimetableResult } from '@/lib/timetable/parser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  Printer, 
  Search, 
  Calendar, 
  Scale, 
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Lock,
  Unlock,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  UserCheck,
  HelpCircle,
  KeyRound,
  Coins,
  DollarSign,
  CheckSquare,
  Square,
  Filter,
  X
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { AcademicCalendarConfig, DEFAULT_ACADEMIC_CALENDAR_2026_2 } from '@/lib/substitute/event-types';
import { getEventsForSlot } from '@/lib/substitute/event-helper';
import { AcademicScheduleModal } from './academic-schedule-modal';
import { 
  verifySubstituteAdminPin, 
  changeSubstituteAdminPin,
  getSubstituteAllowanceConfig,
  saveSubstituteAllowanceConfig
} from './actions';
import { cn } from '@/lib/utils';

interface SubstituteStatsViewProps {
  applications: SubstituteApplication[];
  timetableData: ParsedTimetableResult;
  calendarConfig?: AcademicCalendarConfig;
  onSaveCalendarConfig?: (config: AcademicCalendarConfig) => Promise<void>;
  onUpdateStatus?: (id: string, status: ApplicationStatus) => Promise<void>;
  onViewOfficialForm?: (apps: SubstituteApplication | SubstituteApplication[]) => void;
  currentUserFullName?: string;
  selectedTeacherName?: string;
}

// 학반 포맷 헬퍼 (예: '전32' -> '3-2', '기11' -> '1-1')
const formatClassGradeAndRoom = (rawClassCode?: string) => {
  if (!rawClassCode) return '';
  const trimmed = rawClassCode.trim();
  if (!trimmed) return '';
  if (/^\d+-\d+$/.test(trimmed)) return trimmed;
  const matchWithDept = trimmed.match(/[가-힣]*(\d)[-\s_]?(\d+)/);
  if (matchWithDept) return `${matchWithDept[1]}-${matchWithDept[2]}`;
  const matchKorean = trimmed.match(/(\d+)\s*학년\s*(\d+)\s*반/);
  if (matchKorean) return `${matchKorean[1]}-${matchKorean[2]}`;
  if (/^\d{2}$/.test(trimmed)) return `${trimmed[0]}-${trimmed[1]}`;
  return trimmed;
};

export function SubstituteStatsView({
  applications,
  timetableData,
  calendarConfig = DEFAULT_ACADEMIC_CALENDAR_2026_2,
  onSaveCalendarConfig,
  onUpdateStatus,
  onViewOfficialForm,
  currentUserFullName = '수업계',
  selectedTeacherName,
}: SubstituteStatsViewProps) {
  // 수업계 잠금 인증 상태 (기본 1234 또는 세션 저장)
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('substitute_admin_auth') === 'true';
    }
    return false;
  });
  const [pinInput, setPinInput] = React.useState<string>('');
  const [pinError, setPinError] = React.useState<string>('');

  // 탭 상태: 'pending' = NEIS 등록 및 접수 승인, 'allowance' = 보강수당 지급 관리, 'ledger' = 결보강 대장, 'teacherStats' = 교사별 시수 통계
  const [activeSubTab, setActiveSubTab] = React.useState<'pending' | 'allowance' | 'ledger' | 'teacherStats'>('pending');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = React.useState<'all' | 'approved' | 'submitted' | 'rejected'>('all');
  const [isCalendarModalOpen, setIsCalendarModalOpen] = React.useState<boolean>(false);

  // 다중 승인 선택 ID 목록
  const [selectedPendingIds, setSelectedPendingIds] = React.useState<string[]>([]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // 비밀번호 변경 모달 상태
  const [isPinModalOpen, setIsPinModalOpen] = React.useState<boolean>(false);
  const [currPin, setCurrPin] = React.useState<string>('');
  const [newPin, setNewPin] = React.useState<string>('');
  const [confirmPin, setConfirmPin] = React.useState<string>('');
  const [pinModalError, setPinModalError] = React.useState<string>('');
  const [pinModalSuccess, setPinModalSuccess] = React.useState<string>('');
  const [isVerifying, setIsVerifying] = React.useState<boolean>(false);
  const [isChangingPin, setIsChangingPin] = React.useState<boolean>(false);

  // 보강수당 관리 상태
  const [hourlyRate, setHourlyRate] = React.useState<number>(15000);
  const [excludedAllowanceIds, setExcludedAllowanceIds] = React.useState<Set<string>>(new Set());
  const [allowanceSearchTerm, setAllowanceSearchTerm] = React.useState<string>('');
  const [allowanceFilter, setAllowanceFilter] = React.useState<'all' | 'payable' | 'excluded'>('all');
  const [isEditingRate, setIsEditingRate] = React.useState<boolean>(false);
  const [tempRateInput, setTempRateInput] = React.useState<string>('15000');

  // 보강수당 설정 로드
  React.useEffect(() => {
    async function loadAllowance() {
      try {
        const res = await getSubstituteAllowanceConfig();
        if (res.success && res.data) {
          if (res.data.hourlyRate) {
            setHourlyRate(res.data.hourlyRate);
            setTempRateInput(String(res.data.hourlyRate));
          }
          if (Array.isArray(res.data.excludedItemIds)) {
            setExcludedAllowanceIds(new Set(res.data.excludedItemIds));
          }
        }
      } catch (err) {
        console.error('Failed to load allowance config:', err);
      }
    }
    loadAllowance();
  }, []);

  // 접수 대기 중인 신청서 (submitted)
  const pendingApplications = React.useMemo(() => {
    return applications.filter(a => a.status === 'submitted');
  }, [applications]);

  // 비밀번호 인증 핸들러 (서버 액션 연동)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('수업계 비밀번호를 입력해 주세요.');
      return;
    }
    setIsVerifying(true);
    setPinError('');
    try {
      const res = await verifySubstituteAdminPin(pinInput);
      if (res.isValid) {
        setIsAuthenticated(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('substitute_admin_auth', 'true');
        }
        setPinError('');
      } else {
        setPinError('수업계 인증 비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      setPinError('인증 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  // 비밀번호 변경 핸들러
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinModalError('');
    setPinModalSuccess('');

    if (!currPin.trim()) {
      setPinModalError('현재 비밀번호를 입력해 주세요.');
      return;
    }
    if (!newPin.trim() || newPin.trim().length < 4) {
      setPinModalError('새 비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinModalError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsChangingPin(true);
    try {
      const res = await changeSubstituteAdminPin(currPin, newPin);
      if (!res.success) {
        setPinModalError(res.error || '비밀번호 변경에 실패했습니다.');
      } else {
        setPinModalSuccess('수업계 비밀번호가 성공적으로 변경되었습니다!');
        setTimeout(() => {
          setIsPinModalOpen(false);
          setCurrPin('');
          setNewPin('');
          setConfirmPin('');
          setPinModalSuccess('');
          setPinModalError('');
        }, 1200);
      }
    } catch (err: any) {
      setPinModalError(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('substitute_admin_auth');
    }
    setPinInput('');
  };

  // 단일 승인 처리
  const handleApprove = async (appId: string) => {
    if (!onUpdateStatus) return;
    if (confirm('나이스(NEIS)에 결보강 등록을 완료하셨습니까?\n승인 완료로 상태를 변경합니다.')) {
      await onUpdateStatus(appId, 'approved');
      setSelectedPendingIds(prev => prev.filter(id => id !== appId));
    }
  };

  // 선택된 다건 일괄 승인 처리
  const handleApproveSelected = async () => {
    if (!onUpdateStatus || selectedPendingIds.length === 0) return;
    if (confirm(`선택한 ${selectedPendingIds.length}건을 나이스(NEIS) 등록 완료 및 일괄 승인 처리하시겠습니까?`)) {
      for (const id of selectedPendingIds) {
        await onUpdateStatus(id, 'approved');
      }
      setSelectedPendingIds([]);
    }
  };

  // 반려 처리
  const handleReject = async (appId: string) => {
    if (!onUpdateStatus) return;
    const reason = prompt('반려 사유를 입력해 주세요 (교사에게 안내됩니다):');
    if (reason === null) return;
    await onUpdateStatus(appId, 'rejected');
    setSelectedPendingIds(prev => prev.filter(id => id !== appId));
  };

  // 승인 취소 (다시 접수 대기로 전환)
  const handleRevertToSubmitted = async (appId: string) => {
    if (!onUpdateStatus) return;
    if (confirm('승인을 취소하고 다시 [접수 대기] 상태로 되돌리시겠습니까?')) {
      await onUpdateStatus(appId, 'submitted');
    }
  };

  // 나이스 입력 텍스트 클립보드 복사
  const handleCopyNeisFormat = (app: SubstituteApplication) => {
    const lines = app.items.map(it => {
      const classRoom = formatClassGradeAndRoom(it.classCode);
      const isSub = it.type === 'substitute';
      return `${it.sourceDate}(${it.sourceDay}) ${it.sourcePeriod}교시 | ${it.deptName} ${classRoom} | ${it.subjectName} | 결강:${app.applicantTeacher} ➔ ${isSub ? `보강:${it.substituteTeacher}` : `교체:${it.targetTeacher}(${it.targetDate} ${it.targetPeriod}교시)`} [사유:${app.reason}]`;
    });
    const text = `[나이스 결보강 등록용 - ${app.applicationNumber}]\n신청자: ${app.applicantTeacher}\n사유: ${app.reason}\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(app.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. 대장용 플랫 아이템 리스트
  const allItems = React.useMemo(() => {
    const list: {
      appId: string;
      appNumber: string;
      applicantTeacher: string;
      reason: string;
      sourceDate: string;
      sourceDay: string;
      sourcePeriod: number;
      classCode: string;
      subjectName: string;
      type: string;
      targetInfo: string;
      status: string;
      rawStatus: string;
      approvedAt?: string;
      approvedBy?: string;
    }[] = [];

    applications.forEach(app => {
      app.items.forEach(it => {
        const isSub = it.type === 'substitute';
        const targetInfo = isSub
          ? `보강: ${it.substituteTeacher || '미지정'}`
          : `교체: ${it.targetTeacher || '미지정'} (${it.targetDate || ''} ${it.targetPeriod ? `${it.targetPeriod}교시` : ''})`;

        list.push({
          appId: app.id,
          appNumber: app.applicationNumber,
          applicantTeacher: it.originalTeacher || app.applicantTeacher,
          reason: app.reason,
          sourceDate: it.sourceDate,
          sourceDay: it.sourceDay,
          sourcePeriod: it.sourcePeriod,
          classCode: it.classCode,
          subjectName: it.subjectName,
          type: isSub ? '수업보강' : '수업교체',
          targetInfo,
          status: app.status === 'approved' ? '승인완료' : app.status === 'submitted' ? '접수대기' : '반려됨',
          rawStatus: app.status,
          approvedAt: app.approvedAt,
          approvedBy: app.approvedBy,
        });
      });
    });

    return list.sort((a, b) => {
      const dateDiff = b.sourceDate.localeCompare(a.sourceDate);
      if (dateDiff !== 0) return dateDiff;
      return a.sourcePeriod - b.sourcePeriod;
    });
  }, [applications]);

  // 대장 필터링
  const filteredItems = React.useMemo(() => {
    return allItems.filter(item => {
      if (ledgerStatusFilter !== 'all' && item.rawStatus !== ledgerStatusFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.applicantTeacher.toLowerCase().includes(term) ||
        item.targetInfo.toLowerCase().includes(term) ||
        item.subjectName.toLowerCase().includes(term) ||
        item.classCode.toLowerCase().includes(term) ||
        item.sourceDate.includes(term) ||
        item.reason.toLowerCase().includes(term)
      );
    });
  }, [allItems, ledgerStatusFilter, searchTerm]);

  // 2. 보강수당 지급 관리용 아이템 리스트 (승인 완료된 보강 수업)
  const substituteAllowanceList = React.useMemo(() => {
    const list: {
      uniqueKey: string;
      appId: string;
      appNumber: string;
      sourceDate: string;
      sourceDay: string;
      sourcePeriod: number;
      deptName: string;
      classCode: string;
      subjectName: string;
      applicantTeacher: string;
      reason: string;
      substituteTeacher: string;
      isPayable: boolean;
      payableHours: number;
      amount: number;
      approvedAt?: string;
      approvedBy?: string;
    }[] = [];

    applications.filter(a => a.status === 'approved').forEach(app => {
      app.items.forEach((it, itIdx) => {
        if (it.type === 'substitute' && it.substituteTeacher) {
          const uniqueKey = it.id || `${app.id}_sub_${itIdx}_${it.sourceDate}_${it.sourcePeriod}`;
          // 기본값: 체크됨 (true). excludedAllowanceIds에 있으면 체크 해제(false).
          const isPayable = !excludedAllowanceIds.has(uniqueKey);
          list.push({
            uniqueKey,
            appId: app.id,
            appNumber: app.applicationNumber,
            sourceDate: it.sourceDate,
            sourceDay: it.sourceDay,
            sourcePeriod: it.sourcePeriod,
            deptName: it.deptName,
            classCode: it.classCode,
            subjectName: it.subjectName,
            applicantTeacher: it.originalTeacher || app.applicantTeacher,
            reason: app.reason,
            substituteTeacher: it.substituteTeacher,
            isPayable,
            payableHours: isPayable ? 1 : 0,
            amount: isPayable ? hourlyRate : 0,
            approvedAt: app.approvedAt,
            approvedBy: app.approvedBy,
          });
        }
      });
    });

    return list.sort((a, b) => {
      const dateDiff = b.sourceDate.localeCompare(a.sourceDate);
      if (dateDiff !== 0) return dateDiff;
      return a.sourcePeriod - b.sourcePeriod;
    });
  }, [applications, excludedAllowanceIds, hourlyRate]);

  // 보강수당 필터링
  const filteredAllowanceList = React.useMemo(() => {
    return substituteAllowanceList.filter(item => {
      if (allowanceFilter === 'payable' && !item.isPayable) return false;
      if (allowanceFilter === 'excluded' && item.isPayable) return false;

      if (!allowanceSearchTerm.trim()) return true;
      const term = allowanceSearchTerm.toLowerCase();
      return (
        item.substituteTeacher.toLowerCase().includes(term) ||
        item.applicantTeacher.toLowerCase().includes(term) ||
        item.subjectName.toLowerCase().includes(term) ||
        item.deptName.toLowerCase().includes(term) ||
        item.classCode.toLowerCase().includes(term) ||
        item.sourceDate.includes(term) ||
        item.reason.toLowerCase().includes(term)
      );
    });
  }, [substituteAllowanceList, allowanceFilter, allowanceSearchTerm]);

  // 보강수당 요약 집계
  const allowanceSummary = React.useMemo(() => {
    const totalCount = substituteAllowanceList.length;
    const payableCount = substituteAllowanceList.filter(it => it.isPayable).length;
    const excludedCount = totalCount - payableCount;
    const totalAmount = payableCount * hourlyRate;
    return { totalCount, payableCount, excludedCount, totalAmount };
  }, [substituteAllowanceList, hourlyRate]);

  // 교사별 보강수당 집계표
  const teacherAllowanceBreakdown = React.useMemo(() => {
    const map = new Map<string, {
      teacherName: string;
      totalCount: number;
      payableCount: number;
      excludedCount: number;
      totalAmount: number;
    }>();

    substituteAllowanceList.forEach(it => {
      const existing = map.get(it.substituteTeacher) || {
        teacherName: it.substituteTeacher,
        totalCount: 0,
        payableCount: 0,
        excludedCount: 0,
        totalAmount: 0,
      };
      existing.totalCount += 1;
      if (it.isPayable) {
        existing.payableCount += 1;
        existing.totalAmount += hourlyRate;
      } else {
        existing.excludedCount += 1;
      }
      map.set(it.substituteTeacher, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.payableCount - a.payableCount || a.teacherName.localeCompare(b.teacherName));
  }, [substituteAllowanceList, hourlyRate]);

  // 보강수당 체크박스 토글 핸들러 (영구 저장)
  const handleToggleAllowanceItem = (uniqueKey: string) => {
    setExcludedAllowanceIds(prev => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) {
        next.delete(uniqueKey); // 체크 ➔ 수당 지급 인정
      } else {
        next.add(uniqueKey); // 체크 해제 ➔ 수당 계산 제외
      }

      saveSubstituteAllowanceConfig({
        hourlyRate,
        excludedItemIds: Array.from(next),
      }).catch(console.error);

      return next;
    });
  };

  // 보강수당 전체 선택 (전체 지급)
  const handleSelectAllAllowance = async () => {
    setExcludedAllowanceIds(new Set());
    await saveSubstituteAllowanceConfig({
      hourlyRate,
      excludedItemIds: [],
    });
  };

  // 보강수당 전체 해제 (전체 제외)
  const handleDeselectAllAllowance = async () => {
    const allKeys = substituteAllowanceList.map(it => it.uniqueKey);
    const nextSet = new Set(allKeys);
    setExcludedAllowanceIds(nextSet);
    await saveSubstituteAllowanceConfig({
      hourlyRate,
      excludedItemIds: allKeys,
    });
  };

  // 보강수당 단가 변경 저장
  const handleSaveHourlyRate = async () => {
    const parsed = parseInt(tempRateInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(parsed) || parsed <= 0) {
      alert('올바른 금액을 입력해 주세요.');
      return;
    }
    setHourlyRate(parsed);
    setIsEditingRate(false);
    await saveSubstituteAllowanceConfig({
      hourlyRate: parsed,
      excludedItemIds: Array.from(excludedAllowanceIds),
    });
  };

  // 3. 교사별 누적 시수 통계
  const teacherStats = React.useMemo(() => {
    const map = new Map<string, {
      teacherName: string;
      homeroomClass?: string;
      absenceHours: number;
      substituteHours: number;
      payableSubstituteHours: number;
      exchangeCount: number;
    }>();

    timetableData.teachers.forEach(t => {
      map.set(t.teacherName, {
        teacherName: t.teacherName,
        homeroomClass: t.homeroomClass,
        absenceHours: 0,
        substituteHours: 0,
        payableSubstituteHours: 0,
        exchangeCount: 0,
      });
    });

    applications.filter(a => a.status === 'approved').forEach(app => {
      app.items.forEach((it, itIdx) => {
        const applicantName = it.originalTeacher || app.applicantTeacher;
        if (applicantName) {
          const t = map.get(applicantName) || {
            teacherName: applicantName,
            absenceHours: 0,
            substituteHours: 0,
            payableSubstituteHours: 0,
            exchangeCount: 0,
          };
          t.absenceHours += 1;
          map.set(applicantName, t);
        }

        if (it.type === 'substitute' && it.substituteTeacher) {
          const t = map.get(it.substituteTeacher) || {
            teacherName: it.substituteTeacher,
            absenceHours: 0,
            substituteHours: 0,
            payableSubstituteHours: 0,
            exchangeCount: 0,
          };
          t.substituteHours += 1;
          const uniqueKey = it.id || `${app.id}_sub_${itIdx}_${it.sourceDate}_${it.sourcePeriod}`;
          if (!excludedAllowanceIds.has(uniqueKey)) {
            t.payableSubstituteHours += 1;
          }
          map.set(it.substituteTeacher, t);
        }

        if (it.type === 'exchange') {
          if (applicantName) {
            const t = map.get(applicantName);
            if (t) t.exchangeCount += 1;
          }
          if (it.targetTeacher) {
            const t = map.get(it.targetTeacher);
            if (t) t.exchangeCount += 1;
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.substituteHours - a.substituteHours || b.absenceHours - a.absenceHours);
  }, [applications, timetableData.teachers, excludedAllowanceIds]);

  // 대장 엑셀 다운로드
  const handleExportLedger = () => {
    const data = filteredItems.map((item, idx) => ({
      '순번': idx + 1,
      '신청번호': item.appNumber,
      '결강일자': item.sourceDate,
      '요일': item.sourceDay,
      '교시': item.sourcePeriod,
      '학반': item.classCode,
      '교과목': item.subjectName,
      '결강교사': item.applicantTeacher,
      '결강사유': item.reason,
      '구분': item.type,
      '처리내용': item.targetInfo,
      '상태': item.status,
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '결보강관리대장');
    xlsx.writeFile(wb, `결보강관리대장_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 통계 엑셀 다운로드
  const handleExportStats = () => {
    const data = teacherStats.map((t, idx) => ({
      '순번': idx + 1,
      '교사명': t.teacherName,
      '담임학반': t.homeroomClass || '',
      '결강시수(시간)': t.absenceHours,
      '보강진행시수(시간)': t.substituteHours,
      '수당지급인정시수(시간)': t.payableSubstituteHours,
      '수업교체횟수(회)': t.exchangeCount,
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '교사별시수통계');
    xlsx.writeFile(wb, `교사별_보강시수통계_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 보강수당 지급 명세서 엑셀 다운로드
  const handleExportAllowanceExcel = () => {
    const detailData = substituteAllowanceList.map((item, idx) => ({
      '순번': idx + 1,
      '수당지급여부': item.isPayable ? '지급 대상' : '지급 제외(미지급)',
      '신청번호': item.appNumber,
      '수업일자': item.sourceDate,
      '요일': item.sourceDay,
      '교시': `${item.sourcePeriod}교시`,
      '학과': item.deptName,
      '학반': formatClassGradeAndRoom(item.classCode),
      '교과목': item.subjectName,
      '결강교사': item.applicantTeacher,
      '결강사유': item.reason,
      '보강교사(수령자)': item.substituteTeacher,
      '인정시수': item.isPayable ? 1 : 0,
      '시간당단가': hourlyRate,
      '지급금액(원)': item.amount,
    }));

    const summaryData = teacherAllowanceBreakdown.map((t, idx) => ({
      '순번': idx + 1,
      '보강교사명': t.teacherName,
      '총보강시수': t.totalCount,
      '수당지급인정시수': t.payableCount,
      '수당제외시수': t.excludedCount,
      '시간당단가': hourlyRate,
      '총지급예정액(원)': t.totalAmount,
      '확인서명': '',
    }));

    const wb = xlsx.utils.book_new();
    const wsDetail = xlsx.utils.json_to_sheet(detailData);
    const wsSummary = xlsx.utils.json_to_sheet(summaryData);

    xlsx.utils.book_append_sheet(wb, wsDetail, '보강수당_상세내역');
    xlsx.utils.book_append_sheet(wb, wsSummary, '교사별_수당집계표');

    const todayStr = new Date().toISOString().slice(0, 10);
    xlsx.writeFile(wb, `보강수당_지급명세서_${todayStr}.xlsx`);
  };

  // 1. 미인증 시 잠금 화면
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-2xs text-center space-y-4">
        <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto text-blue-600 shadow-2xs">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">수업계 결보강 승인/관리 인증</h2>
          <p className="text-xs text-slate-500 mt-1">
            수업계 담당 교사 전용 화면입니다. 인증 비밀번호를 입력해 주세요.
          </p>
        </div>
        <form onSubmit={handleAuthSubmit} className="space-y-3 pt-2">
          <div>
            <Input
              type="password"
              placeholder="수업계 비밀번호 입력 (기본: 1234)"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              className="h-10 text-center font-mono tracking-widest text-sm bg-slate-50 border-slate-200 rounded-xl"
              autoFocus
            />
            {pinError && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center justify-center gap-1 mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {pinError}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isVerifying}
            className="w-full h-10 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-2xs cursor-pointer"
          >
            {isVerifying ? '인증 확인 중...' : '결보강 승인/관리 콘솔 접속'}
          </Button>
        </form>
      </div>
    );
  }

  // 2. 인증 완료 시 수업계 메인 콘솔
  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full pt-1">
      {/* 1. 상단 타이틀 헤더 (class-management 스타일) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
              결보강 승인 & 관리 센터
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hidden sm:inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              수업계 접속 중
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            교사 제출 결보강 서류를 검토하고 나이스(NEIS) 등록 후 승인, 보강수당 집계 및 대장을 총괄 관리합니다.
          </p>
        </div>

        {/* 상단 우측 액션 버튼 그룹 */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {onSaveCalendarConfig && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCalendarModalOpen(true)}
              className="h-9 text-xs font-bold gap-1.5 rounded-xl border-slate-200/80 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200 text-slate-700 shadow-2xs"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              학사일정 & 행사 설정
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsPinModalOpen(true);
              setCurrPin('');
              setNewPin('');
              setConfirmPin('');
              setPinModalError('');
              setPinModalSuccess('');
            }}
            className="h-9 text-xs font-bold gap-1.5 rounded-xl border-slate-200/80 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 text-slate-700 shadow-2xs"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
            비밀번호 변경
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLock}
            className="h-9 text-xs font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 gap-1 rounded-xl"
            title="콘솔 잠금"
          >
            <Lock className="h-3.5 w-3.5" />
            잠금
          </Button>
        </div>
      </div>

      {/* 2. 세그먼트 탭 컨트롤 바 (class-management 스타일) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl flex-1 sm:flex-none overflow-x-auto">
          {/* 1. NEIS 등록 대기 탭 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('pending')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
              activeSubTab === 'pending'
                ? "bg-white text-blue-900 font-black shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span>NEIS 등록 및 승인 대기</span>
            {pendingApplications.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                {pendingApplications.length}
              </span>
            )}
          </button>

          {/* 2. 보강수당 지급 관리 탭 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('allowance')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
              activeSubTab === 'allowance'
                ? "bg-white text-emerald-900 font-black shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Coins className="h-3.5 w-3.5 text-emerald-600" />
            <span>보강수당 지급 관리</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
              {allowanceSummary.payableCount}건
            </span>
          </button>

          {/* 3. 결보강 관리 대장 탭 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('ledger')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
              activeSubTab === 'ledger'
                ? "bg-white text-indigo-900 font-black shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
            <span>결보강 관리 대장</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
              {allItems.length}
            </span>
          </button>

          {/* 4. 교사별 누적 시수 통계 탭 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('teacherStats')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
              activeSubTab === 'teacherStats'
                ? "bg-white text-amber-900 font-black shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Scale className="h-3.5 w-3.5 text-amber-600" />
            <span>교사별 보강 누적 시수</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 pr-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{timetableData.title}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 탭 1: NEIS 등록 및 접수 승인 대기 목록 */}
      {/* ========================================================================= */}
      {activeSubTab === 'pending' && (
        <div className="space-y-3.5">
          {/* 일괄 액션 바 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                현재 나이스(NEIS) 등록 및 승인 대기: <strong className="text-rose-600 font-black">{pendingApplications.length}건</strong>
              </span>
            </div>

            {pendingApplications.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedPendingIds.length === pendingApplications.length) {
                      setSelectedPendingIds([]);
                    } else {
                      setSelectedPendingIds(pendingApplications.map(a => a.id));
                    }
                  }}
                  className="h-9 px-3 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                >
                  {selectedPendingIds.length === pendingApplications.length ? '선택 해제' : '전체 선택'}
                </Button>

                {selectedPendingIds.length > 0 && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApproveSelected}
                      className="h-9 text-xs font-black gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      선택 {selectedPendingIds.length}건 나이스 등록 확인 ➔ 일괄 승인
                    </Button>
                    {onViewOfficialForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const selectedApps = applications.filter(a => selectedPendingIds.includes(a.id));
                          onViewOfficialForm(selectedApps);
                        }}
                        className="h-9 text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        선택 {selectedPendingIds.length}건 A4 일괄 출력
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 대기 목록 카드 */}
          {pendingApplications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-black text-slate-800">대기 중인 결보강 신청서가 없습니다.</p>
              <p className="text-xs text-slate-400">교사들이 제출한 결보강 신청서가 이곳에 실시간으로 표시됩니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {pendingApplications.map(app => (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPendingIds.includes(app.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPendingIds(prev => [...prev, app.id]);
                          } else {
                            setSelectedPendingIds(prev => prev.filter(id => id !== app.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {app.applicationNumber}
                      </span>
                      <strong className="text-sm font-black text-slate-900">
                        {app.applicantTeacher} 선생님
                      </strong>
                      <span className="text-xs text-slate-500">
                        ({app.periodStart} {app.periodStart !== app.periodEnd ? `~ ${app.periodEnd}` : ''})
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        사유: {app.reason}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {onViewOfficialForm && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onViewOfficialForm(app)}
                          className="h-10 px-4 text-sm font-black gap-1.5 border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl cursor-pointer shadow-xs"
                        >
                          <Printer className="h-4 w-4 text-indigo-600" />
                          A4 출력
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApprove(app.id)}
                        className="h-10 px-4 text-sm font-black gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        나이스 등록 완료 ➔ 승인
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(app.id)}
                        className="h-10 px-3 text-sm font-black text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                        반려
                      </Button>
                    </div>
                  </div>

                  {/* 세부 항목 테이블 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-y border-slate-200 font-bold">
                          <th className="py-2 px-2">수업일자</th>
                          <th className="py-2 px-1">교시</th>
                          <th className="py-2 px-2">학과/학반</th>
                          <th className="py-2 px-2">교과목</th>
                          <th className="py-2 px-2">구분</th>
                          <th className="py-2 px-3 text-left">보강/교체 대상 교사 및 세부내용</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {app.items.map((it, idx) => {
                          const isSub = it.type === 'substitute';
                          const classRoom = formatClassGradeAndRoom(it.classCode);
                          return (
                            <tr key={it.id || idx} className="h-9 hover:bg-slate-50/60">
                              <td className="font-bold text-slate-700">
                                {it.sourceDate} ({it.sourceDay})
                              </td>
                              <td className="font-black text-indigo-600">{it.sourcePeriod}교시</td>
                              <td className="font-medium text-slate-800">
                                {it.deptName} {classRoom}
                              </td>
                              <td className="font-bold text-slate-900">{it.subjectName}</td>
                              <td>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[10.5px] font-black",
                                  isSub ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                                )}>
                                  {isSub ? '수업보강' : '수업교체'}
                                </span>
                              </td>
                              <td className="text-left font-bold text-slate-800 px-3">
                                {isSub ? (
                                  <span className="text-amber-900 font-black">
                                    보강 담당: {it.substituteTeacher} 선생님
                                  </span>
                                ) : (
                                  <span className="text-indigo-900">
                                    교체 상대: {it.targetTeacher} 선생님 ({it.targetDate} {it.targetPeriod}교시 {it.targetSubject || it.subjectName})
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 2: 보강수당 지급 관리 (NEW) */}
      {/* ========================================================================= */}
      {activeSubTab === 'allowance' && (
        <div className="space-y-4">
          {/* 상단 4대 핵심 지표 요약 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">총 승인된 보강 수업</span>
                <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {allowanceSummary.totalCount} <span className="text-sm font-bold text-slate-500">건</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">수당 지급 대상 (인정)</span>
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckSquare className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {allowanceSummary.payableCount} <span className="text-sm font-bold text-emerald-600">시간</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">수당 계산 제외 (미지급)</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <Square className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {allowanceSummary.excludedCount} <span className="text-sm font-bold text-slate-400">건</span>
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-200">총 보강수당 지급 예정액</span>
                <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Coins className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-black text-amber-300 mt-1">
                {allowanceSummary.totalAmount.toLocaleString()} <span className="text-sm font-bold text-white">원</span>
              </p>
            </div>
          </div>

          {/* 보강수당 단가 설정 & 일괄 액션 & 검색 바 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* 시간당 단가 설정 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1">
                  <Coins className="h-4 w-4 text-amber-500" />
                  시간당 보강수당 단가:
                </span>
                {isEditingRate ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={tempRateInput}
                      onChange={e => setTempRateInput(e.target.value)}
                      className="w-28 h-8 text-xs font-black text-right"
                      placeholder="금액 입력"
                    />
                    <span className="text-xs font-bold text-slate-600">원</span>
                    <Button
                      size="sm"
                      onClick={handleSaveHourlyRate}
                      className="h-8 px-2.5 text-xs font-bold bg-indigo-600 text-white rounded-lg cursor-pointer"
                    >
                      저장
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingRate(false)}
                      className="h-8 px-2 text-xs text-slate-500 cursor-pointer"
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                      {hourlyRate.toLocaleString()}원 / 시간
                    </strong>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTempRateInput(String(hourlyRate));
                        setIsEditingRate(true);
                      }}
                      className="h-7 px-2 text-[11px] font-bold border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                    >
                      단가 변경
                    </Button>
                  </div>
                )}
              </div>

              {/* 엑셀 다운로드 및 일괄 선택 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleSelectAllAllowance}
                  className="h-10 px-3.5 sm:px-4 text-xs sm:text-[13px] font-bold text-slate-700 border-slate-200/90 hover:bg-slate-50 rounded-xl shadow-2xs cursor-pointer gap-1.5"
                >
                  <CheckSquare className="h-4 w-4 text-emerald-600" />
                  전체 선택 (전체 지급)
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  onClick={handleDeselectAllAllowance}
                  className="h-10 px-3.5 sm:px-4 text-xs sm:text-[13px] font-bold text-slate-700 border-slate-200/90 hover:bg-slate-50 rounded-xl shadow-2xs cursor-pointer gap-1.5"
                >
                  <Square className="h-4 w-4 text-rose-500" />
                  전체 해제 (전체 제외)
                </Button>

                <Button
                  size="default"
                  onClick={handleExportAllowanceExcel}
                  className="h-10 px-4 sm:px-5 text-xs sm:text-[13px] font-black gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl cursor-pointer shadow-xs"
                >
                  <Download className="h-4 w-4 text-white" />
                  보강수당 지급명세서 엑셀 다운로드
                </Button>
              </div>
            </div>

            {/* 필터 및 검색 바 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">지급 필터:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setAllowanceFilter('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      allowanceFilter === 'all' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    전체 ({substituteAllowanceList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowanceFilter('payable')}
                    className={cn(
                      "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      allowanceFilter === 'payable' ? "bg-white text-emerald-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    지급 대상 ({allowanceSummary.payableCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowanceFilter('excluded')}
                    className={cn(
                      "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      allowanceFilter === 'excluded' ? "bg-white text-rose-700 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    수당 제외 ({allowanceSummary.excludedCount})
                  </button>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="보강교사 / 결강교사 / 과목 검색"
                  value={allowanceSearchTerm}
                  onChange={e => setAllowanceSearchTerm(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 보강수당 메인 테이블 */}
            <div className="overflow-x-auto pt-1">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 text-[11px] font-black">
                    <th className="py-2.5 px-2 w-14 border-r border-slate-200">
                      수당지급
                    </th>
                    <th className="py-2.5 px-2 w-12 border-r border-slate-200">순번</th>
                    <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">수업일자</th>
                    <th className="py-2.5 px-1.5 w-12 border-r border-slate-200">교시</th>
                    <th className="py-2.5 px-2.5 w-24 border-r border-slate-200 text-indigo-900 bg-indigo-50/50">
                      보강 교사 (수령자)
                    </th>
                    <th className="py-2.5 px-2 w-16 border-r border-slate-200">학과</th>
                    <th className="py-2.5 px-2 w-14 border-r border-slate-200">학반</th>
                    <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">교과목</th>
                    <th className="py-2.5 px-2 w-20 border-r border-slate-200">결강 교사</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-left">결강 사유</th>
                    <th className="py-2.5 px-2 w-16 border-r border-slate-200 text-emerald-900 bg-emerald-50/50">
                      인정 시수
                    </th>
                    <th className="py-2.5 px-3 w-28 text-emerald-900 bg-emerald-50/50 font-black">
                      보강 수당
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllowanceList.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-slate-400 text-xs font-medium">
                        승인된 보강 수업 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredAllowanceList.map((item, idx) => (
                      <tr
                        key={item.uniqueKey}
                        className={cn(
                          "transition-colors h-10.5",
                          item.isPayable ? "hover:bg-slate-50/80" : "bg-slate-50/60 text-slate-400"
                        )}
                      >
                        {/* 1. 수당 지급 체크박스 */}
                        <td className="border-r border-slate-100">
                          <input
                            type="checkbox"
                            checked={item.isPayable}
                            onChange={() => handleToggleAllowanceItem(item.uniqueKey)}
                            title={item.isPayable ? "체크 해제 시 수당 계산에서 제외됩니다." : "체크 시 수당 지급 대상으로 계산됩니다."}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-slate-100 text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-100 font-bold text-slate-800">
                          {item.sourceDate} <span className="text-slate-400 text-[10px]">({item.sourceDay})</span>
                        </td>
                        <td className="border-r border-slate-100 font-black text-indigo-700">
                          {item.sourcePeriod}교시
                        </td>
                        {/* 보강 교사 (강조) */}
                        <td className="border-r border-slate-100 font-black text-indigo-900 bg-indigo-50/20 text-xs">
                          {item.substituteTeacher} 선생님
                        </td>
                        <td className="border-r border-slate-100 text-slate-700 font-bold">
                          {item.deptName}
                        </td>
                        <td className="border-r border-slate-100 font-bold text-slate-800">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10.5px]">
                            {formatClassGradeAndRoom(item.classCode)}
                          </span>
                        </td>
                        <td className="border-r border-slate-100 font-bold text-slate-900">
                          {item.subjectName}
                        </td>
                        <td className="border-r border-slate-100 text-slate-600 font-medium">
                          {item.applicantTeacher}
                        </td>
                        <td className="border-r border-slate-100 text-left text-slate-600 px-3 truncate max-w-[140px]">
                          {item.reason}
                        </td>
                        {/* 인정 시수 */}
                        <td className="border-r border-slate-100 font-black text-xs">
                          {item.isPayable ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10.5px]">
                              1시간
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-bold text-[10.5px]">
                              0시간 (제외)
                            </span>
                          )}
                        </td>
                        {/* 보강 수당 금액 */}
                        <td className="font-black text-xs">
                          {item.isPayable ? (
                            <span className="text-emerald-700 font-black">
                              {item.amount.toLocaleString()}원
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">
                              0원 (미지급)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 하단: 교사별 보강수당 지급 집계표 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                교사별 보강수당 지급 집계 및 정산표 ({teacherAllowanceBreakdown.length}명)
              </span>
              <span className="text-xs font-bold text-slate-500">
                총 지급액: <strong className="text-emerald-700 font-black">{allowanceSummary.totalAmount.toLocaleString()}원</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 text-[11px] font-black">
                    <th className="py-2 px-2 w-12 border-r border-slate-200">순번</th>
                    <th className="py-2 px-3 w-32 border-r border-slate-200">보강 교사명</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200">총 보강 횟수</th>
                    <th className="py-2 px-3 w-32 border-r border-slate-200 text-emerald-800 bg-emerald-50/50">
                      수당 지급 인정 시수
                    </th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200 text-rose-700 bg-rose-50/50">
                      수당 제외 횟수
                    </th>
                    <th className="py-2 px-3 w-36 text-emerald-900 bg-emerald-50/50 font-black">
                      총 지급 예정액
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teacherAllowanceBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-slate-400 text-xs font-medium">
                        보강 배정된 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    teacherAllowanceBreakdown.map((t, idx) => (
                      <tr key={t.teacherName} className="hover:bg-slate-50/80 transition-colors h-10">
                        <td className="border-r border-slate-100 text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="border-r border-slate-100 font-black text-slate-900 text-xs">
                          {t.teacherName} 선생님
                        </td>
                        <td className="border-r border-slate-100 text-slate-600 font-bold">
                          {t.totalCount}회
                        </td>
                        <td className="border-r border-slate-100 font-black text-emerald-700 bg-emerald-50/20">
                          {t.payableCount}시간 인정
                        </td>
                        <td className="border-r border-slate-100 font-bold text-slate-400 bg-rose-50/10">
                          {t.excludedCount > 0 ? `${t.excludedCount}회 제외` : '-'}
                        </td>
                        <td className="font-black text-emerald-700 bg-emerald-50/30 text-xs">
                          {t.totalAmount > 0 ? (
                            <span>{t.totalAmount.toLocaleString()}원</span>
                          ) : (
                            <span className="text-slate-400 font-normal">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 3: 결보강 관리 대장 */}
      {/* ========================================================================= */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">상태 필터:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                {(['all', 'approved', 'submitted', 'rejected'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLedgerStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      ledgerStatusFilter === st
                        ? "bg-white text-indigo-700 shadow-2xs font-black"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {st === 'all' ? '전체' : st === 'approved' ? '승인완료' : st === 'submitted' ? '접수대기' : '반려됨'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="교사명 / 과목 / 학반 / 사유 검색"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8.5 h-8.5 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLedger}
                className="h-8.5 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs rounded-xl cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                대장 엑셀
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8.5 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs rounded-xl cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                인쇄
              </Button>
            </div>
          </div>

          {/* 대장 표 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 text-[11px] font-black">
                  <th className="py-2.5 px-2 w-12 border-r border-slate-200">순번</th>
                  <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">신청번호</th>
                  <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">결강일자</th>
                  <th className="py-2.5 px-1.5 w-12 border-r border-slate-200">교시</th>
                  <th className="py-2.5 px-2 w-16 border-r border-slate-200">학반</th>
                  <th className="py-2.5 px-2 w-20 border-r border-slate-200">교과목</th>
                  <th className="py-2.5 px-2.5 w-24 border-r border-slate-200">결강교사</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-left">사유</th>
                  <th className="py-2.5 px-2 w-20 border-r border-slate-200">구분</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-left">처리 내용 (보강/교체)</th>
                  <th className="py-2.5 px-2 w-16 border-r border-slate-200">상태</th>
                  <th className="py-2.5 px-2 w-20">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-slate-400 text-xs font-medium">
                      해당하는 결보강 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={`${item.appId}-${idx}`} className="hover:bg-slate-50/80 transition-colors h-10">
                      <td className="border-r border-slate-100 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-100 font-mono text-[11px] text-slate-600">
                        {item.appNumber}
                      </td>
                      <td className="border-r border-slate-100 font-bold text-slate-800">
                        {item.sourceDate} <span className="text-slate-400 text-[10px]">({item.sourceDay})</span>
                      </td>
                      <td className="border-r border-slate-100 font-black text-indigo-700">
                        {item.sourcePeriod}교시
                      </td>
                      <td className="border-r border-slate-100 font-bold text-slate-800">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10.5px]">
                          {item.classCode}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 font-bold text-slate-900">
                        {item.subjectName}
                      </td>
                      <td className="border-r border-slate-100 font-black text-slate-900">
                        {item.applicantTeacher}
                      </td>
                      <td className="border-r border-slate-100 text-left text-slate-600 px-3 truncate max-w-[160px]">
                        {item.reason}
                      </td>
                      <td className="border-r border-slate-100">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black border",
                          item.type === '수업보강' ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {item.type}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 text-left font-bold text-slate-800 px-3">
                        {item.targetInfo}
                      </td>
                      <td className="border-r border-slate-100">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black",
                          item.rawStatus === 'approved' ? "bg-emerald-100 text-emerald-800" :
                          item.rawStatus === 'submitted' ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
                        )}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.rawStatus === 'approved' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevertToSubmitted(item.appId)}
                            className="h-7 text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1.5 cursor-pointer"
                            title="승인 취소 (접수 대기로 되돌리기)"
                          >
                            <RotateCcw className="h-3 w-3 mr-0.5" />
                            승인취소
                          </Button>
                        ) : item.rawStatus === 'submitted' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(item.appId)}
                            className="h-7 text-[10px] text-emerald-700 hover:text-emerald-800 font-bold px-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-0.5" />
                            승인
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400">반려됨</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 4: 교사별 누적 보강 시수 통계 */}
      {/* ========================================================================= */}
      {activeSubTab === 'teacherStats' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800">
              전체 교사 누적 결강/보강 시수 집계 ({teacherStats.length}명)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportStats}
              className="h-9 text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50 text-emerald-700 shadow-2xs rounded-xl cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              통계 엑셀 다운로드
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 border-b-2 border-slate-200 text-[11px] font-black">
                  <th className="py-2.5 px-2 w-12 border-r border-slate-200">순번</th>
                  <th className="py-2.5 px-3 w-28 border-r border-slate-200">교사명</th>
                  <th className="py-2.5 px-2 w-24 border-r border-slate-200">담임학반</th>
                  <th className="py-2.5 px-3 w-32 border-r border-slate-200 text-rose-700 bg-rose-50/50">
                    결강 시수 (출장/연가)
                  </th>
                  <th className="py-2.5 px-3 w-32 border-r border-slate-200 text-indigo-700 bg-indigo-50/50">
                    수업보강 진행 시수
                  </th>
                  <th className="py-2.5 px-3 w-28 border-r border-slate-200">
                    수업 교체 횟수
                  </th>
                  <th className="py-2.5 px-3 w-36 font-black text-emerald-800 bg-emerald-50/50">
                    보강 수당 정산 시수
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherStats.map((t, idx) => (
                  <tr key={t.teacherName} className="hover:bg-slate-50/80 transition-colors h-10">
                    <td className="border-r border-slate-100 text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="border-r border-slate-100 font-black text-slate-900 text-xs">
                      {t.teacherName} 선생님
                    </td>
                    <td className="border-r border-slate-100 text-slate-600 font-bold">
                      {t.homeroomClass || '-'}
                    </td>
                    <td className="border-r border-slate-100 font-bold text-rose-600 bg-rose-50/20">
                      {t.absenceHours > 0 ? `${t.absenceHours}시간` : '-'}
                    </td>
                    <td className="border-r border-slate-100 font-black text-indigo-600 bg-indigo-50/20">
                      {t.substituteHours > 0 ? `${t.substituteHours}시간` : '-'}
                    </td>
                    <td className="border-r border-slate-100 text-slate-600 font-bold">
                      {t.exchangeCount > 0 ? `${t.exchangeCount}회` : '-'}
                    </td>
                    <td className="font-black text-emerald-700 bg-emerald-50/20">
                      {t.payableSubstituteHours > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black">
                          {t.payableSubstituteHours}시간 인정
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 학사일정 & 행사 관리 모달 */}
      {isCalendarModalOpen && onSaveCalendarConfig && (
        <AcademicScheduleModal
          isOpen={isCalendarModalOpen}
          onClose={() => setIsCalendarModalOpen(false)}
          config={calendarConfig}
          onSave={onSaveCalendarConfig}
          timetableData={timetableData}
        />
      )}

      {/* 비밀번호 변경 모달 */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">수업계 비밀번호 변경</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="w-7 h-7 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">현재 비밀번호</label>
                <Input
                  type="password"
                  placeholder="현재 비밀번호 입력"
                  value={currPin}
                  onChange={e => setCurrPin(e.target.value)}
                  className="h-9 text-center font-mono tracking-widest text-xs bg-slate-50 border-slate-300 rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">새 비밀번호 (4자리 이상)</label>
                <Input
                  type="password"
                  placeholder="새 비밀번호 입력"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  className="h-9 text-center font-mono tracking-widest text-xs bg-slate-50 border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">새 비밀번호 확인</label>
                <Input
                  type="password"
                  placeholder="새 비밀번호 다시 입력"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  className="h-9 text-center font-mono tracking-widest text-xs bg-slate-50 border-slate-300 rounded-xl"
                />
              </div>

              {pinModalError && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span>{pinModalError}</span>
                </div>
              )}

              {pinModalSuccess && (
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{pinModalSuccess}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 h-9 text-xs font-bold border-slate-200 text-slate-600 rounded-xl cursor-pointer"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isChangingPin}
                  className="flex-1 h-9 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  {isChangingPin ? '변경 중...' : '비밀번호 변경'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
