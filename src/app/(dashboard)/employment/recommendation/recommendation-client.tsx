'use client';

// ==============================================================================
// src/app/(dashboard)/employment/recommendation/recommendation-client.tsx
// 학교장추천대상자 선정 시스템 클라이언트 허브
// (배점: NCS 30점 + 교과성적 30점 + 옥저인재인증 30점 + 면접 10점 = 100점 만점)
// (성적 기준: 9등급제/5등급제 선택, 기존 석차등급 우선 적용, 예체능/외국어 제외)
// ==============================================================================

import * as React from 'react';
import { 
  RecommendationSession, 
  CandidateScoreRecord,
  GradeExclusionRules,
  saveRecommendationSession,
  deleteRecommendationSession,
  getAvailableStudentsForRecommendation,
  addCandidatesToSession,
  removeCandidateFromSession,
  bulkSaveCandidateScores,
  recalculateSessionScoresAction,
  exportRecommendationExcelAction
} from './actions';

const DEFAULT_GRADE_RULES: GradeExclusionRules = {
  excludeArts: true,
  excludeSecondLang: true,
  excludePF: true,
  subjectGroup: 'all',
  targetSemesters: 'five_semesters',
  gradeScale: '9_scale',
  preferRankGrade: true
};

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
  DialogFooter
} from '@/components/ui/dialog';
import {
  Award,
  Trophy,
  Users,
  Target,
  Plus,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Loader2,
  FileSpreadsheet,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Edit3,
  Calendar,
  Save,
  UserPlus,
  RefreshCw,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecommendationClientProps {
  initialSessions: RecommendationSession[];
}

export function RecommendationClient({ initialSessions }: RecommendationClientProps) {
  const [sessions, setSessions] = React.useState<RecommendationSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    initialSessions[0]?.id || ''
  );

  // 현재 선택된 세션
  const currentSession = React.useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  // 후보자 목록 로컬 상태 (인라인 점수 수정용)
  const [candidatesMap, setCandidatesMap] = React.useState<Record<string, CandidateScoreRecord>>(
    currentSession?.candidates || {}
  );

  // 세션 변경 시 로컬 후보자 맵 동기화
  React.useEffect(() => {
    if (currentSession) {
      setCandidatesMap(currentSession.candidates || {});
    } else {
      setCandidatesMap({});
    }
  }, [currentSession]);

  // 필터 상태
  const [majorFilter, setMajorFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'selected' | 'wait'>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  // 비동기 작업 상태
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [isRecalculating, setIsRecalculating] = React.useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState<boolean>(false);

  // 세션 등록/수정 모달 상태
  const [isSessionModalOpen, setIsSessionModalOpen] = React.useState<boolean>(false);
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [sessionFormTitle, setSessionFormTitle] = React.useState<string>('');
  const [sessionFormQuota, setSessionFormQuota] = React.useState<number>(5);
  const [sessionFormGrade, setSessionFormGrade] = React.useState<number>(3);
  const [sessionFormDesc, setSessionFormDesc] = React.useState<string>('');

  // 세션 성적 산출 규칙 폼 상태 (9등급제/5등급제, 석차등급우선, 제외규칙)
  const [sessionFormGradeScale, setSessionFormGradeScale] = React.useState<'9_scale' | '5_scale'>('9_scale');
  const [sessionFormPreferRankGrade, setSessionFormPreferRankGrade] = React.useState<boolean>(true);
  const [sessionFormExcludeArts, setSessionFormExcludeArts] = React.useState<boolean>(true);
  const [sessionFormExcludeSecondLang, setSessionFormExcludeSecondLang] = React.useState<boolean>(true);
  const [sessionFormExcludePF, setSessionFormExcludePF] = React.useState<boolean>(true);
  const [sessionFormSubjectGroup, setSessionFormSubjectGroup] = React.useState<'all' | 'kem' | 'general' | 'vocational'>('all');
  const [sessionFormTargetSemesters, setSessionFormTargetSemesters] = React.useState<'five_semesters' | 'all_semesters'>('five_semesters');

  // 학생 추가 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = React.useState<boolean>(false);
  const [availableStudents, setAvailableStudents] = React.useState<any[]>([]);
  const [addModalSearch, setAddModalSearch] = React.useState<string>('');
  const [addModalMajor, setAddModalMajor] = React.useState<string>('all');
  const [selectedToAddIds, setSelectedToAddIds] = React.useState<Set<string>>(new Set());
  const [isLoadingStudents, setIsLoadingStudents] = React.useState<boolean>(false);
  const [isAddingCandidates, setIsAddingCandidates] = React.useState<boolean>(false);

  // 사용 가능한 고유 학과 목록
  const availableMajors = React.useMemo(() => {
    const list = Object.values(candidatesMap).map(c => c.major);
    return Array.from(new Set(list)).filter(Boolean).sort();
  }, [candidatesMap]);

  // 실시간 랭킹 산정 및 정렬된 후보자 목록
  const sortedCandidates = React.useMemo(() => {
    const list = Object.values(candidatesMap);

    // 총점 기준 내림차순(높은 점수 1위) 정렬
    // 동점자 처리: 1순위 NCS 점수 우수자, 2순위 교과성적 우수자, 3순위 옥저인증 우수자
    list.sort((a, b) => {
      const tA = a.totalScore ?? -1;
      const tB = b.totalScore ?? -1;
      if (tB !== tA) return tB - tA;

      const nA = a.ncsScore ?? -1;
      const nB = b.ncsScore ?? -1;
      if (nB !== nA) return nB - nA;

      const sA = a.schoolScoreConverted ?? -1;
      const sB = b.schoolScoreConverted ?? -1;
      if (sB !== sA) return sB - sA;

      const cA = a.certScoreConverted ?? -1;
      const cB = b.certScoreConverted ?? -1;
      return cB - cA;
    });

    const quota = currentSession?.recommendationQuota || 5;

    // 필터링 적용
    return list.filter((c, idx) => {
      const rank = idx + 1;
      const isSelected = rank <= quota;

      if (majorFilter !== 'all' && c.major !== majorFilter) return false;
      if (statusFilter === 'selected' && !isSelected) return false;
      if (statusFilter === 'wait' && isSelected) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = c.studentName.toLowerCase().includes(q);
        const matchNum = c.studentNumber?.includes(q);
        if (!matchName && !matchNum) return false;
      }

      return true;
    });
  }, [candidatesMap, currentSession, majorFilter, statusFilter, searchTerm]);

  // 상위권 통계치
  const quota = currentSession?.recommendationQuota || 5;
  const totalCandidatesCount = Object.keys(candidatesMap).length;
  const top1Candidate = Object.values(candidatesMap).sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))[0];

  // 인라인 점수 변경 핸들러
  const handleScoreChange = (
    studentId: string, 
    field: 'ncsScore' | 'interviewScore' | 'remarks', 
    val: string
  ) => {
    setCandidatesMap(prev => {
      const target = prev[studentId];
      if (!target) return prev;

      let newNcs = target.ncsScore;
      let newInterview = target.interviewScore;
      let newRemarks = target.remarks;

      if (field === 'ncsScore') {
        if (val === '') {
          newNcs = null;
        } else {
          const num = parseFloat(val);
          newNcs = isNaN(num) ? null : Math.min(30, Math.max(0, num));
        }
      } else if (field === 'interviewScore') {
        if (val === '') {
          newInterview = null;
        } else {
          const num = parseFloat(val);
          newInterview = isNaN(num) ? null : Math.min(10, Math.max(0, num));
        }
      } else if (field === 'remarks') {
        newRemarks = val;
      }

      const schoolConv = target.schoolScoreConverted || 0;
      const certConv = target.certScoreConverted || 0;
      const ncsVal = newNcs || 0;
      const intVal = newInterview || 0;

      const totalScore = (newNcs !== null || newInterview !== null || schoolConv > 0 || certConv > 0)
        ? parseFloat((ncsVal + schoolConv + certConv + intVal).toFixed(2))
        : null;

      setHasUnsavedChanges(true);

      return {
        ...prev,
        [studentId]: {
          ...target,
          ncsScore: newNcs,
          interviewScore: newInterview,
          totalScore,
          remarks: newRemarks
        }
      };
    });
  };

  // 점수 일괄 저장 핸들러
  const handleSaveAll = async () => {
    if (!currentSession) return;
    setIsSaving(true);
    try {
      const updates = Object.values(candidatesMap).map(c => ({
        studentId: c.studentId,
        ncsScore: c.ncsScore,
        interviewScore: c.interviewScore,
        remarks: c.remarks
      }));

      const res = await bulkSaveCandidateScores(currentSession.id, updates);
      if (res.success && res.session) {
        setSessions(prev => prev.map(s => s.id === res.session!.id ? res.session! : s));
        setHasUnsavedChanges(false);
        alert('모든 점수와 변경사항이 성공적으로 저장되었습니다.');
      } else {
        alert(res.error || '저장에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 성적 재계산 핸들러
  const handleRecalculateScores = async () => {
    if (!currentSession) return;
    setIsRecalculating(true);
    try {
      const res = await recalculateSessionScoresAction(currentSession.id);
      if (res.success && res.session) {
        setSessions(prev => prev.map(s => s.id === res.session!.id ? res.session! : s));
        setCandidatesMap(res.session.candidates || {});
        alert('공고의 성적 기준(등급제/석차등급우선/제외규칙)에 맞춰 모든 후보자의 성적(30점)이 재계산되었습니다.');
      } else {
        alert(res.error || '재계산에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Recalculate error:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // 후보 학생 삭제 핸들러
  const handleRemoveCandidate = async (studentId: string, studentName: string) => {
    if (!confirm(`'${studentName}' 학생을 추천 후보자 목록에서 제외하시겠습니까?`)) return;
    if (!currentSession) return;

    try {
      const res = await removeCandidateFromSession(currentSession.id, studentId);
      if (res.success && res.session) {
        setSessions(prev => prev.map(s => s.id === res.session!.id ? res.session! : s));
        setCandidatesMap(res.session.candidates || {});
      } else {
        alert(res.error || '후보자 제외에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Remove error:', err);
      alert('오류가 발생했습니다.');
    }
  };

  // 세션 삭제 핸들러
  const handleDeleteCurrentSession = async () => {
    if (!currentSession) return;
    if (!confirm(`'${currentSession.title}' 선발 공고를 삭제하시겠습니까?\n등록된 지원자 명단 및 심사 점수 데이터도 함께 삭제됩니다.`)) return;

    try {
      const res = await deleteRecommendationSession(currentSession.id);
      if (res.success) {
        const remaining = sessions.filter(s => s.id !== currentSession.id);
        setSessions(remaining);
        setSelectedSessionId(remaining[0]?.id || '');
        alert('선발 공고가 삭제되었습니다.');
      } else {
        alert(res.error || '삭제에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Delete session error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 엑셀 내보내기 핸들러
  const handleExportExcel = async () => {
    if (!currentSession) return;
    setIsExporting(true);
    try {
      const res = await exportRecommendationExcelAction(currentSession.id);
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
        alert(res.error || '엑셀 파일 생성에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  // 학생 추가 모달 열기
  const openAddModal = async () => {
    if (!currentSession) {
      alert('먼저 선발 공고를 등록하거나 선택해 주세요.');
      return;
    }
    setIsAddModalOpen(true);
    setSelectedToAddIds(new Set());
    setIsLoadingStudents(true);
    try {
      const students = await getAvailableStudentsForRecommendation(currentSession?.targetGrade || 3);
      setAvailableStudents(students);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // 후보자 추가 실행
  const handleAddSelectedStudents = async () => {
    if (selectedToAddIds.size === 0 || !currentSession) return;
    setIsAddingCandidates(true);
    try {
      const ids = Array.from(selectedToAddIds);
      const res = await addCandidatesToSession(currentSession.id, ids);
      if (res.success && res.session) {
        setSessions(prev => prev.map(s => s.id === res.session!.id ? res.session! : s));
        setCandidatesMap(res.session.candidates || {});
        setIsAddModalOpen(false);
        alert(`${ids.length}명의 희망 학생이 추가되었으며, 공고의 성적 기준(등급제/석차등급우선/제외규칙)에 따라 30점 만점으로 자동 환산되었습니다.`);
      } else {
        alert(res.error || '학생 추가에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Add error:', err);
      alert('학생 추가 중 오류가 발생했습니다.');
    } finally {
      setIsAddingCandidates(false);
    }
  };

  // 새 공고 모달 열기
  const openNewSessionModal = () => {
    setEditingSessionId(null);
    setSessionFormTitle('');
    setSessionFormQuota(5);
    setSessionFormGrade(3);
    setSessionFormDesc('');
    setSessionFormGradeScale('9_scale');
    setSessionFormPreferRankGrade(true);
    setSessionFormExcludeArts(true);
    setSessionFormExcludeSecondLang(true);
    setSessionFormExcludePF(true);
    setSessionFormSubjectGroup('all');
    setSessionFormTargetSemesters('five_semesters');
    setIsSessionModalOpen(true);
  };

  // 공고 수정 모달 열기
  const openEditSessionModal = () => {
    if (!currentSession) return;
    setEditingSessionId(currentSession.id);
    setSessionFormTitle(currentSession.title);
    setSessionFormQuota(currentSession.recommendationQuota || 5);
    setSessionFormGrade(currentSession.targetGrade || 3);
    setSessionFormDesc(currentSession.description || '');

    const rules = currentSession.gradeRules || DEFAULT_GRADE_RULES;
    setSessionFormGradeScale(rules.gradeScale || '9_scale');
    setSessionFormPreferRankGrade(rules.preferRankGrade ?? true);
    setSessionFormExcludeArts(rules.excludeArts ?? true);
    setSessionFormExcludeSecondLang(rules.excludeSecondLang ?? true);
    setSessionFormExcludePF(rules.excludePF ?? true);
    setSessionFormSubjectGroup(rules.subjectGroup || 'all');
    setSessionFormTargetSemesters(rules.targetSemesters || 'five_semesters');

    setIsSessionModalOpen(true);
  };

  // 세션 등록/수정 저장
  const handleSaveSession = async () => {
    if (!sessionFormTitle.trim()) {
      alert('선발 공고명을 입력해 주세요.');
      return;
    }
    try {
      const gradeRules: GradeExclusionRules = {
        gradeScale: sessionFormGradeScale,
        preferRankGrade: sessionFormPreferRankGrade,
        excludeArts: sessionFormExcludeArts,
        excludeSecondLang: sessionFormExcludeSecondLang,
        excludePF: sessionFormExcludePF,
        subjectGroup: sessionFormSubjectGroup,
        targetSemesters: sessionFormTargetSemesters
      };

      const res = await saveRecommendationSession({
        id: editingSessionId || undefined,
        title: sessionFormTitle.trim(),
        recommendationQuota: sessionFormQuota,
        targetGrade: sessionFormGrade,
        description: sessionFormDesc,
        gradeRules
      });

      if (res.success && res.session) {
        if (editingSessionId) {
          setSessions(prev => prev.map(s => s.id === res.session!.id ? res.session! : s));
          setCandidatesMap(res.session.candidates || {});
        } else {
          setSessions(prev => [res.session!, ...prev]);
          setSelectedSessionId(res.session.id);
        }
        setIsSessionModalOpen(false);
        alert(editingSessionId 
          ? '공고 정보 및 성적 산출 기준이 저장되었으며, 후보자 성적이 재계산되었습니다.' 
          : '새 추천 선발 공고가 등록되었습니다.'
        );
      } else {
        alert(res.error || '공고 저장에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Session save error:', err);
      alert('오류가 발생했습니다.');
    }
  };

  // 필터링된 추가 모달 학생 리스트
  const filteredAvailableStudents = React.useMemo(() => {
    return availableStudents.filter(s => {
      if (candidatesMap[s.id]) return false;

      if (addModalMajor !== 'all' && s.major !== addModalMajor) return false;
      if (addModalSearch.trim()) {
        const q = addModalSearch.trim().toLowerCase();
        const matchName = s.student_name.toLowerCase().includes(q);
        const matchNum = s.student_number?.includes(q);
        if (!matchName && !matchNum) return false;
      }
      return true;
    });
  }, [availableStudents, candidatesMap, addModalMajor, addModalSearch]);

  const toggleSelectStudent = (id: string) => {
    setSelectedToAddIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedToAddIds.size === filteredAvailableStudents.length) {
      setSelectedToAddIds(new Set());
    } else {
      setSelectedToAddIds(new Set(filteredAvailableStudents.map(s => s.id)));
    }
  };

  const currentRules = currentSession?.gradeRules || DEFAULT_GRADE_RULES;
  const isCurrent9Scale = currentRules.gradeScale !== '5_scale';

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full pt-1">
      {/* ========================================================================= */}
      {/* 1. 제목줄: 상단 타이틀 헤더 및 선발 공고(세션) 선택기 */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between shrink-0 px-1 gap-3 print:hidden">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200 shrink-0">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 whitespace-nowrap">
              학교장 추천 대상자 선정 시스템
            </h2>
            <span className="text-[11px] bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-black whitespace-nowrap shrink-0">
              공식 추천 심사 채점표
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-600 font-medium whitespace-nowrap overflow-x-auto pb-0.5">
            <span className="text-slate-500 font-bold shrink-0">선발 기준:</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shrink-0">
              NCS 시험 30점
            </span>
            <span className="text-slate-400">+</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
              교과성적 30점 ({isCurrent9Scale ? '9등급제' : '5등급제'})
            </span>
            <span className="text-slate-400">+</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 shrink-0">
              옥저인재인증 30점
            </span>
            <span className="text-slate-400">+</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shrink-0">
              면접점수 10점
            </span>
            <span className="font-black text-slate-900 shrink-0">= 총 100점 만점</span>
          </div>
        </div>

        {/* 상단 우측: 선발 공고 셀렉트 및 공고 등록/수정/삭제 버튼 */}
        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 whitespace-nowrap">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs shrink-0">
              <span className="text-xs font-bold text-slate-500 pl-2 shrink-0">선발 공고:</span>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-black text-slate-900 min-w-[200px] sm:min-w-[260px] whitespace-nowrap">
                  <SelectValue placeholder="선발 공고 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-slate-200 max-h-72 whitespace-nowrap">
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs font-medium py-2 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{s.title}</span>
                      <span className="ml-1.5 text-slate-400 text-[11px] font-mono">
                        (추천 {s.recommendationQuota}명 / 대상 {Object.keys(s.candidates || {}).length}명)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 공고 수정 버튼 */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={openEditSessionModal}
                className="h-7 w-7 text-slate-400 hover:text-slate-700 rounded-lg shrink-0"
                title="선발 공고 및 성적 기준 수정"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>

              {/* 공고 삭제 버튼 */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleDeleteCurrentSession}
                className="h-7 w-7 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                title="선발 공고 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <Button
            type="button"
            onClick={openNewSessionModal}
            className="h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>새 추천 선발 등록</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 선발 공고가 0개일 때의 초대형 안내 카드 (Empty State) */}
      {/* ========================================================================= */}
      {sessions.length === 0 ? (
        <Card className="p-12 sm:p-16 text-center border-dashed border-2 border-slate-200 rounded-3xl bg-slate-50/50 shadow-2xs mt-2">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-16 w-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-amber-200">
              <Trophy className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 whitespace-nowrap">
                등록된 추천 선발 공고가 없습니다
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                기업체 또는 공공기관의 채용 선발 공고(예: KAI, 한국전력, 지역인재 9급 등)를 새로 등록하여 학교장추천대상자 심사를 시작하세요.
              </p>
            </div>
            <Button
              type="button"
              onClick={openNewSessionModal}
              className="h-10 px-5 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>새 추천 선발 공고 등록하기</span>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 2. 통계: 4종 핵심 요약 KPI 카드 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 animate-in fade-in duration-200 print:hidden">
            {/* 카드 1: 추천 선발 인원 (TO) */}
            <Card className="border-amber-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-gradient-to-br from-amber-50/40 via-white to-white">
              <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-amber-800 whitespace-nowrap">추천 선발 정원 (TO)</p>
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-2xl sm:text-3xl font-black text-amber-600">
                      {quota}
                    </span>
                    <span className="text-xs font-bold text-slate-400">명 선발</span>
                  </div>
                  <p className="text-[10.5px] text-amber-700 font-medium whitespace-nowrap truncate">
                    상위 1~{quota}위 학생 추천 대상 확정
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-400 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <Target className="h-5 w-5 text-white" />
                </div>
              </CardContent>
            </Card>

            {/* 카드 2: 지원 희망 학생 수 */}
            <Card className="border-blue-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
              <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-blue-800 whitespace-nowrap">지원 희망자 (심사 풀)</p>
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-2xl sm:text-3xl font-black text-blue-600">
                      {totalCandidatesCount}
                    </span>
                    <span className="text-xs font-bold text-slate-400">명 등록</span>
                  </div>
                  <p className="text-[10.5px] text-blue-600 font-medium whitespace-nowrap">
                    경쟁률 {totalCandidatesCount > 0 ? (totalCandidatesCount / quota).toFixed(1) : 0} : 1
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* 카드 3: 🥇 종합 1위 최고 득점자 */}
            <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
              <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-slate-500 whitespace-nowrap">🥇 종합 1위 최고 득점자</p>
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap truncate">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {top1Candidate ? top1Candidate.studentName : '-'}
                    </span>
                    <span className="text-xs font-bold text-slate-500 truncate">
                      ({top1Candidate ? `${top1Candidate.major} ${top1Candidate.classInfo}반` : ''})
                    </span>
                  </div>
                  <p className="text-[10.5px] text-blue-700 font-bold whitespace-nowrap">
                    종합 {top1Candidate?.totalScore !== null ? `${top1Candidate?.totalScore}점` : '-'} / 100점
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 shrink-0">
                  <Trophy className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* 카드 4: 배점 체계 안내 */}
            <Card className="border-slate-200/80 shadow-2xs hover:shadow-sm transition-all rounded-2xl bg-white">
              <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-slate-500 whitespace-nowrap">배점 항목 구성 (총 100점)</p>
                  <div className="text-[11px] font-black text-slate-900 whitespace-nowrap">
                    NCS 30 · 성적 30 · 옥저 30 · 면접 10
                  </div>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap truncate">
                    성적({isCurrent9Scale ? '9등급' : '5등급'})·옥저 30점 자동 환산
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ========================================================================= */}
          {/* 3. 툴바: 희망 학생 추가 + 성적 기준 요약 뱃지 + 필터 + 인쇄 및 엑셀 액션 */}
          {/* ========================================================================= */}
          <Card className="border-slate-200/80 shadow-2xs bg-white rounded-2xl shrink-0 print:hidden overflow-hidden">
            <CardContent className="p-3.5 sm:p-4 flex flex-col gap-3">
              {/* 상단 1행: 활성 성적 산출 규칙 안내 띠 (등급제 및 제외 프리셋) - 줄바꿈 없이 가로 단일 라인 */}
              <div className="flex items-center justify-between gap-3 p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/90 text-xs overflow-x-auto whitespace-nowrap">
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <span className="font-black text-indigo-950 flex items-center gap-1.5 shrink-0">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    교과성적(30점) 반영 기준:
                  </span>
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md font-black text-[11px] shadow-2xs shrink-0">
                    {isCurrent9Scale ? '9등급제 (A:1, B:3, C:5, D:7, E:9)' : '5등급제 (A:1, B:2, C:3, D:4, E:5)'}
                  </span>
                  {currentRules.preferRankGrade && (
                    <span className="bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0">
                      기존 석차등급 우선 적용
                    </span>
                  )}
                  {currentRules.excludeArts && (
                    <span className="bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0">
                      예체능 제외
                    </span>
                  )}
                  {currentRules.excludeSecondLang && (
                    <span className="bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0">
                      제2외국어·한문 제외
                    </span>
                  )}
                  {currentRules.excludePF && (
                    <span className="bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0">
                      P/F 제외
                    </span>
                  )}
                  <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0">
                    {currentRules.targetSemesters === 'all_semesters' ? '전체 학기' : '5개 학기(1-1~3-1)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditSessionModal}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 shadow-2xs gap-1 whitespace-nowrap shrink-0"
                  >
                    <Settings className="h-3 w-3" />
                    <span>성적 기준 설정</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRecalculating}
                    onClick={handleRecalculateScores}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 shadow-2xs gap-1 whitespace-nowrap shrink-0"
                  >
                    {isRecalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    <span>성적 재계산</span>
                  </Button>
                </div>
              </div>

              {/* 하단 2행: 후보자 추가 및 필터 툴바 - 줄바꿈 없이 가로 정렬 */}
              <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  {/* + 희망 학생 추가 버튼 */}
                  <Button
                    type="button"
                    onClick={openAddModal}
                    className="h-9 px-3.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ 희망 학생 추가</span>
                  </Button>

                  {/* 학과 필터 */}
                  <Select value={majorFilter} onValueChange={setMajorFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50/60 whitespace-nowrap shrink-0">
                      <SelectValue placeholder="학과 전체" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl whitespace-nowrap">
                      <SelectItem value="all" className="text-xs font-bold">학과 전체</SelectItem>
                      {availableMajors.map(m => (
                        <SelectItem key={m} value={m} className="text-xs font-medium">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* 선정 상태 필터 */}
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-[140px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50/60 whitespace-nowrap shrink-0">
                      <SelectValue placeholder="선발 상태" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl whitespace-nowrap">
                      <SelectItem value="all" className="text-xs font-bold">상태 전체보기</SelectItem>
                      <SelectItem value="selected" className="text-xs font-black text-emerald-700">
                        ★ 추천 확정권 ({quota}명 이내)
                      </SelectItem>
                      <SelectItem value="wait" className="text-xs font-bold text-slate-600">
                        후보 순위권
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 이름/학번 검색창 */}
                  <div className="relative w-[130px] sm:w-[155px] shrink-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="이름/번호 검색"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="h-9 pl-8 text-xs font-medium rounded-xl border-slate-200 whitespace-nowrap"
                    />
                  </div>
                </div>

                {/* 우측 액션 버튼: 인쇄, 엑셀 다운로드, 점수 일괄 저장 */}
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  {hasUnsavedChanges && (
                    <span className="text-[11px] font-black text-amber-600 animate-pulse mr-1 whitespace-nowrap">
                      ● 변경사항 저장 필요
                    </span>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={handleExportExcel}
                    className="h-9 px-3 text-xs font-bold gap-1.5 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-slate-500" />}
                    <span>엑셀 다운로드</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={isSaving || !hasUnsavedChanges}
                    onClick={handleSaveAll}
                    className={cn(
                      "h-9 px-3.5 text-xs font-bold gap-1.5 rounded-xl text-white shadow-2xs cursor-pointer transition-all whitespace-nowrap shrink-0",
                      hasUnsavedChanges ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
                    )}
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span>점수 저장</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================================= */}
          {/* 4. 내용: 심사 채점 테이블 (실시간 순위 정렬 및 인라인 점수 입력, 줄바꿈 완전 제거) */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {/* 인쇄용 공식 헤더 (화면에서는 숨김) */}
            <div className="hidden print:block p-6 text-center border-b-2 border-slate-900 mb-4 whitespace-nowrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                대구공업고등학교 학교장 추천 대상자 심사 평가 결과표
              </h1>
              <div className="mt-2 text-sm font-bold text-slate-700">
                선발 공고: {currentSession?.title} (추천 선발 정원: {quota}명 / 총 지원 희망자 {totalCandidatesCount}명)
              </div>
              <div className="text-xs text-slate-500 mt-1">
                평가 기준: NCS 시험 30점 + 교과성적 30점({isCurrent9Scale ? '9등급제' : '5등급제'}) + 옥저인재인증 30점 + 면접점수 10점 (총 100점 만점)
              </div>
            </div>

            {totalCandidatesCount === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-3">
                <Users className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600 whitespace-nowrap">등록된 추천 희망 학생이 없습니다.</p>
                <p className="text-xs text-slate-400 whitespace-nowrap">
                  상단의 <strong>[+ 희망 학생 추가]</strong> 버튼을 눌러 추천 심사 대상 학생들을 등록해 주세요.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="py-3 px-3 text-center w-14 whitespace-nowrap">순위</th>
                      <th className="py-3 px-3 text-center w-24 whitespace-nowrap">선정 상태</th>
                      <th className="py-3 px-3 min-w-[90px] whitespace-nowrap">성명</th>
                      <th className="py-3 px-4 min-w-[170px] whitespace-nowrap">학과 / 학반</th>
                      <th className="py-3 px-3 text-center min-w-[130px] bg-blue-50/50 text-blue-900 whitespace-nowrap">
                        NCS 시험 <span className="text-[11px] font-normal text-blue-600">(30점)</span>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[210px] bg-indigo-50/50 text-indigo-900 whitespace-nowrap">
                        교과 성적 <span className="text-[11px] font-normal text-indigo-600">(30점 · {isCurrent9Scale ? '9등급제' : '5등급제'})</span>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[150px] bg-purple-50/50 text-purple-900 whitespace-nowrap">
                        옥저인재인증 <span className="text-[11px] font-normal text-purple-600">(30점)</span>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[120px] bg-emerald-50/50 text-emerald-900 whitespace-nowrap">
                        면접 점수 <span className="text-[11px] font-normal text-emerald-600">(10점)</span>
                      </th>
                      <th className="py-3 px-3 text-center min-w-[130px] bg-amber-50/60 text-amber-950 font-black whitespace-nowrap">
                        종합 점수 <span className="text-[11px] font-normal text-amber-700">(100점)</span>
                      </th>
                      <th className="py-3 px-3 min-w-[140px] whitespace-nowrap">비고</th>
                      <th className="py-3 px-2 text-center w-16 print:hidden whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                    {sortedCandidates.map((c, idx) => {
                      const rank = idx + 1;
                      const isSelected = rank <= quota;
                      const isCutline = rank === quota;

                      return (
                        <React.Fragment key={c.studentId}>
                          <tr className={cn(
                            "hover:bg-slate-50/80 transition-colors whitespace-nowrap",
                            isSelected ? "bg-amber-50/15" : "bg-white"
                          )}>
                            {/* 순위 */}
                            <td className="py-3 px-3 text-center font-mono font-bold whitespace-nowrap">
                              {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                            </td>

                            {/* 선정 상태 뱃지 */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                                  <Check className="h-3 w-3" />
                                  추천 확정
                                </span>
                              ) : (
                                <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                  후보
                                </span>
                              )}
                            </td>

                            {/* 성명 (단일 라인) */}
                            <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                              <span className="text-sm">{c.studentName}</span>
                            </td>

                            {/* 학과 / 반 / 번호 (줄바꿈 없이 단일 라인 표시) */}
                            <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                              <span className="font-bold text-slate-800">{c.major}</span>
                              <span className="text-slate-300 mx-1.5">|</span>
                              <span className="font-mono text-slate-600">{c.classInfo}반 {c.studentNumber}번</span>
                            </td>

                            {/* NCS 점수 (30점 만점) - 잘림 방지 넉넉한 너비 및 스피너 제거 */}
                            <td className="py-2.5 px-3 text-center bg-blue-50/30 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="30"
                                  placeholder="0~30"
                                  value={c.ncsScore !== null ? c.ncsScore : ''}
                                  onChange={e => handleScoreChange(c.studentId, 'ncsScore', e.target.value)}
                                  className="w-20 h-8 text-center text-xs sm:text-sm font-mono font-black px-1.5 rounded-lg border-blue-200 bg-white focus:border-blue-500 whitespace-nowrap [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">점</span>
                              </div>
                            </td>

                            {/* 교과 성적 (30점 만점) - 단일 라인 깔끔한 가로 배치 */}
                            <td className="py-3 px-3 text-center bg-indigo-50/30 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <span className="font-mono text-sm font-black text-indigo-700">
                                  {c.schoolScoreConverted !== null ? `${c.schoolScoreConverted.toFixed(2)}점` : '-'}
                                </span>
                                {c.schoolAverageGrade !== undefined && c.schoolAverageGrade !== null && c.schoolAverageGrade > 0 && (
                                  <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100/90 border border-indigo-200 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                                    {c.schoolAverageGrade.toFixed(2)}등급
                                  </span>
                                )}
                                {c.schoolScoreOriginal !== null && (
                                  <span className="text-[10.5px] text-slate-400 font-mono whitespace-nowrap">
                                    ({c.schoolScoreOriginal.toFixed(1)})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 옥저인재인증 (30점 만점) - 단일 라인 가로 배치 */}
                            <td className="py-3 px-3 text-center bg-purple-50/30 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <span className="font-mono text-sm font-black text-purple-700">
                                  {c.certScoreConverted !== null ? `${c.certScoreConverted.toFixed(2)}점` : '-'}
                                </span>
                                {c.certScoreOriginal !== null && (
                                  <span className="text-[10.5px] text-slate-400 font-mono whitespace-nowrap">
                                    ({c.certScoreOriginal}점)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 면접 점수 (10점 만점) - 잘림 방지 넉넉한 너비 및 스피너 제거 */}
                            <td className="py-2.5 px-3 text-center bg-emerald-50/30 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="10"
                                  placeholder="0~10"
                                  value={c.interviewScore !== null ? c.interviewScore : ''}
                                  onChange={e => handleScoreChange(c.studentId, 'interviewScore', e.target.value)}
                                  className="w-18 h-8 text-center text-xs sm:text-sm font-mono font-black px-1.5 rounded-lg border-emerald-200 bg-white focus:border-emerald-500 whitespace-nowrap [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">점</span>
                              </div>
                            </td>

                            {/* 종합 점수 (100점 만점) - 단일 라인 강조 */}
                            <td className="py-3 px-3 text-center bg-amber-50/40 whitespace-nowrap">
                              <span className={cn(
                                "font-mono text-sm sm:text-base font-black px-2 py-0.5 rounded-lg whitespace-nowrap",
                                isSelected ? "text-amber-700 bg-amber-100/70" : "text-slate-800"
                              )}>
                                {c.totalScore !== null ? `${c.totalScore.toFixed(2)}점` : '-'}
                              </span>
                            </td>

                            {/* 비고 */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <Input
                                placeholder="메모 / 자격증"
                                value={c.remarks || ''}
                                onChange={e => handleScoreChange(c.studentId, 'remarks', e.target.value)}
                                className="h-8 text-xs rounded-lg border-slate-200 bg-white min-w-[120px] max-w-[180px] whitespace-nowrap"
                              />
                            </td>

                            {/* 관리 (삭제) */}
                            <td className="py-3 px-2 text-center print:hidden whitespace-nowrap">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveCandidate(c.studentId, c.studentName)}
                                className="h-7 w-7 text-slate-400 hover:text-red-600 rounded-lg shrink-0"
                                title="후보자 목록에서 제외"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>

                          {/* 추천 선발 인원(TO) 커트라인 구분선 - 단일 라인 */}
                          {isCutline && idx < sortedCandidates.length - 1 && (
                            <tr className="bg-amber-100/60 border-y-2 border-amber-300 whitespace-nowrap">
                              <td colSpan={11} className="py-1.5 px-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2 text-[11px] font-black text-amber-900 whitespace-nowrap">
                                  <span>▲ 추천 선발 정원({quota}명) 합격선</span>
                                  <span>·</span>
                                  <span className="text-amber-800 font-medium">이하 후보 순위권 ▼</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 인쇄 전용 공식 심사 서명란 (화면 숨김) */}
            <div className="hidden print:block p-8 border-t border-slate-300 mt-6 space-y-6 text-xs text-slate-900 font-bold whitespace-nowrap">
              <div className="flex justify-between items-center px-4">
                <div>심사 일시: {new Date().toLocaleDateString('ko-KR')}</div>
                <div>작성자: 취업지원관 __________________ (인)</div>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-4 text-center border-t border-slate-200">
                <div>
                  <p className="text-slate-500 mb-6">심사위원 (교무부장)</p>
                  <p>성명: ________________ (인)</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-6">심사위원 (취업부장)</p>
                  <p>성명: ________________ (인)</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-6">최종 확인 (학교장)</p>
                  <p>성명: ________________ (직인)</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 5. 모달: [희망 학생 추가 모달] 다이얼로그 */}
      {/* ========================================================================= */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
          <DialogHeader className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900">
                  추천 희망 학생 등록
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  학생을 선택하면 공고의 성적 기준({isCurrent9Scale ? '9등급제' : '5등급제'})이 반영된 성적(30점)과 옥저인재인증점수(30점)가 자동 계산됩니다.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                className="h-8 text-xs font-bold rounded-lg border-slate-200"
              >
                {selectedToAddIds.size === filteredAvailableStudents.length && filteredAvailableStudents.length > 0
                  ? '전체 해제'
                  : '전체 선택'}
              </Button>
            </div>
          </DialogHeader>

          {/* 모달 필터 바 */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 shrink-0">
            <Select value={addModalMajor} onValueChange={setAddModalMajor}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-bold rounded-lg border-slate-200 bg-white">
                <SelectValue placeholder="학과 전체" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs font-bold">학과 전체</SelectItem>
                {Array.from(new Set(availableStudents.map(s => s.major))).filter(Boolean).sort().map(m => (
                  <SelectItem key={m} value={m} className="text-xs font-medium">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="이름 또는 학번 검색..."
                value={addModalSearch}
                onChange={e => setAddModalSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg border-slate-200 bg-white"
              />
            </div>

            <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              선택: {selectedToAddIds.size}명
            </div>
          </div>

          {/* 학생 체크 리스트 */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingStudents ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-xs text-slate-500 font-bold">학생 목록 불러오는 중...</span>
              </div>
            ) : filteredAvailableStudents.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">
                추가 가능한 학생이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {filteredAvailableStudents.map(s => {
                  const isChecked = selectedToAddIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelectStudent(s.id)}
                      className={cn(
                        "p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all",
                        isChecked
                          ? "bg-blue-50 border-blue-400 shadow-2xs"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900">{s.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {s.major} · {s.class_info}반 {s.student_number}번
                        </div>
                      </div>
                      <div className={cn(
                        "h-5 w-5 rounded-md border flex items-center justify-center transition-all",
                        isChecked
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 bg-white"
                      )}>
                        {isChecked && <Check className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 모달 푸터 */}
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              선택한 학생을 추가하면 교과성적(30점, 학점가중치 적용)과 옥저인증점수(30점)가 자동 계산됩니다.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 text-xs font-bold rounded-lg border-slate-200"
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedToAddIds.size === 0 || isAddingCandidates}
                onClick={handleAddSelectedStudents}
                className="h-8 px-4 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {isAddingCandidates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                <span>{selectedToAddIds.size}명 후보자 등록</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. 모달: [새 추천 선발 공고 등록 / 수정 모달] 다이얼로그 */}
      {/* ========================================================================= */}
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="max-w-lg p-5 rounded-2xl bg-white border-none shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span>{editingSessionId ? '선발 공고 및 성적 평가 기준 수정' : '새 추천 선발 공고 등록'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              기업/기관별 채용 요강에 맞게 평가 등급 체계(9등급제/5등급제)와 과목 제외 프리셋을 설정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">선발 공고명 *</label>
              <Input
                placeholder="예: 2026 한국항공우주산업(KAI) 생산직 학교장추천"
                value={sessionFormTitle}
                onChange={e => setSessionFormTitle(e.target.value)}
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">추천 선발 정원 (TO) *</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={sessionFormQuota}
                  onChange={e => setSessionFormQuota(parseInt(e.target.value) || 1)}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">대상 학년</label>
                <Select value={String(sessionFormGrade)} onValueChange={v => setSessionFormGrade(parseInt(v))}>
                  <SelectTrigger className="h-9 text-xs font-bold rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="3">3학년 (졸업예정자)</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="1">1학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 🎯 성적 산출 및 등급 체계 설정 섹션 */}
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  교과성적(30점) 등급 산출 및 제외 규칙 설정
                </span>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-100 px-2 py-0.5 rounded-full">
                  학점 가중평균
                </span>
              </div>

              {/* 1) 9등급제 vs 5등급제 선택 및 기존 석차등급 우선 적용 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-white rounded-lg border border-indigo-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-800">
                    평가 등급 체계 선택 *
                  </label>
                  <Select value={sessionFormGradeScale} onValueChange={(v: any) => setSessionFormGradeScale(v)}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50/80 rounded-lg border-indigo-200 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="9_scale" className="text-xs font-bold">
                        9등급제 (A:1, B:3, C:5, D:7, E:9)
                      </SelectItem>
                      <SelectItem value="5_scale" className="text-xs font-bold">
                        5등급제 (A:1, B:2, C:3, D:4, E:5)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-800 pb-1 hover:text-indigo-900">
                    <input
                      type="checkbox"
                      checked={sessionFormPreferRankGrade}
                      onChange={e => setSessionFormPreferRankGrade(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>기존 석차등급 우선 적용</span>
                  </label>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    데이터에 등급이 있으면 우선 적용, 성취도만 있는 과목은 위 기준으로 등급 환산
                  </p>
                </div>
              </div>

              {/* 2) 제외 과목 체크박스 */}
              <div className="space-y-2 text-xs text-slate-800 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-indigo-900">
                  <input
                    type="checkbox"
                    checked={sessionFormExcludeArts}
                    onChange={e => setSessionFormExcludeArts(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span><strong>예체능 성적 제외</strong> (체육, 체조, 스포츠, 음악, 미술 등)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-indigo-900">
                  <input
                    type="checkbox"
                    checked={sessionFormExcludeSecondLang}
                    onChange={e => setSessionFormExcludeSecondLang(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span><strong>제2외국어 및 한문 제외</strong> (일본어, 한문 등)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-indigo-900">
                  <input
                    type="checkbox"
                    checked={sessionFormExcludePF}
                    onChange={e => setSessionFormExcludePF(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span><strong>P/F(이수/미이수) 과목 제외</strong></span>
                </label>
              </div>

              {/* 3) 반영 교과군 및 학기 범위 */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">반영 교과군</label>
                  <Select value={sessionFormSubjectGroup} onValueChange={(v: any) => setSessionFormSubjectGroup(v)}>
                    <SelectTrigger className="h-8 text-xs bg-white rounded-lg border-indigo-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="text-xs font-bold">전과목 (기본)</SelectItem>
                      <SelectItem value="kem" className="text-xs font-bold">국·영·수 과목만</SelectItem>
                      <SelectItem value="general" className="text-xs font-bold">보통교과(국영수사과)</SelectItem>
                      <SelectItem value="vocational" className="text-xs font-bold">전공 전문교과만</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">반영 학기 범위</label>
                  <Select value={sessionFormTargetSemesters} onValueChange={(v: any) => setSessionFormTargetSemesters(v)}>
                    <SelectTrigger className="h-8 text-xs bg-white rounded-lg border-indigo-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="five_semesters" className="text-xs font-bold">1-1 ~ 3-1 (5개 학기)</SelectItem>
                      <SelectItem value="all_semesters" className="text-xs font-bold">전체 학기 반영</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">공고 메모 및 안내 사항</label>
              <Input
                placeholder="예: NCS 30점, 성적 30점(9등급제/석차등급우선), 옥저 30점, 면접 10점"
                value={sessionFormDesc}
                onChange={e => setSessionFormDesc(e.target.value)}
                className="h-9 text-xs rounded-xl border-slate-200"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSessionModalOpen(false)}
              className="h-8 text-xs font-bold rounded-lg"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSession}
              className="h-8 px-4 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
            >
              {editingSessionId ? '규칙 저장 및 재계산' : '등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
