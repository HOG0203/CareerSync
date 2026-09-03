'use client';

// ==============================================================================
// src/app/(dashboard)/employment/grade/grade-client.tsx
// 내신등급 계산기 메인 클라이언트 허브
// (사용자 맞춤 조건 설정, 나만의 프리셋 저장/관리, 실시간 카드 그리드 & 상세 모달)
// ==============================================================================

import * as React from 'react';
import {
  GpaCriteria,
  GpaCalculationPreset,
  GradeStudentListItem,
  RawScoreItem,
  saveGpaPreset,
  deleteGpaPreset,
  downloadGradeExcelAction,
  downloadStudentKaiExcelAction,
  downloadBatchKaiExcelZipAction,
} from './actions';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calculator,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Users,
  Target,
  Plus,
  Trash2,
  Edit3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  Check,
  Sparkles,
  BookOpen,
  Filter,
  GraduationCap,
  Layers,
  FileSpreadsheet,
  X,
  ExternalLink,
  Archive,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradeClientProps {
  initialPresets: GpaCalculationPreset[];
  initialStudents: GradeStudentListItem[];
}

// ------------------------------------------------------------------------------
// 과목 분류 헬퍼 함수
// ------------------------------------------------------------------------------
function isArtsOrPhysical(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['체육', '체조', '운동', '스포츠', '축구', '육상', '음악', '미술', '창작', '건강'];
  return keywords.some(k => n.includes(k));
}

function isSecondForeignOrHanja(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['일본어', '중국어', '한문', '독일어', '프랑스어', '스페인어', '러시아어', '베트남어'];
  return keywords.some(k => n.includes(k));
}

function isKorean(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['국어', '문학', '독서', '화법', '작문', '언어와', '고전'];
  return keywords.some(k => n.includes(k));
}

function isMath(name: string): boolean {
  if (!name) return false;
  const n = name.replace(/\s+/g, '');
  const keywords = ['수학', '미적분', '기하', '확률'];
  return keywords.some(k => n.includes(k));
}

function isEnglish(name: string): boolean {
  if (!name) return false;
  return name.includes('영어');
}

function isKEM(name: string): boolean {
  return isKorean(name) || isMath(name) || isEnglish(name);
}

// ------------------------------------------------------------------------------
// 학생 1인의 성적을 현재 조건(Criteria)에 따라 계산하는 함수
// ------------------------------------------------------------------------------
interface StudentCalculatedResult {
  kemGrade: number | null;
  allGrade: number | null;
  kemCredits: number;
  allCredits: number;
  kemPassed: boolean;
  allPassed: boolean;
  majorPassed: boolean;
  isEligible: boolean;
  semestersBreakdown: any[];
}

