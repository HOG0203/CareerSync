'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Users,
  Calendar,
  Check,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import {
  getCareerCourseCandidatesAction,
  bulkSyncCareerCoursesAction,
} from './actions';

export const OFFICIAL_CAREER_COURSES = [
  '청솔반',
  '취업맞춤반',
  '중견기업반',
  '반도체아카데미반',
  '혁신인재반',
  '부사관반',
  '도제반',
  '군특성화반',
  '아우스빌둥',
] as const;

// 1. 확정 진로코스 정렬 우선순위
const COURSE_SORT_ORDER: readonly string[] = OFFICIAL_CAREER_COURSES;

// 2. 학과 정렬 우선순위
const MAJOR_SORT_ORDER = [
  '자동화기계과',
  '친환경자동차과',
  '스마트공간과',
  '스마트전기과',
  '바이오화학과',
  '스마트융합섬유과',
] as const;

function getMajorSortIndex(major: string): number {
  if (!major) return 999;
  const m = major.trim();
  const idx = MAJOR_SORT_ORDER.findIndex(target => {
    const cleanTarget = target.replace(/과|공업계/g, '');
    const cleanM = m.replace(/과|공업계/g, '');
    return cleanM === cleanTarget || cleanM.includes(cleanTarget) || cleanTarget.includes(cleanM);
  });
  return idx === -1 ? 999 : idx;
}

// 번호 및 학반 숫자 추출 함수 (자연 정렬: 1, 2, 3... 10)
function parseNumberOnly(val: any): number {
  if (typeof val === 'number') return val;
  const matches = String(val || '').match(/\d+/);
  return matches ? parseInt(matches[0], 10) : 0;
}

interface CareerCourseBulkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grade: number;
  academicYear: number;
  onSuccess: () => Promise<void>;
}

