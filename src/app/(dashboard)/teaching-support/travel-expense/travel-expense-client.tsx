'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/travel-expense/travel-expense-client.tsx
// 여비정산신청 통합 클라이언트 (최소 입력 스마트 자동화 & 실시간 A4 미리보기/인쇄)
// ==============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TravelExpenseSheet, TravelExpenseData, TransportationRow } from './travel-expense-sheet';
import { 
  Printer, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Car, 
  Sparkles, 
  Save, 
  Check, 
  ArrowRightLeft, 
  FileText, 
  Layers, 
  Eye, 
  Clock, 
  Calendar,
  MapPin, 
  Building2, 
  UserCheck,
  ChevronDown,
  ChevronUp,
  Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TravelExpenseClientProps {
  userProfile?: any;
}

// 자주 가는 출장 지역 프리셋
const POPULAR_REGIONS = ['경산', '구미', '영천', '칠곡', '포항', '창원', '경주', '대구'];

// 직급/직위 프리셋
const POSITION_PRESETS = ['교사', '취업지원관', '산학협력전담교사', '부장교사', '행정실무원', '실무원'];

// 유종 프리셋
const FUEL_TYPES = ['전기', '휘발유', '경유', '하이브리드', 'LPG', '해당없음'];

// 교통편 프리셋
const TRANSPORT_TYPES = ['자차', '버스', '기차(KTX)', '지하철', '택시', '항공'];

export function TravelExpenseClient({ userProfile }: TravelExpenseClientProps) {
  const defaultName = userProfile?.full_name || userProfile?.name || '이호중';
  const today = React.useMemo(() => new Date(), []);
  const todayIso = React.useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const todayKorean = React.useMemo(() => `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`, [today]);
  const todayDot = React.useMemo(() => `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`, [today]);

  // 기본 상태값 정의
  const [affiliation, setAffiliation] = React.useState('대구공업고등학교');
  const [position, setPosition] = React.useState('교사');
  const [applicantName, setApplicantName] = React.useState(defaultName);

  const [tripStartDate, setTripStartDate] = React.useState(todayIso);
  const [tripEndDate, setTripEndDate] = React.useState(todayIso);
  const [visitCompany, setVisitCompany] = React.useState('');
  const [visitRegion, setVisitRegion] = React.useState('');
  const [tripDestination, setTripDestination] = React.useState('대구공업고등학교');

  // 숙박비 & 식비 (옵션 섹션)
  const [showLodgingMeal, setShowLodgingMeal] = React.useState(false);
  const [lodgingLimitAmount, setLodgingLimitAmount] = React.useState<number | ''>('');
  const [lodgingActualAmount, setLodgingActualAmount] = React.useState<number | ''>('');
  const [lodgingExcessReason, setLodgingExcessReason] = React.useState('');
  const [mealPaidAmount, setMealPaidAmount] = React.useState<number | ''>('');
  const [mealActualAmount, setMealActualAmount] = React.useState<number | ''>('');
  const [mealExcessReason, setMealExcessReason] = React.useState('');

  // 운임 내역 (가는 편 / 오는 편 교통편 분리)
  const [goingTransportType, setGoingTransportType] = React.useState('자차');
  const [returningTransportType, setReturningTransportType] = React.useState('자차');
  const [transportRows, setTransportRows] = React.useState<TransportationRow[]>([
    {
      id: 'row-1',
      date: todayDot,
      transportType: '자차',
      origin: '대구',
      destination: '',
      grade: '',
      amount: ''
    },
    {
      id: 'row-2',
      date: todayDot,
      transportType: '자차',
      origin: '',
      destination: '대구',
      grade: '',
      amount: ''
    }
  ]);

  // 차량 및 비고
  const [fuelType, setFuelType] = React.useState('전기');
  const [passengerName, setPassengerName] = React.useState('');
  const [attachmentText, setAttachmentText] = React.useState('하이패스 영수증 1부');
  const [settlementDate, setSettlementDate] = React.useState(todayIso);

  // 모바일 전용 뷰 탭 ('edit' | 'preview')
  const [activeTab, setActiveTab] = React.useState<'edit' | 'preview'>('edit');
  const [savedAlert, setSavedAlert] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // ISO 날짜('YYYY-MM-DD')를 한글('YYYY년 M월 D일') 또는 점 표기('YYYY. M. D.')로 변환
  const isoToKorean = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const parts = isoStr.split('-');
      if (parts.length === 3) {
        return `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`;
      }
    } catch {}
    return isoStr;
  };

  const isoToDot = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const parts = isoStr.split('-');
      if (parts.length === 3) {
        return `${parts[0]}. ${parseInt(parts[1], 10)}. ${parseInt(parts[2], 10)}.`;
      }
    } catch {}
    return isoStr;
  };

  // 출장 날짜 포맷 (당일 출장이면 '2026년 10월 7일', 여러 날이면 '2026년 10월 7일 ~ 2026년 10월 8일')
  const formattedTripDate = React.useMemo(() => {
    if (!tripStartDate) return todayKorean;
    const startKo = isoToKorean(tripStartDate);
    if (!tripEndDate || tripStartDate === tripEndDate) {
      return startKo;
    }
    const endKo = isoToKorean(tripEndDate);
    return `${startKo} ~ ${endKo}`;
  }, [tripStartDate, tripEndDate, todayKorean]);

  // 신청일자 포맷 (2026년 10월 7일)
  const formattedSettlementDate = React.useMemo(() => {
    if (!settlementDate) return todayKorean;
    return isoToKorean(settlementDate);
  }, [settlementDate, todayKorean]);

  // 출장 시작일 변경 -> 운임표 1행(가는 편) 일자와 동기화
  const handleTripStartDateChange = (newDateIso: string) => {
    setTripStartDate(newDateIso);
    // 종료일이 시작일보다 앞서면 종료일도 시작일로 자동 맞춤
    if (!tripEndDate || tripEndDate < newDateIso) {
      setTripEndDate(newDateIso);
    }
    const dot = isoToDot(newDateIso);
    setTransportRows(prev => {
      if (prev.length > 0) {
        const nextRows = [...prev];
        nextRows[0] = { ...nextRows[0], date: dot };
        if (prev.length > 1 && (!tripEndDate || tripEndDate < newDateIso)) {
          nextRows[1] = { ...nextRows[1], date: dot };
        }
        return nextRows;
      }
      return prev;
    });
  };

  // 출장 종료일 변경 -> 운임표 마지막 행(오는 편) 일자와 동기화
  const handleTripEndDateChange = (newDateIso: string) => {
    setTripEndDate(newDateIso);
    const dot = isoToDot(newDateIso);
    setTransportRows(prev => {
      if (prev.length > 1) {
        const lastIdx = prev.length - 1;
        const nextRows = [...prev];
        nextRows[lastIdx] = { ...nextRows[lastIdx], date: dot };
        return nextRows;
      }
      return prev;
    });
  };

  // 방문 업체명 변경 시 출장지 자동 조합 (대구공업고등학교 → [업체명])
  const handleCompanyChange = (val: string) => {
    setVisitCompany(val);
    if (val.trim()) {
      setTripDestination(`대구공업고등학교 → ${val.trim()}`);
    } else {
      setTripDestination('대구공업고등학교');
    }
  };

  // 방문 지역 변경 시 운임 표의 출발지/도착지 자동 조합 (대구 ↔ [지역])
  const handleRegionChange = (val: string) => {
    setVisitRegion(val);
    const regionName = val.trim();
    setTransportRows(prev => {
      if (prev.length >= 2) {
        const lastIdx = prev.length - 1;
        const nextRows = [...prev];
        nextRows[0] = { ...nextRows[0], origin: '대구', destination: regionName };
        nextRows[lastIdx] = { ...nextRows[lastIdx], origin: regionName, destination: '대구' };
        return nextRows;
      }
      return prev;
    });
  };

  // 운임 내역 (가는 편 / 오는 편 개별 입력 지원)
  const [goingAmount, setGoingAmount] = React.useState<number | ''>('');
  const [returningAmount, setReturningAmount] = React.useState<number | ''>('');

  // 가는 편 교통편 변경
  const handleGoingTransportTypeChange = (type: string) => {
    setGoingTransportType(type);
    setTransportRows(prev => prev.length > 0 ? [{ ...prev[0], transportType: type }, ...prev.slice(1)] : prev);
  };

  // 오는 편 교통편 변경 (마지막 행에 적용)
  const handleReturningTransportTypeChange = (type: string) => {
    setReturningTransportType(type);
    setTransportRows(prev => {
      if (prev.length > 1) {
        const lastIdx = prev.length - 1;
        const next = [...prev];
        next[lastIdx] = { ...next[lastIdx], transportType: type };
        return next;
      }
      return prev;
    });
  };

  // 가는 편 운임 변경 시
  const handleGoingAmountChange = (valStr: string) => {
    if (!valStr) {
      setGoingAmount('');
      setTransportRows(prev => prev.length > 0 ? [{ ...prev[0], amount: '' }, ...prev.slice(1)] : prev);
      return;
    }
    const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) {
      setGoingAmount('');
      setTransportRows(prev => prev.length > 0 ? [{ ...prev[0], amount: '' }, ...prev.slice(1)] : prev);
      return;
    }
    setGoingAmount(num);
    setTransportRows(prev => prev.length > 0 ? [{ ...prev[0], amount: num }, ...prev.slice(1)] : prev);
  };

  // 오는 편 운임 변경 시 (마지막 행에 적용)
  const handleReturningAmountChange = (valStr: string) => {
    if (!valStr) {
      setReturningAmount('');
      setTransportRows(prev => {
        if (prev.length > 1) {
          const lastIdx = prev.length - 1;
          const next = [...prev];
          next[lastIdx] = { ...next[lastIdx], amount: '' };
          return next;
        }
        return prev;
      });
      return;
    }
    const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(num)) {
      setReturningAmount('');
      setTransportRows(prev => {
        if (prev.length > 1) {
          const lastIdx = prev.length - 1;
          const next = [...prev];
          next[lastIdx] = { ...next[lastIdx], amount: '' };
          return next;
        }
        return prev;
      });
      return;
    }
    setReturningAmount(num);
    setTransportRows(prev => {
      if (prev.length > 1) {
        const lastIdx = prev.length - 1;
        const next = [...prev];
        next[lastIdx] = { ...next[lastIdx], amount: num };
        return next;
      }
      return prev;
    });
  };

  // 개별 운임 행 업데이트
  const handleUpdateTransportRow = (index: number, field: keyof TransportationRow, value: any) => {
    setTransportRows(prev => {
      const updated = prev.map((r, i) => i === index ? { ...r, [field]: value } : r);
      const lastIdx = updated.length - 1;
      if (field === 'amount') {
        if (index === 0) setGoingAmount(typeof value === 'number' ? value : '');
        if (index === lastIdx && lastIdx > 0) setReturningAmount(typeof value === 'number' ? value : '');
      }
      if (field === 'transportType') {
        if (index === 0) setGoingTransportType(value);
        if (index === lastIdx && lastIdx > 0) setReturningTransportType(value);
      }
      return updated;
    });
  };

  // 운임 행 추가 (가는 편과 오는 편 사이에 가운데 행 삽입, 출발과 도착은 빈칸으로 생성)
  const handleAddTransportRow = () => {
    setTransportRows(prev => {
      const newRow: TransportationRow = {
        id: `row-${Date.now()}`,
        date: prev[0]?.date || todayDot,
        transportType: goingTransportType || '자차',
        origin: '',
        destination: '',
        grade: '',
        amount: ''
      };

      if (prev.length <= 1) {
        return [...prev, newRow];
      }

      // 마지막 행(오는 편) 바로 직전(가운데)에 새 행 삽입
      const lastIdx = prev.length - 1;
      return [
        ...prev.slice(0, lastIdx),
        newRow,
        prev[lastIdx]
      ];
    });
  };

  // 운임 행 삭제
  const handleRemoveTransportRow = (index: number) => {
    if (transportRows.length <= 1) return;
    setTransportRows(prev => prev.filter((_, i) => i !== index));
  };


  // 인쇄 다이얼로그 호출
  const handlePrint = () => {
    window.print();
  };

  // 샘플 데이터 불러오기 (사용자 PDF와 100% 동일한 경산 아진산업 예시)
  const handleLoadSample = () => {
    setTripStartDate('2026-10-07');
    setTripEndDate('2026-10-07');
    setVisitCompany('아진산업');
    setVisitRegion('경산');
    setTripDestination('대구공업고등학교 → 아진산업');
    setPosition('교사');
    setGoingTransportType('자차');
    setReturningTransportType('자차');
    setFuelType('전기');
    setPassengerName('');
    setAttachmentText('하이패스 영수증 1부');
    setSettlementDate(todayIso);
    setGoingAmount('');
    setReturningAmount('');
    setTransportRows([
      {
        id: 'sample-1',
        date: '2026. 10. 7.',
        transportType: '자차',
        origin: '대구',
        destination: '경산',
        grade: '',
        amount: ''
      },
      {
        id: 'sample-2',
        date: '2026. 10. 7.',
        transportType: '자차',
        origin: '경산',
        destination: '대구',
        grade: '',
        amount: ''
      }
    ]);
  };

  // 초기화
  const handleReset = () => {
    setTripStartDate(todayIso);
    setTripEndDate(todayIso);
    setVisitCompany('');
    setVisitRegion('');
    setTripDestination('대구공업고등학교');
    setPosition('교사');
    setGoingTransportType('자차');
    setReturningTransportType('자차');
    setFuelType('전기');
    setPassengerName('');
    setAttachmentText('하이패스 영수증 1부');
    setSettlementDate(todayIso);
    setGoingAmount('');
    setReturningAmount('');
    setLodgingLimitAmount('');
    setLodgingActualAmount('');
    setLodgingExcessReason('');
    setMealPaidAmount('');
    setMealActualAmount('');
    setMealExcessReason('');
    setTransportRows([
      {
        id: 'row-1',
        date: todayDot,
        transportType: '자차',
        origin: '대구',
        destination: '',
        grade: '',
        amount: ''
      },
      {
        id: 'row-2',
        date: todayDot,
        transportType: '자차',
        origin: '',
        destination: '대구',
        grade: '',
        amount: ''
      }
    ]);
  };

  // LocalStorage 저장 및 불러오기
  const handleSaveToLocal = () => {
    try {
      const stateToSave = {
        position,
        fuelType,
        passengerName,
        attachmentText,
        goingTransportType,
        returningTransportType
      };
      localStorage.setItem('careersync_travel_expense_pref', JSON.stringify(stateToSave));
      setSavedAlert(true);
      setTimeout(() => setSavedAlert(false), 2000);
    } catch {}
  };

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('careersync_travel_expense_pref');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.position) setPosition(parsed.position);
        if (parsed.fuelType) setFuelType(parsed.fuelType);
        if (parsed.passengerName) setPassengerName(parsed.passengerName);
        if (parsed.attachmentText) setAttachmentText(parsed.attachmentText);
        if (parsed.goingTransportType) {
          setGoingTransportType(parsed.goingTransportType);
          setTransportRows(prev => prev.length > 0 ? [{ ...prev[0], transportType: parsed.goingTransportType }, ...prev.slice(1)] : prev);
        }
        if (parsed.returningTransportType) {
          setReturningTransportType(parsed.returningTransportType);
          setTransportRows(prev => prev.length > 1 ? [prev[0], { ...prev[1], transportType: parsed.returningTransportType }, ...prev.slice(2)] : prev);
        }
      }
    } catch {}
  }, []);

  // 전체 데이터 객체 구성
  const sheetData: TravelExpenseData = React.useMemo(() => ({
    affiliation,
    position,
    applicantName,
    tripDateText: formattedTripDate,
    tripDestination,
    lodgingLimitAmount,
    lodgingActualAmount,
    lodgingExcessReason,
    mealPaidAmount,
    mealActualAmount,
    mealExcessReason,
    transportRows,
    fuelType,
    passengerName,
    attachmentText,
    settlementDateText: formattedSettlementDate
  }), [
    affiliation,
    position,
    applicantName,
    formattedTripDate,
    tripDestination,
    lodgingLimitAmount,
    lodgingActualAmount,
    lodgingExcessReason,
    mealPaidAmount,
    mealActualAmount,
    mealExcessReason,
    transportRows,
    fuelType,
    passengerName,
    attachmentText,
    formattedSettlementDate
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pt-1">
      {/* 1. 제목줄: 상단 타이틀 헤더 (모바일 반응형 최적화) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5 print:hidden">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <Car className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
              여비 정산 신청서
            </h2>
            <span className="text-[10px] sm:text-[11px] bg-blue-600 text-white px-2 sm:px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              별지 제3호서식
            </span>
          </div>
          <p className="text-slate-500 text-[11px] sm:text-xs font-medium">
            출장 목적지와 지역만 적으면 100% 자동 서식 완성 및 규격 A4 즉시 출력
          </p>
        </div>

        {/* 상단 우측 관리 및 출력 버튼군 */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            className="h-8 sm:h-9 px-3 rounded-xl border border-slate-200/80 text-xs font-bold gap-1.5 text-slate-700 hover:text-blue-700 hover:bg-blue-50/50 shadow-2xs transition-all"
            title="경산 아진산업 출장 예시 데이터를 즉시 채웁니다."
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>샘플 불러오기</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 sm:h-9 px-2.5 rounded-xl text-xs font-bold gap-1 text-slate-500 hover:text-slate-800 transition-all"
            title="모든 항목을 초기화합니다."
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">초기화</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveToLocal}
            className={cn(
              "h-8 sm:h-9 px-3 rounded-xl border border-slate-200/80 text-xs font-bold gap-1.5 shadow-2xs transition-all",
              savedAlert ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "text-slate-700 hover:bg-slate-50"
            )}
            title="현재 설정을 브라우저에 기본값으로 저장합니다."
          >
            {savedAlert ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5 text-slate-500" />}
            <span>{savedAlert ? '저장됨' : '설정 저장'}</span>
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all"
          >
            <Printer className="h-3.5 w-3.5 text-blue-400" />
            <span>A4 인쇄하기</span>
          </Button>
        </div>
      </div>

      {/* 모바일 뷰 탭 토글 바 (화면 폭이 작을 때만 표시) */}
      <div className="flex lg:hidden bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 gap-1 shrink-0 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={cn(
            "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
            activeTab === 'edit' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>신청서 작성</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            "flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5",
            activeTab === 'preview' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>A4 미리보기 & 인쇄</span>
        </button>
      </div>

      {/* 3. 메인 바디: 좌측 입력 폼 & 우측 A4 실시간 미리보기 (데스크톱 2컬럼 스플릿) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar print:overflow-visible print:block print:p-0">
        
        {/* ============================================================== */}
        {/* 좌측 패널: 초경량 최소 입력 폼 (모바일에서는 activeTab === 'edit') */}
        {/* ============================================================== */}
        <div className={cn(
          "lg:col-span-5 xl:col-span-5 space-y-3 print:hidden",
          activeTab === 'edit' ? "block" : "hidden lg:block"
        )}>
          <Card className="border-slate-200/80 shadow-2xs rounded-2xl bg-white p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="text-xs sm:text-sm font-black text-slate-900">출장 및 정산 정보 입력</span>
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">실시간 서식 자동 반영</span>
            </div>
            {/* 1행: 출장 일자(시작일 ~ 종료일) & 직급/직위 */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>시작일 (가는 편)</span>
                </Label>
                <Input 
                  type="date"
                  value={tripStartDate} 
                  onChange={(e) => handleTripStartDateChange(e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>종료일 (오는 편)</span>
                </Label>
                <Input 
                  type="date"
                  value={tripEndDate} 
                  onChange={(e) => handleTripEndDateChange(e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>직급(직위)</span>
                  <span className="text-[10px] text-slate-400 font-normal">{applicantName}</span>
                </Label>
                <div className="flex items-center gap-1.5">
                    <select
                    value={POSITION_PRESETS.includes(position) ? position : '직접입력'}
                    onChange={(e) => {
                      if (e.target.value !== '직접입력') {
                        setPosition(e.target.value);
                      }
                    }}
                    className="h-9 text-xs font-bold bg-white border border-slate-200/80 rounded-xl px-2.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                  >
                    {POSITION_PRESETS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="직접입력">직접입력</option>
                  </select>
                  {!POSITION_PRESETS.includes(position) && (
                    <Input
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="h-9 text-xs font-bold w-20 shrink-0 rounded-xl"
                      placeholder="직접입력"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 2행: 방문 기관/업체명 & 방문 지역(시·군) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>방문 기관/업체명</span>
                </Label>
                <Input 
                  value={visitCompany} 
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="h-9 text-xs font-black focus:border-blue-500 rounded-xl bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  <span>방문 지역 (시·군명)</span>
                </Label>
                <Input 
                  value={visitRegion} 
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="h-9 text-xs font-black focus:border-emerald-500 rounded-xl bg-white"
                />
              </div>
            </div>

            {/* 지역 원클릭 칩 (한 줄로 콤팩트) */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">지역 퀵선택:</span>
              {POPULAR_REGIONS.map(reg => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => handleRegionChange(reg)}
                  className={cn(
                    "h-6 px-2 rounded-lg text-[10.5px] font-bold transition-all border",
                    visitRegion === reg
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
                  )}
                >
                  {reg}
                </button>
              ))}
            </div>

            {/* 3행: 운임 내역 직접 편집 (가는 편/오는 편 일자·교통편·구간·금액 일체형) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Car className="h-3.5 w-3.5 text-blue-600" />
                  <span>운임 내역 (교통편 및 행별 금액)</span>
                </Label>
                <button
                  type="button"
                  onClick={handleAddTransportRow}
                  className="text-[10.5px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  <span>행 추가</span>
                </button>
              </div>

              {/* 운임 행 목록 */}
              <div className="space-y-1.5">
                {transportRows.map((row, idx) => (
                  <div 
                    key={row.id || idx} 
                    className="grid grid-cols-12 gap-1.5 items-center bg-slate-50/70 p-1.5 rounded-xl border border-slate-200/80"
                  >
                    {/* 일자 */}
                    <div className="col-span-3">
                      <Input
                        value={row.date}
                        onChange={(e) => handleUpdateTransportRow(idx, 'date', e.target.value)}
                        placeholder="일자"
                        className="h-8 text-[11px] px-1.5 font-mono bg-white text-center rounded-lg"
                      />
                    </div>

                    {/* 교통편 */}
                    <div className="col-span-2">
                      <select
                        value={row.transportType}
                        onChange={(e) => handleUpdateTransportRow(idx, 'transportType', e.target.value)}
                        className="h-8 text-[11px] bg-white border border-slate-200/80 rounded-lg px-1 w-full font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {TRANSPORT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* 출발지 */}
                    <div className="col-span-2">
                      <Input
                        value={row.origin}
                        onChange={(e) => handleUpdateTransportRow(idx, 'origin', e.target.value)}
                        placeholder="출발"
                        className="h-8 text-[11px] px-1 text-center font-bold bg-white rounded-lg"
                      />
                    </div>

                    {/* 도착지 */}
                    <div className="col-span-2">
                      <Input
                        value={row.destination}
                        onChange={(e) => handleUpdateTransportRow(idx, 'destination', e.target.value)}
                        placeholder="도착"
                        className="h-8 text-[11px] px-1 text-center font-bold bg-white rounded-lg"
                      />
                    </div>

                    {/* 금액 */}
                    <div className={cn(transportRows.length > 2 ? "col-span-2" : "col-span-3", "relative")}>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => handleUpdateTransportRow(idx, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="h-8 text-[11px] px-1.5 pr-4 text-right font-black bg-white rounded-lg"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-400 pointer-events-none">원</span>
                    </div>

                    {/* 삭제 버튼 (3행 이상일 때만 표시) */}
                    {transportRows.length > 2 && (
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveTransportRow(idx)}
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center justify-center transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4행: 차량 유종 */}
            <div className="pt-1 border-t border-slate-100">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700">차량 유종</Label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="h-9 text-xs font-bold bg-white border border-slate-200/80 rounded-xl px-2.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                >
                  {FUEL_TYPES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 접이식 부가 옵션 (차량 동승자 / 숙박·식비 / 첨부서류 등) */}
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full py-2 px-3 text-[11px] font-bold text-slate-600 bg-slate-50/70 hover:bg-slate-100 border border-slate-200/80 rounded-xl flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-600" />
                  <span>부가 옵션 (차량 동승자 / 숙박·식비 / 첨부서류)</span>
                </span>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
              </button>

              {showAdvanced && (
                <div className="pt-2 space-y-3.5 border-t border-slate-100/80 animate-in fade-in duration-150">
                  {/* 1. 차량 동승자 & 첨부 서류 문구 (1 x 2 배치) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[10.5px] font-bold text-slate-700">차량 동승자 (선택)</Label>
                      <Input 
                        value={passengerName} 
                        onChange={(e) => setPassengerName(e.target.value)}
                        className="h-9 text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10.5px] font-bold text-slate-700">첨부 서류 문구</Label>
                      <Input 
                        value={attachmentText} 
                        onChange={(e) => setAttachmentText(e.target.value)}
                        className="h-9 text-xs font-bold rounded-xl"
                        placeholder="하이패스 영수증 1부"
                      />
                    </div>
                  </div>

                  {/* 2. 숙박비 & 식비 */}
                  <div className="space-y-2.5 pt-1 border-t border-slate-100">
                    <Label className="text-[11px] font-extrabold text-slate-800 block">
                      숙박비 및 식비 세부 정산
                    </Label>

                    {/* 숙박비 행 (1행: 상한액/선금, 실제 소요액, 초과지출 사유) */}
                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-700 block">숙박비</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">상한액/선금</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={lodgingLimitAmount}
                              onChange={(e) => setLodgingLimitAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="h-8.5 text-xs text-right pr-5 font-bold bg-white rounded-lg"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-400 pointer-events-none">원</span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">실제 소요액</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={lodgingActualAmount}
                              onChange={(e) => setLodgingActualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="h-8.5 text-xs text-right pr-5 font-bold bg-white rounded-lg"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-400 pointer-events-none">원</span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">초과지출 사유</Label>
                          <Input
                            value={lodgingExcessReason}
                            onChange={(e) => setLodgingExcessReason(e.target.value)}
                            className="h-8.5 text-xs bg-white rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 식비 행 (2행: 지급받은 금액, 실제 소요액, 초과지출 사유) */}
                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-[11px] font-black text-slate-700 block">식비</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">지급받은 금액</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={mealPaidAmount}
                              onChange={(e) => setMealPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="h-8.5 text-xs text-right pr-5 font-bold bg-white rounded-lg"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-400 pointer-events-none">원</span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">실제 소요액</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={mealActualAmount}
                              onChange={(e) => setMealActualAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              className="h-8.5 text-xs text-right pr-5 font-bold bg-white rounded-lg"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] font-bold text-slate-400 pointer-events-none">원</span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <Label className="text-[9.5px] font-bold text-slate-500">초과지출 사유</Label>
                          <Input
                            value={mealExcessReason}
                            onChange={(e) => setMealExcessReason(e.target.value)}
                            className="h-8.5 text-xs bg-white rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* 우측 패널: 실시간 A4 미리보기 & 인쇄 전용 뷰                   */}
        {/* ============================================================== */}
        <div className={cn(
          "lg:col-span-7 xl:col-span-7 flex flex-col items-center justify-start print:w-full print:block print:p-0",
          activeTab === 'preview' ? "block" : "hidden lg:block"
        )}>
          {/* A4 미리보기 상단 가이드 */}
          <div className="w-full max-w-[800px] mb-2 flex items-center justify-between text-xs text-slate-500 font-medium px-2 print:hidden">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              실시간 A4 공식 서식 1:1 미리보기
            </span>
            <span className="text-[11px] text-slate-400">
              💡 인쇄 버튼 클릭 시 서식 영역만 깔끔하게 출력됩니다.
            </span>
          </div>

          {/* 인쇄 대상 시트 (화면에서는 그림자 박스, 인쇄 시 순수 A4 시트) */}
          <div className="w-full flex justify-center overflow-x-auto custom-scrollbar p-1 print:p-0 print:m-0 print:overflow-visible">
            <TravelExpenseSheet data={sheetData} />
          </div>
        </div>
      </div>
    </div>
  );
}