function calculateStudentResult(
  student: GradeStudentListItem,
  criteria: GpaCriteria
): StudentCalculatedResult {
  const is9Scale = criteria.gradeScale !== '5_scale';
  const preferRankGrade = criteria.preferRankGrade ?? true;

  let kemWeightedSum = 0;
  let kemCreditsSum = 0;
  let allWeightedSum = 0;
  let allCreditsSum = 0;

  const semesterMap = new Map<string, { label: string; grade: number; semester: number; rows: any[] }>();

  student.rawScores.forEach(sc => {
    // 1. 학기 필터
    if (criteria.targetSemesters === 'five_semesters') {
      if (sc.grade > 3 || (sc.grade === 3 && sc.semester > 1)) return;
    }

    const semKey = `${sc.grade}-${sc.semester}`;
    if (!semesterMap.has(semKey)) {
      semesterMap.set(semKey, {
        label: `${sc.grade}학년 ${sc.semester}학기`,
        grade: sc.grade,
        semester: sc.semester,
        rows: [],
      });
    }

    const sub = sc.subject || '';
    const credits = sc.credits ? Number(sc.credits) : 0;
    const hasRankGrade = sc.rank_grade && !isNaN(Number(sc.rank_grade));
    const isPf = sc.achievement?.toUpperCase() === 'P';

    // 제외 사유 확인
    let isExcluded = false;
    let excludeReason = '';

    if (credits <= 0) {
      isExcluded = true;
      excludeReason = '학점 0';
    } else if (criteria.excludeArts && isArtsOrPhysical(sub)) {
      isExcluded = true;
      excludeReason = '예체능 제외';
    } else if (criteria.excludeSecondLang && isSecondForeignOrHanja(sub)) {
      isExcluded = true;
      excludeReason = '제2외국어/한문 제외';
    } else if (criteria.excludePF && isPf) {
      isExcluded = true;
      excludeReason = 'P/F 과목 제외';
    }

    // 등급 환산
    let subjectGrade: number | null = null;
    if (!isExcluded) {
      if (preferRankGrade && hasRankGrade) {
        const rg = Number(sc.rank_grade);
        if (is9Scale) {
          subjectGrade = Math.min(9, Math.max(1, rg));
        } else {
          subjectGrade = rg <= 2 ? 1 : rg <= 4 ? 2 : rg <= 6 ? 3 : rg <= 8 ? 4 : 5;
        }
      } else {
        const ach = sc.achievement?.toUpperCase();
        if (is9Scale) {
          const map9: Record<string, number> = { A: 1, B: 3, C: 5, D: 7, E: 9 };
          if (ach && map9[ach]) subjectGrade = map9[ach];
          else if (hasRankGrade) subjectGrade = Math.min(9, Math.max(1, Number(sc.rank_grade)));
        } else {
          const map5: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
          if (ach && map5[ach]) subjectGrade = map5[ach];
          else if (hasRankGrade) {
            const rg = Number(sc.rank_grade);
            subjectGrade = rg <= 2 ? 1 : rg <= 4 ? 2 : rg <= 6 ? 3 : rg <= 8 ? 4 : 5;
          }
        }
      }
    }

    if (!isExcluded && subjectGrade !== null && credits > 0) {
      allWeightedSum += subjectGrade * credits;
      allCreditsSum += credits;

      if (isKEM(sub)) {
        kemWeightedSum += subjectGrade * credits;
        kemCreditsSum += credits;
      }
    }

    semesterMap.get(semKey)!.rows.push({
      subject: sub,
      credits,
      originalAchievement: sc.achievement,
      originalRankGrade: sc.rank_grade,
      rankGrade: subjectGrade,
      weightedGrade: subjectGrade !== null ? subjectGrade * credits : 0,
      isExcluded,
      excludeReason,
      isKEM: isKEM(sub),
    });
  });

  const allGrade = allCreditsSum > 0 ? parseFloat((allWeightedSum / allCreditsSum).toFixed(2)) : null;
  const kemGrade = kemCreditsSum > 0 ? parseFloat((kemWeightedSum / kemCreditsSum).toFixed(2)) : null;

  // 자격 판정
  const kemPassed = criteria.kemCutoff === null || (kemGrade !== null && kemGrade <= criteria.kemCutoff);
  const allPassed = criteria.allCutoff === null || (allGrade !== null && allGrade <= criteria.allCutoff);
  const majorPassed = criteria.selectedMajors.length === 0 || criteria.selectedMajors.includes(student.major);

  let isEligible = false;
  if (majorPassed) {
    if (criteria.conditionLogic === 'AND') {
      isEligible = kemPassed && allPassed;
    } else {
      isEligible = kemPassed || allPassed;
    }
  }

  const semestersBreakdown = Array.from(semesterMap.values()).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.semester - b.semester;
  });

  return {
    kemGrade,
    allGrade,
    kemCredits: kemCreditsSum,
    allCredits: allCreditsSum,
    kemPassed,
    allPassed,
    majorPassed,
    isEligible,
    semestersBreakdown,
  };
}

