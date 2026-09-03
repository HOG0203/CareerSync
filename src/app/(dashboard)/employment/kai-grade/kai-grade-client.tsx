'use client';

// ==============================================================================
// src/app/(dashboard)/employment/kai-grade/kai-grade-client.tsx
// 한국항공우주산업(주) KAI 고교 내신등급 대시보드
// (지원 가능 3개 학과 + 전과목 3.0등급 이내 & 국영수 3.0등급 이내 학생 카드 선별)
// ==============================================================================

import * as React from 'react';
import { 
  KaiStudentListItem, 
  getKaiGradeDataForStudent, 
  downloadKaiExcelAction,
  KaiStudentGradeResponse
} from './actions';
import { KaiCalculationResult } from '@/lib/employment/kai-calculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Plane,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Award,
  Sparkles,
  User,
  ShieldCheck,
  Loader2,
  Info,
  SlidersHorizontal,
  ArrowRight,
  Medal,
  Users,
  Target,
  Check,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KaiGradeClientProps {
  initialStudents: KaiStudentListItem[];
}

// KAI 생산직 공식 지원 가능 학과 목록
export const KAI_ALLOWED_MAJORS = ['자동화기계과', '친환경자동차과', '스마트전기과'];

export function KaiGradeClient({ initialStudents }: KaiGradeClientProps) {
  const [students] = React.useState<KaiStudentListItem[]>(initialStudents);

  // 🎯 KAI 공식 자격 필터 (기본값: TRUE - 전과목 3.0이내 & 국영수 3.0이내 & 지원학과 3개)
  const [isKaiFilterActive, setIsKaiFilterActive] = React.useState<boolean>(true);

  // 기본 검색 및 소속 필터 상태 ('kai_eligible' = 지원 가능 3개 학과 전체)
  const [majorFilter, setMajorFilter] = React.useState<string>('kai_eligible');
  const [classFilter, setClassFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  // 🎯 정렬 기준: 'combined' = 전과목+국영수 합산 우수순 (낮을수록 우수)
  const [sortOrder, setSortOrder] = React.useState<'combined' | 'all' | 'kem'>('combined');

  // 상세 모달 상태
  const [modalStudentId, setModalStudentId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [modalActiveTab, setModalActiveTab] = React.useState<'all' | 'kem' | 'excluded'>('all');

  // 데이터 로딩 상태
  const [modalLoading, setModalLoading] = React.useState<boolean>(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [modalGradeData, setModalGradeData] = React.useState<KaiStudentGradeResponse | null>(null);

  // 고유 학과 및 학반 목록 추출
  const availableMajors = React.useMemo(() => {
    return Array.from(new Set(students.map(s => s.major))).filter(Boolean).sort();
  }, [students]);

  const availableClasses = React.useMemo(() => {
    return Array.from(new Set(students.map(s => s.class_info))).filter(Boolean).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
  }, [students]);

  // 성적 우수순 정렬 및 필터링된 학생 목록 (KAI 공식 기준 적용)
  const rankedStudents = React.useMemo(() => {
    // 1. KAI 지원 조건 필터링
    return students.filter(s => {
      // (1) 학과 필터: KAI 공식 지원학과 3개(기계, 자동차, 전기)
      if (majorFilter === 'kai_eligible') {
        if (!KAI_ALLOWED_MAJORS.includes(s.major)) return false;
      } else if (majorFilter !== 'all') {
        if (s.major !== majorFilter) return false;
      }

      // (2) 반 필터
      if (classFilter !== 'all' && s.class_info !== classFilter) return false;

      // (3) 검색어 필터
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchNum = s.student_number?.includes(q);
        if (!matchName && !matchNum) return false;
      }

      // (4) 🎯 KAI 지원 자격 조건 (전과목 3.0등급 이내 AND 국영수 3.0등급 이내)
      if (isKaiFilterActive) {
        if (!s.hasScores || s.allGrade === null || s.allGrade === undefined || s.kemGrade === null || s.kemGrade === undefined) {
          return false;
        }
        if (s.allGrade > 3.0 || s.kemGrade > 3.0) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // 2. 성적 우수순(오름차순: 낮은 등급이 상위권) 정렬
      const allA = a.allGrade ?? 99;
      const allB = b.allGrade ?? 99;
      const kemA = a.kemGrade ?? 99;
      const kemB = b.kemGrade ?? 99;

      if (sortOrder === 'combined') {
        const combA = allA + kemA;
        const combB = allB + kemB;
        if (combA !== combB) return combA - combB;
        return allA - allB;
      } else if (sortOrder === 'kem') {
        if (kemA !== kemB) return kemA - kemB;
        return allA - allB;
      } else {
        if (allA !== allB) return allA - allB;
        return kemA - kemB;
      }
    });
  }, [students, isKaiFilterActive, majorFilter, classFilter, searchTerm, sortOrder]);

  // 현재 모달에 열린 학생의 인덱스
  const currentModalIndex = React.useMemo(() => {
    if (!modalStudentId) return -1;
    return rankedStudents.findIndex(s => s.id === modalStudentId);
  }, [rankedStudents, modalStudentId]);

  // 모달 이전/다음 학생 이동
  const handleModalPrev = () => {
    if (currentModalIndex > 0) {
      openStudentModal(rankedStudents[currentModalIndex - 1].id);
    }
  };

  const handleModalNext = () => {
    if (currentModalIndex >= 0 && currentModalIndex < rankedStudents.length - 1) {
      openStudentModal(rankedStudents[currentModalIndex + 1].id);
    }
  };

  // 학생 모달 열기 및 데이터 로드
  const openStudentModal = React.useCallback(async (studentId: string) => {
    setModalStudentId(studentId);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalActiveTab('all');
    try {
      const res = await getKaiGradeDataForStudent(studentId);
      if (res.success) {
        setModalGradeData(res);
      } else {
        alert(res.error || '성적 데이터를 불러오지 못했습니다.');
      }
    } catch (err: any) {
      console.error('openStudentModal error:', err);
      alert('데이터 로딩 중 오류가 발생했습니다.');
    } finally {
      setModalLoading(false);
    }
  }, []);

  // 엑셀 다운로드 핸들러
  const handleDownloadExcel = async (studentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(studentId);
    try {
      const res = await downloadKaiExcelAction(studentId);
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert(res.error || '엑셀 다운로드 파일 생성에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // 상위권 통계치 집계
  const top1Student = rankedStudents[0];
  const totalScoredStudents = students.filter(s => s.hasScores).length;

  // 학과별 인원수 집계
  const majorCounts = React.useMemo(() => {
    const counts: Record<string, number> = { '자동화기계과': 0, '친환경자동차과': 0, '스마트전기과': 0 };
    rankedStudents.forEach(s => {
      if (counts[s.major] !== undefined) counts[s.major]++;
    });
    return counts;
  }, [rankedStudents]);

  const currentModalStudent = modalGradeData?.student;
  const modalAllResult = modalGradeData?.allResult;
  const modalKemResult = modalGradeData?.kemResult;
  const modalActiveResult = modalActiveTab === 'kem' ? modalKemResult : modalAllResult;

  // 모달 제외 과목
  const modalExcludedSubjects = React.useMemo(() => {
    if (!modalGradeData?.rawScores) return [];
    return modalGradeData.rawScores.filter(sc => {
      const name = sc.subject || '';
      const isArt = ['체육', '운동', '스포츠', '축구', '육상', '음악', '미술', '건강'].some(k => name.includes(k));
      const isLang = ['일본어', '중국어', '한문', '독일어', '프랑스어'].some(k => name.includes(k));
      const isPF = sc.achievement?.toUpperCase() === 'P';
      const noGrade = !sc.rank_grade && !sc.achievement;
      return isArt || isLang || isPF || noGrade;
    });
  }, [modalGradeData?.rawScores]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pt-1">
      {/* ========================================================================= */}
      {/* 1. 제목줄: 상단 타이틀 헤더 (화면 전용, 인쇄 시 숨김) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-2.5 print:hidden">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
              <Plane className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <span>한국항공우주산업(주) 내신등급 순위 대시보드</span>
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
              KAI 지원자격 충족자 선별
            </span>
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            <strong>지원 가능 학과(자동화기계·친환경자동차·스마트전기)</strong>에서 <strong>전과목 3.0등급 이내 & 국영수 3.0등급 이내</strong>를 동시 충족한 우수 학생 명단입니다.
          </p>
        </div>

        {/* 상단 우측 보존 뱃지 */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shrink-0">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>KAI 공식 서식 수식(=D14*E14, =SUM, =ROUND) 100% 원형 보존</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 통계: 4종 핵심 요약 KPI 카드 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200 print:hidden">
        {/* 카드 1: KAI 최종 추천 가능 학생 총수 */}
        <Card className="border-blue-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-gradient-to-br from-blue-50/40 via-white to-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-blue-800 flex items-center gap-1">
                <span>🎯 KAI 지원 자격 충족자</span>
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">
                  {rankedStudents.length}
                </span>
                <span className="text-xs font-bold text-slate-400">명</span>
              </div>
              <p className="text-[10.5px] text-blue-700 font-bold">
                전과목 ≤ 3.0 & 국영수 ≤ 3.0
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <Target className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 종합 1위 최우수 학생 */}
        <Card className="border-amber-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-gradient-to-br from-amber-50/40 via-white to-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-amber-800">🥇 종합 1위 최우수 학생</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-amber-700">
                  {top1Student ? top1Student.student_name : '-'}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ({top1Student ? `${top1Student.major.replace('자동화기계과','기계과')} ${top1Student.class_info}반` : ''})
                </span>
              </div>
              <p className="text-[10.5px] text-amber-800 font-bold">
                전과목 {top1Student?.allGrade?.toFixed(2)} · 국영수 {top1Student?.kemGrade?.toFixed(2)} (합산 {(top1Student?.allGrade! + top1Student?.kemGrade!).toFixed(2)})
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-400 text-white flex items-center justify-center shadow-xs shrink-0">
              <Medal className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 학과별 분포 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">지원 가능 3개 학과 분포</p>
              <div className="text-xs font-black text-slate-900 space-y-0.5">
                <p>• 기계: <span className="text-blue-600">{majorCounts['자동화기계과'] || 0}명</span></p>
                <p>• 자동차: <span className="text-emerald-600">{majorCounts['친환경자동차과'] || 0}명</span> · 전기: <span className="text-purple-600">{majorCounts['스마트전기과'] || 0}명</span></p>
              </div>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200 shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 4: 전체 성적 산출 현황 */}
        <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold text-slate-500">3학년 전체 성적 연동</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                  {totalScoredStudents}
                </span>
                <span className="text-xs font-bold text-slate-400">/ {students.length}명 전원 완료</span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium">
                15,839건 성적 데이터 100% 매핑
              </p>
            </div>
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 3. 필터: 🎯 KAI 자격 조건 원클릭 필터 및 소속 툴바 */}
      {/* ========================================================================= */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0 print:hidden overflow-hidden">
        <CardContent className="p-3.5 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* 🎯 KAI 공식 자격 프리셋 버튼 */}
              <button
                type="button"
                onClick={() => {
                  setIsKaiFilterActive(!isKaiFilterActive);
                  if (!isKaiFilterActive) setMajorFilter('kai_eligible');
                }}
                className={cn(
                  "h-9 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs",
                  isKaiFilterActive
                    ? "bg-blue-600 text-white border-blue-700 shadow-blue-200"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <Target className="h-3.5 w-3.5" />
                <span>KAI 지원 자격 필터 (전과목≤3.0 & 국영수≤3.0)</span>
                {isKaiFilterActive && <Check className="h-3.5 w-3.5 ml-0.5" />}
              </button>

              {/* 학과 필터 셀렉트 */}
              <Select value={majorFilter} onValueChange={setMajorFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50/60">
                  <SelectValue placeholder="학과 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="kai_eligible" className="text-xs font-black text-blue-700">
                    🎯 KAI 지원 3개 학과 전체
                  </SelectItem>
                  <SelectItem value="all" className="text-xs font-bold">
                    전교 학과 전체
                  </SelectItem>
                  {KAI_ALLOWED_MAJORS.map(m => (
                    <SelectItem key={m} value={m} className="text-xs font-medium">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 반 필터 */}
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[95px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50/60">
                  <SelectValue placeholder="반 전체" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="text-xs font-bold">반 전체</SelectItem>
                  {availableClasses.map(c => (
                    <SelectItem key={c} value={c} className="text-xs font-medium">
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 검색창 */}
              <div className="relative w-[130px] sm:w-[150px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="이름/번호 검색"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 pl-8 text-xs font-medium rounded-xl border-slate-200"
                />
              </div>

              {/* 순위 정렬 기준 */}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs font-bold text-slate-500">순위:</span>
                <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                  <SelectTrigger className="w-[185px] h-9 text-xs font-black rounded-xl border-slate-200 bg-white shadow-2xs text-blue-900">
                    <SelectValue placeholder="정렬 기준" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="combined" className="text-xs font-bold">
                      🏆 전과목 + 국영수 합산 우수순
                    </SelectItem>
                    <SelectItem value="all" className="text-xs font-bold">
                      📊 전과목 평균 우수순
                    </SelectItem>
                    <SelectItem value="kem" className="text-xs font-bold">
                      ⚡ 국영수 평균 우수순
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 현재 선별 건수 뱃지 */}
            <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              조건 충족 학생: <span className="text-blue-600 font-black">{rankedStudents.length}명</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 4. 내용: KAI 지원 자격 충족 학생 가로형 와이드 카드 리스트 */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-2.5 w-full">
        {rankedStudents.length === 0 ? (
          <Card className="border-slate-200/80 shadow-2xs rounded-2xl bg-white p-12 text-center text-slate-400">
            <p className="text-sm font-bold text-slate-600">조건을 만족하는 학생이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">상단 필터 조건을 변경해 보세요.</p>
          </Card>
        ) : (
          rankedStudents.map((st, idx) => {
            const rank = idx + 1;
            const hasScores = st.hasScores;
            const isTop1 = rank === 1 && hasScores;
            const isTop2 = rank === 2 && hasScores;
            const isTop3 = rank === 3 && hasScores;
            const combinedGrade = (st.allGrade !== null && st.allGrade !== undefined && st.kemGrade !== null && st.kemGrade !== undefined)
              ? (st.allGrade + st.kemGrade).toFixed(2)
              : '-';

            return (
              <div
                key={st.id}
                onClick={() => openStudentModal(st.id)}
                className={cn(
                  "group relative w-full bg-white rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md",
                  isTop1 ? "border-amber-300 bg-gradient-to-r from-amber-50/50 via-white to-white hover:border-amber-400" :
                  isTop2 ? "border-slate-300 bg-gradient-to-r from-slate-50/60 via-white to-white hover:border-slate-400" :
                  isTop3 ? "border-amber-200/70 bg-gradient-to-r from-orange-50/30 via-white to-white hover:border-amber-300" :
                  "border-slate-200/90 hover:border-blue-300"
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                  {/* 좌측: 순위 뱃지 + 학생 기본 정보 */}
                  <div className="flex items-center gap-3.5 min-w-[250px] shrink-0">
                    {/* 순위 메달/뱃지 */}
                    <div className={cn(
                      "h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border shadow-2xs",
                      isTop1 ? "bg-amber-400 text-white border-amber-500 text-base" :
                      isTop2 ? "bg-slate-300 text-slate-800 border-slate-400 text-base" :
                      isTop3 ? "bg-amber-600 text-white border-amber-700 text-base" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `${rank}위`}
                    </div>

                    {/* 학생 프로필 */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {st.student_name}
                        </span>
                        {isTop1 && (
                          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.2 rounded-full font-black">
                            종합 1위
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span className="font-bold text-slate-700">{st.major}</span>
                        <span>·</span>
                        <span>{st.class_info}반</span>
                        <span>·</span>
                        <span>{st.student_number}번</span>
                      </div>
                    </div>
                  </div>

                  {/* 중앙: 3대 핵심 성적 지표 (가로 칩 형태) */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 justify-start md:justify-center">
                    {/* 전과목 평균 등급 */}
                    <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/80 px-3 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-blue-700">전과목 평균:</span>
                      <div className="flex items-baseline gap-0.5 font-mono">
                        <span className="text-base sm:text-lg font-black text-blue-700">
                          {st.allGrade?.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-blue-500 font-bold">등급</span>
                      </div>
                      <span className="text-[10px] text-blue-400 font-medium ml-0.5">
                        ({st.allCredits || 0}단위)
                      </span>
                    </div>

                    {/* 국영수 평균 등급 */}
                    <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-emerald-700">국영수 평균:</span>
                      <div className="flex items-baseline gap-0.5 font-mono">
                        <span className="text-base sm:text-lg font-black text-emerald-700">
                          {st.kemGrade?.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-500 font-bold">등급</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-medium ml-0.5">
                        ({st.kemCredits || 0}단위)
                      </span>
                    </div>

                    {/* 합산 등급 */}
                    <div className="flex items-center gap-2 bg-purple-50/80 border border-purple-200/80 px-3 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-purple-700">합산:</span>
                      <div className="flex items-baseline gap-0.5 font-mono">
                        <span className="text-base sm:text-lg font-black text-purple-700">
                          {combinedGrade}
                        </span>
                        <span className="text-[10px] text-purple-400 font-bold">점</span>
                      </div>
                    </div>
                  </div>

                  {/* 우측: 엑셀 다운로드 및 계산표 상세보기 버튼 */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloadingId === st.id}
                      onClick={(e) => handleDownloadExcel(st.id, e)}
                      className="h-8 px-2.5 text-xs font-bold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 cursor-pointer shadow-2xs"
                      title="KAI 공식 엑셀(.xlsx) 파일 즉시 다운로드"
                    >
                      {downloadingId === st.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <span className="hidden sm:inline">엑셀 다운</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openStudentModal(st.id)}
                      className="h-8 px-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>계산표 보기</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. 팝업 모달: [KAI 공식 내신등급 계산표 상세 모달 (대형 다이얼로그)] */}
      {/* ========================================================================= */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
          {/* 모달 상단 헤더 */}
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0 font-black">
                {currentModalIndex >= 0 ? `${currentModalIndex + 1}위` : 'KAI'}
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>{currentModalStudent ? currentModalStudent.student_name : '학생 계산표'}</span>
                  {currentModalStudent && (
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {currentModalStudent.major} {currentModalStudent.class_info}반 {currentModalStudent.student_number}번
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  한국항공우주산업(주) 생산직 채용 공식 지침에 따른 5개 학기 내신등급 산출표
                </DialogDescription>
              </div>
            </div>

            {/* 우측 상단: 인쇄 및 엑셀 다운로드 버튼 */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                disabled={modalLoading || !modalGradeData}
                className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>A4 공식 인쇄</span>
              </Button>

              <Button
                type="button"
                onClick={() => modalStudentId && handleDownloadExcel(modalStudentId)}
                disabled={modalLoading || downloadingId === modalStudentId || !modalGradeData}
                className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
              >
                {downloadingId === modalStudentId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>공식 엑셀(.xlsx) 다운로드</span>
              </Button>
            </div>
          </DialogHeader>

          {/* 모달 탭 및 본문 컨텐츠 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* 탭 컨트롤 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1.5 p-0.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'all'
                      ? "bg-blue-50 text-blue-900 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  <span>시트 1: 전과목 평균</span>
                  {modalAllResult && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-black">
                      {modalAllResult.finalGrade.toFixed(2)}등급
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalActiveTab('kem')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'kem'
                      ? "bg-emerald-50 text-emerald-900 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span>시트 2: 국영수 평균</span>
                  {modalKemResult && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-black">
                      {modalKemResult.finalGrade.toFixed(2)}등급
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalActiveTab('excluded')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'excluded'
                      ? "bg-amber-50 text-amber-900 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Info className="h-3.5 w-3.5 text-amber-600" />
                  <span>제외 과목 내역 ({modalAllResult?.excludedCount || 0})</span>
                </button>
              </div>

              {/* 최종 산출성적 하이라이트 뱃지 */}
              {modalActiveResult && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-blue-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-500">
                    {modalActiveTab === 'all' ? '전과목 산출성적:' : '국영수 산출성적:'}
                  </span>
                  <span className="text-base font-black text-blue-600 font-mono">
                    {modalActiveResult.finalGrade.toFixed(2)}등급
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (총 {modalActiveResult.grandTotalCredits}단위)
                  </span>
                </div>
              )}
            </div>

            {/* 모달 로딩 */}
            {modalLoading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-xs font-bold text-slate-600">학생 성적 및 KAI 계산표 로딩 중...</p>
              </div>
            ) : !modalGradeData || !modalActiveResult ? (
              <div className="p-12 text-center text-slate-400">
                <p className="text-xs font-bold text-slate-600">성적 데이터를 불러올 수 없습니다.</p>
              </div>
            ) : modalActiveTab === 'excluded' ? (
              /* 제외 과목 투명성 확인 탭 */
              <div className="bg-slate-50/60 rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  KAI 공식 지침 4항에 따라 산출에서 제외된 과목 목록
                </h4>
                {modalExcludedSubjects.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">제외된 과목이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {modalExcludedSubjects.map((sc, idx) => {
                      const isArt = ['체육', '운동', '스포츠', '축구', '육상', '음악', '미술', '건강'].some(k => sc.subject.includes(k));
                      const isLang = ['일본어', '중국어', '한문', '독일어', '프랑스어'].some(k => sc.subject.includes(k));
                      const reason = isArt ? '예체능 과목' : isLang ? '제2외국어/한문' : sc.achievement === 'P' ? 'P/F 이수 과목' : '석차등급/성취도 없음';

                      return (
                        <div key={`${sc.grade}-${sc.semester}-${sc.subject}-${idx}`} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{sc.grade}-{sc.semester} {sc.subject}</span>
                            <div className="text-[10px] text-slate-400">단위: {sc.credits || '-'} · 성취도: {sc.achievement || '-'} · 석차: {sc.rank_grade || '-'}</div>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            {reason}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* KAI 공식 서식 5개 학기 병렬 매트릭스 테이블 */
              <div className="border border-slate-300 rounded-xl overflow-x-auto min-w-[850px] shadow-2xs">
                <table className="w-full border-collapse text-center text-xs">
                  {/* 대제목 학기 헤더 */}
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-black">
                      {modalActiveResult.semesters.map(sem => (
                        <th key={`modal-head-${sem.grade}-${sem.semester}`} colSpan={4} className="py-2 px-1 border-r last:border-r-0 border-slate-300 text-xs">
                          {sem.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 text-[11px] font-bold">
                      {modalActiveResult.semesters.map(sem => (
                        <React.Fragment key={`modal-subhead-${sem.grade}-${sem.semester}`}>
                          <th className="py-1.5 px-1 border-r border-slate-300 w-[9%] text-slate-800">과목명</th>
                          <th className="py-1.5 px-1 border-r border-slate-300 w-[3.5%] bg-blue-50/60 text-blue-950">①단위수</th>
                          <th className="py-1.5 px-1 border-r border-slate-300 w-[3.5%] bg-blue-50/60 text-blue-950">②석차등급</th>
                          <th className="py-1.5 px-1 border-r last:border-r-0 border-slate-300 w-[4%] text-slate-600">단위수X등급</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>

                  {/* 15개 행 바디 */}
                  <tbody>
                    {Array.from({ length: 15 }).map((_, rowIdx) => (
                      <tr key={`modal-row-${rowIdx}`} className="border-b border-slate-200 hover:bg-slate-50/40 text-[11px]">
                        {modalActiveResult.semesters.map(sem => {
                          const rowData = sem.rows[rowIdx];
                          return (
                            <React.Fragment key={`modal-cell-${sem.grade}-${sem.semester}-${rowIdx}`}>
                              <td className="py-1 px-1 border-r border-slate-200 text-slate-900 truncate font-medium text-left pl-2">
                                {rowData ? rowData.subject : ''}
                              </td>
                              <td className="py-1 px-1 border-r border-slate-200 font-mono font-bold text-blue-950 bg-blue-50/20">
                                {rowData ? rowData.credits : ''}
                              </td>
                              <td className="py-1 px-1 border-r border-slate-200 font-mono font-black text-blue-950 bg-blue-50/20">
                                {rowData ? rowData.rankGrade : ''}
                              </td>
                              <td className="py-1 px-1 border-r last:border-r-0 border-slate-200 font-mono font-bold text-slate-600 bg-slate-50/40">
                                {rowData ? rowData.weightedGrade : ''}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}

                    {/* 29행 합계 */}
                    <tr className="bg-slate-100/80 border-b-2 border-slate-400 font-black text-slate-900 text-[11px]">
                      {modalActiveResult.semesters.map(sem => (
                        <React.Fragment key={`modal-sum-${sem.grade}-${sem.semester}`}>
                          <td className="py-2 px-1 border-r border-slate-300 text-center font-black">
                            합 계
                          </td>
                          <td className="py-2 px-1 border-r border-slate-300 font-mono text-blue-700 bg-blue-100/40">
                            {sem.totalCredits}
                          </td>
                          <td className="py-2 px-1 border-r border-slate-300 font-mono text-slate-400">
                            -
                          </td>
                          <td className="py-2 px-1 border-r last:border-r-0 border-slate-300 font-mono text-indigo-700 bg-indigo-50/40">
                            {sem.totalWeightedGrade}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 모달 하단: 이전/다음 순위 학생 연속 탐색 네비게이션 */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentModalIndex <= 0}
              onClick={handleModalPrev}
              className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 gap-1.5 cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>이전 ({currentModalIndex > 0 ? `${currentModalIndex}위 ${rankedStudents[currentModalIndex - 1]?.student_name}` : ''})</span>
            </Button>

            <div className="text-xs font-bold text-slate-500">
              현재 <span className="text-blue-600 font-black">{currentModalIndex + 1}위</span> / 총 {rankedStudents.length}명
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentModalIndex < 0 || currentModalIndex >= rankedStudents.length - 1}
              onClick={handleModalNext}
              className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-100 gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>다음 ({currentModalIndex >= 0 && currentModalIndex < rankedStudents.length - 1 ? `${currentModalIndex + 2}위 ${rankedStudents[currentModalIndex + 1]?.student_name}` : ''})</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