export function CareerCourseBulkModal({
  open,
  onOpenChange,
  grade,
  academicYear,
  onSuccess,
}: CareerCourseBulkModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = React.useState(false);

  // 1학기 or 2학기 선택 (현재 월 기준 기본값 자동 지정: 8월 이후는 2학기, 그 전은 1학기)
  const currentMonth = new Date().getMonth() + 1;
  const defaultSemester: 1 | 2 = currentMonth >= 8 ? 2 : 1;
  const [semester, setSemester] = React.useState<1 | 2>(defaultSemester);
  const [skipExistingThisTerm, setSkipExistingThisTerm] = React.useState(true);

  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [courseStats, setCourseStats] = React.useState<Record<string, number>>({});

  // 타겟 학기 (예: 3학년 2학기 -> '3-2')
  const targetTerm = `${grade}-${semester}`;

  // 모달이 열릴 때 DB에서 최신 후보자 목록 로드
  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoading(true);

    getCareerCourseCandidatesAction({
      gradeNum: grade,
      academicYear,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setCandidates(res.candidates || []);
          setCourseStats(res.courseStats || {});
        } else {
          toast({
            variant: 'destructive',
            title: '데이터 조회 실패',
            description: res.error || '진로코스 후보 학생을 불러오지 못했습니다.',
          });
        }
      })
      .catch((err) => {
        console.error('Error loading candidates:', err);
        if (isMounted) {
          toast({
            variant: 'destructive',
            title: '오류 발생',
            description: '학생 데이터를 불러오는 중 오류가 발생했습니다.',
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, grade, academicYear, toast]);

  // 학기 수에 따른 인증 점수 산출 함수
  const calcScore = (termCount: number) => {
    if (termCount >= 4) return 10;
    if (termCount === 3) return 8;
    if (termCount === 2) return 6;
    if (termCount === 1) return 4;
    return 0;
  };

  // 실제 반영 예정 학생 수 계산 (이번 학기에 이미 등록되어 스킵되는 학생 제외)
  const targetCount = React.useMemo(() => {
    return candidates.filter((c) => {
      if (skipExistingThisTerm && c.existingTerms.includes(targetTerm)) {
        return false;
      }
      return true;
    }).length;
  }, [candidates, skipExistingThisTerm, targetTerm]);

  // 이미 이번 학기에 등록된 학생 수
  const alreadyRegisteredCount = React.useMemo(() => {
    return candidates.filter((c) => c.existingTerms.includes(targetTerm)).length;
  }, [candidates, targetTerm]);

  // 우선순위 정렬된 학생 목록 (1.확정코스순 -> 2.학과순 -> 3.학반순 -> 4.번호 자연정렬 순)
  const sortedCandidates = React.useMemo(() => {
    return [...candidates].sort((a, b) => {
      // 1순위. 확정 진로코스 순
      const courseIdxA = COURSE_SORT_ORDER.indexOf(a.standardCourse);
      const courseIdxB = COURSE_SORT_ORDER.indexOf(b.standardCourse);
      const cA = courseIdxA === -1 ? 999 : courseIdxA;
      const cB = courseIdxB === -1 ? 999 : courseIdxB;
      if (cA !== cB) return cA - cB;

      // 2순위. 학과 순
      const majorIdxA = getMajorSortIndex(a.major);
      const majorIdxB = getMajorSortIndex(b.major);
      if (majorIdxA !== majorIdxB) return majorIdxA - majorIdxB;

      // 3순위. 학반 순 (숫자 기준 자연 정렬)
      const classA = parseNumberOnly(a.classInfo);
      const classB = parseNumberOnly(b.classInfo);
      if (classA !== classB) {
        if (classA && classB) return classA - classB;
        return String(a.classInfo || '').localeCompare(String(b.classInfo || ''), undefined, { numeric: true });
      }

      // 4순위. 번호 순 (1, 2, 3... 10 자연 정렬)
      const numA = parseNumberOnly(a.studentNumber);
      const numB = parseNumberOnly(b.studentNumber);
      if (numA !== numB) return numA - numB;

      return (a.studentName || '').localeCompare(b.studentName || '', 'ko');
    });
  }, [candidates]);

  // 적용 대상 학생 엑셀 다운로드 (사전 검토용)
  const handleDownloadExcel = async () => {
    if (sortedCandidates.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드할 데이터 없음',
        description: '적용 대상 학생이 없습니다.',
      });
      return;
    }

    try {
      setIsDownloadingExcel(true);
      const XLSX = await import('xlsx');

      const exportRows = sortedCandidates.map((c, idx) => {
        const isAlreadyRegistered = c.existingTerms.includes(targetTerm);
        const willSkip = skipExistingThisTerm && isAlreadyRegistered;
        const nextTerms = willSkip
          ? c.existingTerms
          : Array.from(new Set([...c.existingTerms, targetTerm])).sort();
        const nextScore = calcScore(nextTerms.length);

        return {
          '연번': idx + 1,
          '학년': `${grade}학년`,
          '학과': c.major,
          '학반': c.classInfo,
          '번호': c.studentNumber,
          '성명': c.studentName,
          '확정진로코스': c.standardCourse,
          '확정대상학기': `${targetTerm}학기`,
          '기존이수학기': c.existingTerms.length > 0 ? c.existingTerms.join(', ') : '없음',
          '반영후_총이수학기': `${nextTerms.length}학기 (${nextTerms.join(', ') || '없음'})`,
          '반영후_예상점수': `${nextScore}점`,
          '반영구분': willSkip ? '기존유지 (건너뜀)' : '확정반영 대상',
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${grade}학년_${targetTerm}코스대상자`);
      XLSX.writeFile(
        wb,
        `${academicYear}학년도_${grade}학년_${targetTerm}학기_취업진로코스_적용대상_명단.xlsx`
      );

      toast({
        title: '엑셀 다운로드 완료',
        description: `총 ${exportRows.length}명의 적용 대상 학생 명단이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      console.error('Error downloading candidates excel:', err);
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '엑셀 파일 생성 중 오류가 발생했습니다.',
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  // 확정 실행
  const handleConfirm = async () => {
    if (targetCount === 0) {
      toast({
        variant: 'destructive',
        title: '적용 대상 없음',
        description: `모든 학생이 이미 이번 ${targetTerm}학기에 등록되어 있거나 대상 학생이 없습니다.`,
      });
      return;
    }

    try {
      setIsProcessing(true);
      const res = await bulkSyncCareerCoursesAction({
        gradeNum: grade,
        academicYear,
        semester,
        skipExistingThisTerm,
      });

      if (res.success) {
        toast({
          title: `${res.targetTerm}학기 일괄 확정 완료`,
          description: `총 ${res.processedCount}명의 진로코스 실적이 인증제에 성공적으로 반영되었습니다.${res.skippedCount > 0 ? ` (${res.skippedCount}명 기존 유지)` : ''}`,
        });
        await onSuccess();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: '확정 실패',
          description: res.error || '진로코스 반영 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      console.error('Error confirming career courses:', err);
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '일괄 확정 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] p-0 flex flex-col rounded-2xl overflow-hidden shadow-2xl border-slate-200">
        {/* 모달 헤더 */}
        <DialogHeader className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>취업진로코스 학기별 일괄 확정</span>
                <Badge className="bg-indigo-600 text-white text-[11px] font-extrabold px-2 py-0.5">
                  {grade}학년 대상
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                학생 DB의 확정진로코스(9개 공식 인정 코스)를 기준으로, 선택한 학기의 실적을 일괄 등록합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="text-xs font-bold text-slate-600">학생 DB 확정진로코스 데이터 분석 중...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center gap-2">
              <AlertCircle className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">현재 {grade}학년에 등록된 공식 확정진로코스 학생이 없습니다.</p>
              <p className="text-xs text-slate-400">
                희망진로코스가 아닌 &apos;확정진로코스&apos;에 9개 공식 코스(도제반, 청솔반, 맞춤반 등)가 등록되어 있어야 합니다.
              </p>
            </div>
          ) : (
            <>
              {/* 1. 학기 선택 컨트롤 카드 */}
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 p-4 rounded-xl border border-indigo-100/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        확정 대상 학기 선택
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        선택한 학기에 대해 {grade}학년 학생들의 코스 참여가 확정 등록됩니다.
                      </p>
                    </div>
                  </div>

                  {/* 드롭다운: 1학기 or 2학기 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={String(semester)}
                      onValueChange={(v) => setSemester(Number(v) as 1 | 2)}
                    >
                      <SelectTrigger className="w-[180px] h-9 text-xs font-black bg-white border-indigo-200 text-indigo-950 rounded-xl shadow-2xs">
                        <SelectValue placeholder="학기 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs font-bold py-2">
                          🌱 1학기 ({grade}-1학기로 확정)
                        </SelectItem>
                        <SelectItem value="2" className="text-xs font-bold py-2">
                          🍁 2학기 ({grade}-2학기로 확정)
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-black text-xs px-2.5 py-1.5 h-9 rounded-xl shadow-2xs">
                      {targetTerm}학기 반영
                    </Badge>
                  </div>
                </div>

                {/* 옵션: 이번 학기 중복 유지 체크박스 */}
                <div className="pt-2 border-t border-indigo-100/60 flex items-center space-x-2">
                  <Checkbox
                    id="skipExisting"
                    checked={skipExistingThisTerm}
                    onCheckedChange={(checked) => setSkipExistingThisTerm(Boolean(checked))}
                  />
                  <Label
                    htmlFor="skipExisting"
                    className="text-xs font-bold text-slate-700 cursor-pointer select-none"
                  >
                    이미 이번 <span className="text-indigo-600 font-extrabold">{targetTerm}학기</span> 실적이 등록된 학생은 기존 데이터 유지 (중복 방지, 권장)
                  </Label>
                </div>
              </div>

              {/* 2. 요약 통계 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    인정 코스 총원
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1">{candidates.length}명</span>
                </div>
                <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    {targetTerm} 반영 대상
                  </span>
                  <span className="text-xl font-black text-indigo-700 mt-1">{targetCount}명</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {targetTerm} 기등록
                  </span>
                  <span className="text-xl font-black text-emerald-700 mt-1">
                    {alreadyRegisteredCount}명
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    감지된 코스
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1">
                    {Object.keys(courseStats).length}개 코스
                  </span>
                </div>
              </div>

              {/* 3. 감지된 공식 인정 코스 칩 목록 */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-extrabold text-slate-500 block">
                  공식 인정 코스 9개 중 감지된 코스 목록:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {OFFICIAL_CAREER_COURSES.map((courseName) => {
                    const count = courseStats[courseName] || 0;
                    if (count === 0) return null;
                    return (
                      <Badge
                        key={courseName}
                        variant="outline"
                        className="bg-slate-50 border-slate-200 text-slate-700 text-xs py-1 px-2 gap-1.5 font-bold"
                      >
                        <span>{courseName}</span>
                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                          {count}명
                        </span>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* 4. 적용 대상 학생 미리보기 테이블 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="p-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span>적용 대상 학생 미리보기 ({candidates.length}명)</span>
                    <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">
                      • 확정 시 기존 이수 학기에 {targetTerm}이 누적됩니다
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadExcel}
                    disabled={isDownloadingExcel || candidates.length === 0}
                    className="h-7 px-2.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border-emerald-300 rounded-lg gap-1 shadow-2xs shrink-0 self-end sm:self-auto"
                    title="적용 대상 학생 명단 엑셀 다운로드"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{isDownloadingExcel ? '엑셀 생성 중...' : '대상자 엑셀 다운로드'}</span>
                  </Button>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="p-2 w-12 text-center">연번</th>
                        <th className="p-2 w-14 text-center">번호</th>
                        <th className="p-2 w-20">성명</th>
                        <th className="p-2">학과/반</th>
                        <th className="p-2">확정 코스</th>
                        <th className="p-2 text-center">확정 학기</th>
                        <th className="p-2 text-center">반영 후 누적 이수</th>
                        <th className="p-2 w-20 text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedCandidates.map((c, idx) => {
                        const isAlreadyRegistered = c.existingTerms.includes(targetTerm);
                        const willSkip = skipExistingThisTerm && isAlreadyRegistered;

                        // 반영 후 누적 학기 수 및 점수
                        const nextTerms = willSkip
                          ? c.existingTerms
                          : Array.from(new Set([...c.existingTerms, targetTerm])).sort();
                        const nextScore = calcScore(nextTerms.length);

                        return (
                          <tr
                            key={c.id}
                            className={`hover:bg-slate-50/80 ${willSkip ? 'opacity-50 bg-slate-50/40' : ''}`}
                          >
                            <td className="p-2 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="p-2 text-center font-mono text-slate-600 font-bold">{c.studentNumber}</td>
                            <td className="p-2 font-bold text-slate-900">{c.studentName}</td>
                            <td className="p-2 text-slate-500">
                              {c.major} {c.classInfo}
                            </td>
                            <td className="p-2 font-semibold text-slate-800">
                              <Badge variant="outline" className="bg-indigo-50/50 text-indigo-700 border-indigo-200 font-bold text-[11px]">
                                {c.standardCourse}
                              </Badge>
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-indigo-600">
                              {targetTerm}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-bold text-slate-700">
                                  {nextTerms.length}학기
                                </span>
                                <Badge className="text-[10px] font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200">
                                  {nextScore}점
                                </Badge>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {willSkip ? (
                                <Badge variant="outline" className="text-[9px] text-slate-400 bg-slate-50">
                                  기존유지
                                </Badge>
                              ) : (
                                <Badge className="text-[9px] bg-emerald-600 text-white font-extrabold">
                                  확정반영
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 모달 푸터 */}
        <DialogFooter className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={isDownloadingExcel || candidates.length === 0}
            className="rounded-xl text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border-emerald-300 gap-1.5 shadow-2xs"
            title="적용 대상 학생 명단 엑셀 다운로드"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>{isDownloadingExcel ? '엑셀 생성 중...' : '적용 대상 엑셀 다운로드'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="rounded-xl text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={isProcessing || isLoading || targetCount === 0}
              className="rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{targetTerm}학기 실적 DB 반영 중...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{targetTerm}학기 진로코스 일괄 확정 ({targetCount}명)</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