export function GradeClient({ initialPresets, initialStudents }: GradeClientProps) {
  const [presets, setPresets] = React.useState<GpaCalculationPreset[]>(initialPresets);
  const [activePresetId, setActivePresetId] = React.useState<string>(initialPresets[0]?.id || 'preset-kai-default');

  // 현재 활성 조건 상태
  const activePreset = React.useMemo(() => {
    return presets.find(p => p.id === activePresetId) || presets[0];
  }, [presets, activePresetId]);

  const [criteria, setCriteria] = React.useState<GpaCriteria>(
    activePreset ? { ...activePreset.criteria } : {
      kemCutoff: 3.0,
      allCutoff: 3.0,
      conditionLogic: 'AND',
      selectedMajors: ['자동화기계과', '친환경자동차과', '스마트전기과'],
      excludeArts: true,
      excludeSecondLang: true,
      excludePF: true,
      targetSemesters: 'five_semesters',
      gradeScale: '9_scale',
      preferRankGrade: true,
    }
  );

  // 프리셋 선택 시 criteria 동기화
  const handleSelectPreset = (preset: GpaCalculationPreset) => {
    setActivePresetId(preset.id);
    setCriteria({ ...preset.criteria });
  };

  // 프리셋 저장 모달 상태
  const [isPresetModalOpen, setIsPresetModalOpen] = React.useState<boolean>(false);
  const [presetFormName, setPresetFormName] = React.useState<string>('');
  const [presetFormDesc, setPresetFormDesc] = React.useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = React.useState<boolean>(false);

  // 조건 설정 패널 접기/펼치기
  const [isPanelOpen, setIsPanelOpen] = React.useState<boolean>(true);

  // 필터 및 보기 모드
  const [viewFilter, setViewFilter] = React.useState<'eligible_only' | 'all'>('eligible_only');
  const [sortOrder, setSortOrder] = React.useState<'combined' | 'all' | 'kem' | 'studentNumber'>('combined');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  // 학생 상세 모달 상태
  const [selectedStudent, setSelectedStudent] = React.useState<GradeStudentListItem | null>(null);
  const [selectedStudentResult, setSelectedStudentResult] = React.useState<StudentCalculatedResult | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState<boolean>(false);
  const [modalTab, setModalTab] = React.useState<'all' | 'kem' | 'excluded'>('all');

  // 사용 가능한 고유 학과 목록 추출
  const availableMajors = React.useMemo(() => {
    return Array.from(new Set(initialStudents.map(s => s.major))).filter(Boolean).sort();
  }, [initialStudents]);

  // 전 학생 실시간 계산 및 필터링/정렬 (0.01초 초고속)
  const evaluatedStudents = React.useMemo(() => {
    const list = initialStudents.map(student => {
      const result = calculateStudentResult(student, criteria);
      return {
        ...student,
        result,
      };
    });

    // 정렬
    list.sort((a, b) => {
      // 1순위: 자격 충족 여부 (충족자가 상위)
      if (a.result.isEligible !== b.result.isEligible) {
        return a.result.isEligible ? -1 : 1;
      }

      if (sortOrder === 'combined') {
        const sumA = (a.result.allGrade ?? 99) + (a.result.kemGrade ?? 99);
        const sumB = (b.result.allGrade ?? 99) + (b.result.kemGrade ?? 99);
        return sumA - sumB;
      } else if (sortOrder === 'all') {
        return (a.result.allGrade ?? 99) - (b.result.allGrade ?? 99);
      } else if (sortOrder === 'kem') {
        return (a.result.kemGrade ?? 99) - (b.result.kemGrade ?? 99);
      } else {
        return a.student_number.localeCompare(b.student_number);
      }
    });

    return list;
  }, [initialStudents, criteria, sortOrder]);

  // 화면에 표시될 최종 필터링 학생 목록
  const displayedStudents = React.useMemo(() => {
    return evaluatedStudents.filter(s => {
      // 보기 모드 필터
      if (viewFilter === 'eligible_only' && !s.result.isEligible) return false;

      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchNum = s.student_number.includes(q);
        const matchMajor = s.major.toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchMajor) return false;
      }

      return true;
    });
  }, [evaluatedStudents, viewFilter, searchQuery]);

  // 통계치 계산
  const totalEligibleCount = evaluatedStudents.filter(s => s.result.isEligible).length;
  const top1Eligible = evaluatedStudents.find(s => s.result.isEligible);

  // 학과 선택 토글
  const toggleMajor = (m: string) => {
    setCriteria(prev => {
      const exists = prev.selectedMajors.includes(m);
      const next = exists
        ? prev.selectedMajors.filter(x => x !== m)
        : [...prev.selectedMajors, m];
      return { ...prev, selectedMajors: next };
    });
  };

  const selectAllMajors = () => {
    setCriteria(prev => ({ ...prev, selectedMajors: [] })); // 빈 배열 = 전체 학과
  };

  const selectKai3Majors = () => {
    setCriteria(prev => ({
      ...prev,
      selectedMajors: ['자동화기계과', '친환경자동차과', '스마트전기과'],
    }));
  };

  // 프리셋 신규 저장
  const handleSaveCurrentAsPreset = async () => {
    if (!presetFormName.trim()) {
      alert('프리셋 이름을 입력해 주세요.');
      return;
    }
    setIsSavingPreset(true);
    try {
      const res = await saveGpaPreset({
        name: presetFormName.trim(),
        description: presetFormDesc.trim(),
        criteria,
      });
      if (res.success && res.preset) {
        setPresets(prev => [...prev, res.preset!]);
        setActivePresetId(res.preset.id);
        setIsPresetModalOpen(false);
        setPresetFormName('');
        setPresetFormDesc('');
        alert(`'${res.preset.name}' 프리셋이 저장되었습니다.`);
      } else {
        alert(res.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsSavingPreset(false);
    }
  };

  // 프리셋 삭제
  const handleDeletePreset = async (preset: GpaCalculationPreset) => {
    if (preset.isSystemDefault) {
      alert('기본 제공 프리셋은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`'${preset.name}' 프리셋을 삭제하시겠습니까?`)) return;

    try {
      const res = await deleteGpaPreset(preset.id);
      if (res.success) {
        const remaining = presets.filter(p => p.id !== preset.id);
        setPresets(remaining);
        if (activePresetId === preset.id) {
          setActivePresetId(remaining[0]?.id || 'preset-kai-default');
          setCriteria({ ...(remaining[0]?.criteria || presets[0].criteria) });
        }
        alert('프리셋이 삭제되었습니다.');
      } else {
        alert(res.error || '삭제 실패');
      }
    } catch (err: any) {
      alert('오류 발생');
    }
  };

  // 학생 카드 클릭 상세 모달 열기
  const handleOpenDetailModal = (student: GradeStudentListItem, result: StudentCalculatedResult) => {
    setSelectedStudent(student);
    setSelectedStudentResult(result);
    setModalTab('all');
    setIsDetailModalOpen(true);
  };

  // KAI 전용 엑셀 다운로드 상태 및 핸들러
  const [downloadingStudentId, setDownloadingStudentId] = React.useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = React.useState<boolean>(false);

  // KAI 프리셋 여부 감지 (KAI 프리셋일 때 공식 양식 전용 모드 활성화)
  const isKaiPreset = activePreset?.name.includes('KAI') || activePresetId === 'preset-kai-default';

  // 개별 학생 KAI 공식 엑셀 다운로드 핸들러
  const handleDownloadStudentKaiExcel = async (studentId: string, studentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingStudentId(studentId);
    try {
      const res = await downloadStudentKaiExcelAction(studentId);
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        alert(res.error || 'KAI 엑셀 파일 생성에 실패했습니다.');
      }
    } catch (err: any) {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingStudentId(null);
    }
  };

  // 조건 충족 학생 KAI 엑셀 일괄 압축(ZIP) 다운로드 핸들러
  const handleDownloadBatchKaiZip = async () => {
    const eligibleStudentIds = evaluatedStudents.filter(s => s.result.isEligible).map(s => s.id);
    if (eligibleStudentIds.length === 0) {
      alert('조건을 충족한 학생이 없습니다.');
      return;
    }
    setIsBatchDownloading(true);
    try {
      const res = await downloadBatchKaiExcelZipAction(eligibleStudentIds);
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/zip',
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
        alert(res.error || '일괄 압축 파일 생성에 실패했습니다.');
      }
    } catch (err: any) {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsBatchDownloading(false);
    }
  };

  // 엑셀 다운로드
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportRows = displayedStudents.map((s, idx) => ({
        rank: idx + 1,
        studentName: s.student_name,
        major: s.major,
        classInfo: s.class_info,
        studentNumber: s.student_number,
        kemGrade: s.result.kemGrade,
        allGrade: s.result.allGrade,
        statusText: s.result.isEligible ? '★ 조건 충족' : '기준 미달',
        totalCredits: s.result.allCredits,
      }));

      const res = await downloadGradeExcelAction(activePreset?.name || '내신등급계산', exportRows);
      if (res.success && res.base64 && res.fileName) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        alert(res.error || '엑셀 다운로드 실패');
      }
    } catch (err: any) {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pt-1">
      {/* ========================================================================= */}
      {/* 1. 상단 타이틀 & 프리셋 선택/저장 바 */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between shrink-0 px-1 gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200 shrink-0">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 whitespace-nowrap">
              내신등급 계산기
            </h2>
            <span className="text-[11px] bg-blue-600 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap shrink-0">
              기업/추천 맞춤형 시뮬레이터
            </span>
          </div>

          <p className="text-xs text-slate-600 font-medium whitespace-nowrap overflow-x-auto pb-0.5">
            기업 및 채용 요강에 맞게 국영수/전과목 등급 기준, 학과, 성적 제외 규칙을 자유롭게 설정하고 학생을 즉시 선별합니다.
          </p>
        </div>

        {/* 상단 우측: 새 프리셋 저장 버튼 & 조건 패널 토글 */}
        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 whitespace-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPresetModalOpen(true)}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>현재 조건을 새 프리셋으로 저장</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPanelOpen(prev => !prev)}
            className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>{isPanelOpen ? '조건 패널 접기' : '조건 패널 열기'}</span>
            {isPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 프리셋 원클릭 칩 선택 바 */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0 pl-1">
          <Layers className="h-3.5 w-3.5 text-slate-400" />
          추천/저장 프리셋:
        </span>
        {presets.map(p => {
          const isActive = p.id === activePresetId;
          return (
            <div key={p.id} className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={cn(
                  "h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                )}
              >
                {isActive && <Check className="h-3 w-3" />}
                <span>{p.name}</span>
              </button>
              {!p.isSystemDefault && (
                <button
                  type="button"
                  onClick={() => handleDeletePreset(p)}
                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                  title="프리셋 삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. 사용자 직접 조건 설정 패널 (접기/펼치기 가능) */}
      {/* ========================================================================= */}
      {isPanelOpen && (
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-2xl overflow-hidden animate-in fade-in-50 duration-200">
          <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                  맞춤형 내신등급 자격 기준 설정
                </span>
                <span className="text-[11px] text-blue-600 font-bold bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                  현재 활성: {activePreset?.name || '직접 설정'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                조건을 변경하면 아래 학생 목록이 0초 만에 실시간 재계산됩니다.
              </div>
            </div>

            {/* 그리드: [1] 등급 컷오프 + [2] 결합조건 + [3] 학기 및 등급체계 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* [A] 국·영·수 등급 기준 */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                <label className="font-black text-slate-800 flex items-center justify-between">
                  <span>국·영·수 평균 등급 기준</span>
                  <span className="text-[11px] font-bold text-blue-600">
                    {criteria.kemCutoff !== null ? `≤ ${criteria.kemCutoff.toFixed(1)}등급 이내` : '제한 없음'}
                  </span>
                </label>
                <div className="flex items-center gap-1 flex-wrap pt-1">
                  {[null, 2.0, 2.5, 3.0, 3.5].map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setCriteria(prev => ({ ...prev, kemCutoff: v }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                        criteria.kemCutoff === v
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {v === null ? '전체' : `${v.toFixed(1)}이내`}
                    </button>
                  ))}
                </div>
              </div>

              {/* [B] 전과목 평균 등급 기준 */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                <label className="font-black text-slate-800 flex items-center justify-between">
                  <span>전과목 평균 등급 기준</span>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {criteria.allCutoff !== null ? `≤ ${criteria.allCutoff.toFixed(1)}등급 이내` : '제한 없음'}
                  </span>
                </label>
                <div className="flex items-center gap-1 flex-wrap pt-1">
                  {[null, 2.0, 2.5, 3.0, 3.5].map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setCriteria(prev => ({ ...prev, allCutoff: v }))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                        criteria.allCutoff === v
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {v === null ? '전체' : `${v.toFixed(1)}이내`}
                    </button>
                  ))}
                </div>
              </div>

              {/* [C] 조건 결합 방식 (AND / OR) */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/80">
                <label className="font-black text-slate-800">조건 결합 방식</label>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, conditionLogic: 'AND' }))}
                    className={cn(
                      "py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                      criteria.conditionLogic === 'AND'
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>둘 다 충족 (AND)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, conditionLogic: 'OR' }))}
                    className={cn(
                      "py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1",
                      criteria.conditionLogic === 'OR'
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>하나라도 충족 (OR)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 대상 학과 선택 체크박스 바 */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-black text-slate-800">
                  대상 학과 선택 ({criteria.selectedMajors.length === 0 ? '전체 학과 대상' : `${criteria.selectedMajors.length}개 학과 선택됨`})
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllMajors}
                    className="text-[11px] font-bold text-blue-600 hover:underline px-1"
                  >
                    전체 학과
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={selectKai3Majors}
                    className="text-[11px] font-bold text-slate-600 hover:underline px-1"
                  >
                    KAI 지원 3개 학과 (기계·자동차·전기)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {availableMajors.map(m => {
                  const isSelected = criteria.selectedMajors.length === 0 || criteria.selectedMajors.includes(m);
                  return (
                    <label
                      key={m}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all",
                        isSelected
                          ? "bg-blue-50 border-blue-400 text-blue-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMajor(m)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>{m}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 성적 산출 및 과목 제외 규칙 (가로 1줄 정돈) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-4 flex-wrap text-slate-800">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={criteria.excludeArts}
                    onChange={e => setCriteria(prev => ({ ...prev, excludeArts: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>예체능 제외</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={criteria.excludeSecondLang}
                    onChange={e => setCriteria(prev => ({ ...prev, excludeSecondLang: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>제2외국어/한문 제외</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={criteria.excludePF}
                    onChange={e => setCriteria(prev => ({ ...prev, excludePF: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>P/F 제외</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={criteria.preferRankGrade}
                    onChange={e => setCriteria(prev => ({ ...prev, preferRankGrade: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>기존 석차등급 우선 적용</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                {/* 5개 학기 vs 전학기 */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, targetSemesters: 'five_semesters' }))}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
                      criteria.targetSemesters === 'five_semesters'
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    5개 학기 (1-1~3-1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, targetSemesters: 'all_semesters' }))}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
                      criteria.targetSemesters === 'all_semesters'
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    전체 학기
                  </button>
                </div>

                {/* 9등급제 vs 5등급제 */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, gradeScale: '9_scale' }))}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
                      criteria.gradeScale === '9_scale'
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    9등급제
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriteria(prev => ({ ...prev, gradeScale: '5_scale' }))}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold transition-all",
                      criteria.gradeScale === '5_scale'
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    5등급제
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 4. 통계 KPI 요약 카드 3종 (줄바꿈 없이 1줄 정돈) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
        {/* 카드 1: 조건 충족 학생 수 */}
        <Card className="border-blue-200/80 shadow-2xs rounded-2xl bg-gradient-to-br from-blue-50/40 via-white to-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-blue-800 whitespace-nowrap">조건 충족 학생</p>
              <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-2xl font-black text-blue-600">{totalEligibleCount}</span>
                <span className="text-xs font-bold text-slate-400">/ {evaluatedStudents.length}명 통과</span>
              </div>
              <p className="text-[10.5px] text-blue-700 font-medium whitespace-nowrap">
                선발 통과율: {evaluatedStudents.length > 0 ? ((totalEligibleCount / evaluatedStudents.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 🥇 1위 최고 성적 학생 */}
        <Card className="border-amber-200/80 shadow-2xs rounded-2xl bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">🥇 조건 충족 1위 우수 학생</p>
              <div className="flex items-baseline gap-1.5 whitespace-nowrap truncate">
                <span className="text-xl font-black text-slate-900">
                  {top1Eligible ? top1Eligible.student_name : '-'}
                </span>
                <span className="text-xs font-bold text-slate-500 truncate">
                  ({top1Eligible ? `${top1Eligible.major} ${top1Eligible.class_info}반` : ''})
                </span>
              </div>
              <p className="text-[10.5px] text-amber-700 font-bold whitespace-nowrap">
                전과목 {top1Eligible?.result.allGrade?.toFixed(2)}등급 · 국영수 {top1Eligible?.result.kemGrade?.toFixed(2)}등급
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 적용 중인 프리셋 요약 */}
        <Card className="border-slate-200/80 shadow-2xs rounded-2xl bg-white">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">현재 적용 기준</p>
              <div className="text-sm font-black text-slate-900 truncate whitespace-nowrap">
                {activePreset?.name || '사용자 맞춤 설정'}
              </div>
              <p className="text-[10.5px] text-slate-500 whitespace-nowrap truncate">
                국영수 {criteria.kemCutoff ? `≤${criteria.kemCutoff}` : '전체'} · 전과목 {criteria.allCutoff ? `≤${criteria.allCutoff}` : '전체'} ({criteria.conditionLogic})
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shrink-0">
              <Filter className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 5. 툴바: 보기 모드 전환 + 정렬 + 검색 + 엑셀 내보내기 */}
      {/* ========================================================================= */}
      <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0 overflow-hidden">
        <CardContent className="p-3 flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            {/* 보기 모드: 조건 충족자만 보기 vs 전체 학생 보기 */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setViewFilter('eligible_only')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                  viewFilter === 'eligible_only'
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Check className="h-3 w-3" />
                <span>조건 충족 학생만 보기 ({totalEligibleCount}명)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  viewFilter === 'all'
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                전체 학생 보기 ({evaluatedStudents.length}명)
              </button>
            </div>

            {/* 정렬 셀렉트 */}
            <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
              <SelectTrigger className="w-[170px] h-8 text-xs font-bold rounded-xl border-slate-200 bg-slate-50/60 whitespace-nowrap shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl whitespace-nowrap">
                <SelectItem value="combined" className="text-xs font-bold">
                  전과목+국영수 합산 우수순
                </SelectItem>
                <SelectItem value="all" className="text-xs font-bold">
                  전과목 등급 우수순
                </SelectItem>
                <SelectItem value="kem" className="text-xs font-bold">
                  국영수 등급 우수순
                </SelectItem>
                <SelectItem value="studentNumber" className="text-xs font-medium">
                  학번/번호 순
                </SelectItem>
              </SelectContent>
            </Select>

            {/* 검색창 */}
            <div className="relative w-[130px] sm:w-[160px] shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="이름/번호/학과 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs font-medium rounded-xl border-slate-200 whitespace-nowrap"
              />
            </div>
          </div>

          {/* 우측: 엑셀 다운로드 */}
          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            {isKaiPreset && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBatchDownloading}
                onClick={handleDownloadBatchKaiZip}
                className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                title="조건 충족 학생들의 KAI 공식 엑셀 파일들을 ZIP으로 일괄 다운로드"
              >
                {isBatchDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5 text-blue-600" />
                )}
                <span>KAI 엑셀 일괄 다운 ({totalEligibleCount}명 ZIP)</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={handleExportExcel}
              className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isExporting ? '생성 중...' : '선발 결과표 다운로드 (.xlsx)'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* 6. 카드 그리드: 가로형 직관적인 학생 카드 나열 */}
      {/* ========================================================================= */}
      {displayedStudents.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 rounded-2xl bg-slate-50/50">
          <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-600">조건에 부합하는 학생이 없습니다.</p>
          <p className="text-xs text-slate-400 mt-1">
            상단 조건 설정 패널에서 등급 기준을 완화하거나 대상 학과를 추가해 보세요.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-in fade-in duration-200">
          {displayedStudents.map((s, idx) => {
            const rank = idx + 1;
            const res = s.result;
            const isEligible = res.isEligible;

            return (
              <div
                key={s.id}
                onClick={() => handleOpenDetailModal(s, res)}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group hover:shadow-md",
                  isEligible
                    ? "bg-white border-blue-200/90 hover:border-blue-400"
                    : "bg-slate-50/70 border-slate-200 opacity-60 hover:opacity-100"
                )}
              >
                {/* 상단 1행: 순위 + 이름 + 학과/반 + 선발 뱃지 */}
                <div className="flex items-center justify-between whitespace-nowrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "font-mono text-xs font-black px-2 py-0.5 rounded-lg shrink-0",
                      rank === 1 ? "bg-amber-100 text-amber-800" : rank === 2 ? "bg-slate-200 text-slate-800" : rank === 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                    </span>
                    <span className="font-black text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      {s.student_name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium truncate">
                      {s.major} · {s.class_info}반 {s.student_number}번
                    </span>
                  </div>

                  {/* 선발 상태 뱃지 */}
                  <span className={cn(
                    "text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-2xs flex items-center gap-1",
                    isEligible
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-200 text-slate-600"
                  )}>
                    {isEligible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {isEligible ? '조건 충족' : '기준 미달'}
                  </span>
                </div>

                {/* 중단 2행: 전과목 등급 & 국영수 등급 (핵심 2대 지표) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  {/* 국영수 평균 등급 */}
                  <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col">
                    <span className="text-[10px] font-bold text-blue-700">국·영·수 평균</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-mono text-base font-black text-blue-900">
                        {res.kemGrade !== null ? `${res.kemGrade.toFixed(2)}등급` : '-'}
                      </span>
                      <span className="text-[10px] text-blue-600 font-mono">
                        {res.kemCredits}단위
                      </span>
                    </div>
                  </div>

                  {/* 전과목 평균 등급 */}
                  <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-700">전과목 평균</span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-mono text-base font-black text-indigo-900">
                        {res.allGrade !== null ? `${res.allGrade.toFixed(2)}등급` : '-'}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-mono">
                        {res.allCredits}단위
                      </span>
                    </div>
                  </div>
                </div>

                {/* 하단 3행: 클릭 안내 및 KAI 엑셀 다운로드 */}
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-medium pt-1 border-t border-slate-100/80">
                  {isKaiPreset ? (
                    <button
                      type="button"
                      disabled={downloadingStudentId === s.id}
                      onClick={(e) => handleDownloadStudentKaiExcel(s.id, s.student_name, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      title="한국항공우주산업(KAI) 공식 엑셀 서식 파일 다운로드"
                    >
                      {downloadingStudentId === s.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3 w-3 text-blue-600" />
                      )}
                      <span>KAI 서식 다운</span>
                    </button>
                  ) : (
                    <span>과목별 성적 및 이수단위</span>
                  )}
                  <span className="group-hover:translate-x-0.5 transition-transform text-blue-600 font-bold flex items-center gap-0.5">
                    상세 성적표 보기 &gt;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. 모달: [새 프리셋으로 저장] 다이얼로그 */}
      {/* ========================================================================= */}
      <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl bg-white border-none shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Save className="h-5 w-5 text-blue-600" />
              <span>현재 조건을 새 프리셋으로 저장</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              현재 설정된 국영수/전과목 컷오프, 학과 선택, 과목 제외 규칙을 나만의 프리셋으로 저장합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">프리셋 이름 *</label>
              <Input
                placeholder="예: 2026 현대자동차 생산직, 한수원 추천"
                value={presetFormName}
                onChange={e => setPresetFormName(e.target.value)}
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">메모 / 설명</label>
              <Input
                placeholder="예: 전과목 3.0 이내, 공업계열 3개 학과 대상"
                value={presetFormDesc}
                onChange={e => setPresetFormDesc(e.target.value)}
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            {/* 현재 저장될 조건 요약 미리보기 */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px] text-slate-600">
              <div className="font-bold text-slate-800">저장될 조건 요약:</div>
              <p>• 국·영·수 컷오프: {criteria.kemCutoff ? `≤ ${criteria.kemCutoff}등급` : '제한 없음'}</p>
              <p>• 전과목 컷오프: {criteria.allCutoff ? `≤ ${criteria.allCutoff}등급` : '제한 없음'} ({criteria.conditionLogic})</p>
              <p>• 대상 학과: {criteria.selectedMajors.length === 0 ? '전체 학과' : criteria.selectedMajors.join(', ')}</p>
              <p>• 등급 체계: {criteria.gradeScale === '9_scale' ? '9등급제' : '5등급제'} (석차등급 우선: {criteria.preferRankGrade ? '적용' : '미적용'})</p>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPresetModalOpen(false)}
              className="h-8 text-xs font-bold rounded-lg"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingPreset || !presetFormName.trim()}
              onClick={handleSaveCurrentAsPreset}
              className="h-8 px-4 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSavingPreset ? '저장 중...' : '프리셋 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. 모달: 학생 1인의 학기별 상세 성적표 뷰어 */}
      {/* ========================================================================= */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
          {selectedStudent && selectedStudentResult && (
            <>
              <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-base sm:text-lg font-black text-slate-900">
                        {selectedStudent.student_name}
                      </DialogTitle>
                      <span className="text-xs text-slate-500 font-mono">
                        {selectedStudent.major} · {selectedStudent.class_info}반 {selectedStudent.student_number}번
                      </span>
                    </div>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      적용 기준: {activePreset?.name || '맞춤 설정'} (국영수: {selectedStudentResult.kemGrade?.toFixed(2)}등급 / 전과목: {selectedStudentResult.allGrade?.toFixed(2)}등급)
                    </DialogDescription>
                  </div>
                </div>

                <span className={cn(
                  "text-xs font-black px-3 py-1 rounded-full shrink-0 shadow-2xs flex items-center gap-1",
                  selectedStudentResult.isEligible
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                )}>
                  {selectedStudentResult.isEligible ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {selectedStudentResult.isEligible ? '★ 추천/지원 조건 충족' : '기준 미달'}
                </span>
              </DialogHeader>

              {/* 모달 탭 바 */}
              <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => setModalTab('all')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all",
                    modalTab === 'all'
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  전체 반영 과목 ({selectedStudentResult.allCredits}학점)
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('kem')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all",
                    modalTab === 'kem'
                      ? "bg-white text-blue-700 shadow-2xs border border-blue-200"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  국·영·수 과목만 ({selectedStudentResult.kemCredits}학점)
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('excluded')}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all",
                    modalTab === 'excluded'
                      ? "bg-white text-rose-700 shadow-2xs border border-rose-200"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  제외된 과목 보기
                </button>
              </div>

              {/* 학기별 성적 테이블 본문 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {selectedStudentResult.semestersBreakdown.map(sem => {
                  const filteredRows = sem.rows.filter((r: any) => {
                    if (modalTab === 'all') return !r.isExcluded;
                    if (modalTab === 'kem') return !r.isExcluded && r.isKEM;
                    if (modalTab === 'excluded') return r.isExcluded;
                    return true;
                  });

                  if (filteredRows.length === 0) return null;

                  return (
                    <div key={sem.label} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3.5 py-2 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                        <span>{sem.label}</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          {filteredRows.length}개 과목
                        </span>
                      </div>
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100 text-[11px]">
                          <tr>
                            <th className="py-2 px-3">과목명</th>
                            <th className="py-2 px-2 text-center w-16">학점(단위)</th>
                            <th className="py-2 px-2 text-center w-20">원성취도/석차</th>
                            <th className="py-2 px-2 text-center w-20">환산 등급</th>
                            <th className="py-2 px-3 text-center w-24">상태 / 제외사유</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRows.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {r.subject}
                                {r.isKEM && (
                                  <span className="ml-1.5 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                                    국영수
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-700">
                                {r.credits}
                              </td>
                              <td className="py-2 px-2 text-center font-mono text-slate-600">
                                {r.originalAchievement || '-'}{r.originalRankGrade ? ` (${r.originalRankGrade}등급)` : ''}
                              </td>
                              <td className="py-2 px-2 text-center font-mono font-black text-blue-700">
                                {r.rankGrade !== null ? `${r.rankGrade}등급` : '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {r.isExcluded ? (
                                  <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                                    {r.excludeReason}
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                    반영
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {isKaiPreset && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={downloadingStudentId === selectedStudent.id}
                      onClick={() => handleDownloadStudentKaiExcel(selectedStudent.id, selectedStudent.student_name)}
                      className="h-8 px-3.5 text-xs font-bold gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
                    >
                      {downloadingStudentId === selectedStudent.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      )}
                      <span>KAI 공식 서식 엑셀 다운로드 (.xlsx)</span>
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="h-8 text-xs font-bold rounded-lg border-slate-200"
                >
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
