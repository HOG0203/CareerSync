'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Search,
  Save,
  Trash2,
  X,
  Trophy,
  Activity,
  ChevronDown,
  Info,
  Medal,
  Loader2,
  Settings2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
  generateArtsContestTemplate,
  parseArtsContestWorkbook,
  buildUploadedOnlyArtsContestRows,
  UploadedStudentArtsContestRow,
  RawArtsContestRecord,
} from '@/lib/arts-contest-parser';
import { getEvaluationsStore, batchImportArtsContestAction } from '../actions';
import { ManualStudentMatchingDialog, ManualMatchTarget } from './manual-student-matching-dialog';
import { DeleteMyRecordsDialog } from './delete-my-records-dialog';

interface ArtsContestImportCardProps {
  isAdmin: boolean;
  userProfile: any;
  baseYear?: number;
  onImportSuccess?: () => void;
}

export function ArtsContestImportCard({
  isAdmin,
  userProfile,
  baseYear = 2026,
  onImportSuccess,
}: ArtsContestImportCardProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const [activeStudents, setActiveStudents] = React.useState<any[]>([]);
  const [existingStore, setExistingStore] = React.useState<Record<string, any>>({});

  const [files, setFiles] = React.useState<File[]>([]);
  const [rawRecords, setRawRecords] = React.useState<RawArtsContestRecord[]>([]);
  const [manualSelections, setManualSelections] = React.useState<Record<string, string>>({});

  // 수동 매칭 모달 타겟
  const [matchingTarget, setMatchingTarget] = React.useState<ManualMatchTarget | null>(null);

  // 필터 상태
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'matched' | 'unmatched'>('all');
  const [gradeFilter, setGradeFilter] = React.useState<'all' | '3' | '2' | '1'>('all');
  const [majorFilter, setMajorFilter] = React.useState<string>('all');

  // 파일 업로드 시점에만 필요한 학생 매칭 데이터 온디맨드 로드 (초기 렌더링 쿼리 0회)
  const ensureMatchingData = React.useCallback(async (force = false) => {
    if (!force && activeStudents.length > 0) return { students: activeStudents, store: existingStore };

    const supabase = createClient();
    const gradYears = [baseYear + 1, baseYear + 2, baseYear + 3];

    const [studentsRes, storeRes] = await Promise.all([
      supabase
        .from('students')
        .select('id, student_name, student_number, major, class_info, graduation_year')
        .in('graduation_year', gradYears)

        .range(0, 4999)
        .order('graduation_year', { ascending: true })
        .order('class_info', { ascending: true })
        .order('student_number', { ascending: true }),
      getEvaluationsStore(),
    ]);

    const stdList = studentsRes.data || [];
    const store = storeRes || {};
    setActiveStudents(stdList);
    setExistingStore(store);
    return { students: stdList, store };
  }, [activeStudents, existingStore, baseYear]);


  // 2. 파일 업로드 및 파싱 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selectedFiles = Array.from(e.target.files);
    await processFiles(selectedFiles);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (droppedFiles.length === 0) {
      toast({
        title: '지원되지 않는 파일',
        description: '.xlsx 또는 .xls 엑셀 파일만 업로드할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }
    await processFiles(droppedFiles);
  };

  const processFiles = async (newFiles: File[]) => {
    setIsParsing(true);
    try {
      await ensureMatchingData();

      const mergedFiles = [...files, ...newFiles];
      setFiles(mergedFiles);


      let allParsedRecords: RawArtsContestRecord[] = [...rawRecords];

      for (const file of newFiles) {
        const buffer = await file.arrayBuffer();
        const records = parseArtsContestWorkbook(buffer, file.name);
        allParsedRecords = [...allParsedRecords, ...records];
      }

      setRawRecords(allParsedRecords);

      toast({
        title: '엑셀 파일 분석 완료',
        description: `총 ${newFiles.length}개 파일에서 ${allParsedRecords.length}건의 예체능 및 대회 레코드를 추출했습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: '파일 파싱 실패',
        description: err.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // 3. 템플릿 다운로드 핸들러
  const handleDownloadTemplate = async (type: 'sports' | 'contest') => {
    try {
      const data = await generateArtsContestTemplate(type, baseYear);
      const blob = new Blob([data as any], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const nameMap: Record<string, string> = {
        sports: '1.예체능_운동부_관악부_참여명단_서식',
        contest: '2.교내외대회_참가_입상_명단_서식',
      };

      a.download = `(${baseYear}학년도)_${nameMap[type]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: '일괄 업로드 서식 다운로드 완료',
        description: `${nameMap[type]} 파일(드롭다운 유효성 검사 탑재)이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: '서식 다운로드 실패',
        description: err.message || '서식 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleClear = () => {
    setFiles([]);
    setRawRecords([]);
    setManualSelections({});
    setSearch('');
  };

  const handleRemoveFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    if (updated.length === 0) {
      handleClear();
    } else {
      setIsParsing(true);
      Promise.all(
        updated.map(async (f) => {
          const buf = await f.arrayBuffer();
          return parseArtsContestWorkbook(buf, f.name);
        })
      )
        .then((res) => {
          setRawRecords(res.flat());
        })
        .finally(() => setIsParsing(false));
    }
  };

  // 4. 업로드된 학생들만 추출하여 DB 대조 행 생성
  const uploadedRows = React.useMemo(() => {
    return buildUploadedOnlyArtsContestRows(
      activeStudents,
      existingStore,
      rawRecords,
      manualSelections,
      baseYear
    );
  }, [activeStudents, existingStore, rawRecords, manualSelections, baseYear]);

  // 5. 통계 계산
  const stats = React.useMemo(() => {
    const total = uploadedRows.length;
    const matched = uploadedRows.filter((r) => r.matchStatus === 'matched').length;
    const unmatched = uploadedRows.filter((r) => r.matchStatus === 'unmatched').length;
    const ambiguous = uploadedRows.filter((r) => r.matchStatus === 'ambiguous').length;
    const totalSportsParticipants = uploadedRows.filter((r) => r.artsSportsSemesters > 0).length;
    const totalContestParticipants = uploadedRows.filter(
      (r) => r.contestAwardCount > 0 || r.contestParticipateCount > 0
    ).length;

    return {
      total,
      matched,
      unmatched,
      ambiguous,
      totalSportsParticipants,
      totalContestParticipants,
    };
  }, [uploadedRows]);

  // 6. 필터링된 행 목록
  const filteredRows = React.useMemo(() => {
    return uploadedRows.filter((row) => {
      // 상태 필터
      if (statusFilter === 'matched' && row.matchStatus !== 'matched') return false;
      if (statusFilter === 'unmatched' && row.matchStatus === 'matched') return false;

      // 학년 필터
      if (gradeFilter !== 'all') {
        const targetGrade = parseInt(gradeFilter, 10);
        const rowGrade = row.currentGrade || row.excelGrade;
        if (rowGrade !== targetGrade) return false;
      }

      // 학과 필터
      if (majorFilter !== 'all') {
        const rowMajor = row.currentMajor || row.excelMajor || '';
        if (!rowMajor.includes(majorFilter)) return false;
      }

      // 검색어 필터
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = row.studentName.toLowerCase().includes(q) || row.excelStudentName.toLowerCase().includes(q);
        const numMatch = String(row.currentNumber || row.excelStudentNumber || '').includes(q);
        const classMatch = String(row.currentClass || row.excelClassNumber || '').includes(q);
        const majorMatch = (row.currentMajor || row.excelMajor || '').toLowerCase().includes(q);
        if (!nameMatch && !numMatch && !classMatch && !majorMatch) return false;
      }

      return true;
    });
  }, [uploadedRows, statusFilter, gradeFilter, majorFilter, search]);

  // 7. DB 일괄 저장 핸들러
  const handleSaveToDatabase = async () => {
    const matchedOnly = uploadedRows.filter((r) => r.matchStatus === 'matched' && r.studentId);

    if (matchedOnly.length === 0) {
      toast({
        title: '저장할 대상 없음',
        description: 'DB와 정상 매칭된 학생이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = matchedOnly.map((r) => ({
        studentId: r.studentId!,
        artsSports: r.artsSports,
        contestList: r.contestList,
        artsSportsSemesters: r.artsSportsSemesters,
        contestAwardCount: r.contestAwardCount,
        contestParticipateCount: r.contestParticipateCount,
      }));

      const res = await batchImportArtsContestAction(payload);
      if (res.success) {
        toast({
          title: 'DB 일괄 저장 완료',
          description: `총 ${res.updatedCount}명의 예체능 및 교내외 대회 실적이 데이터베이스에 안전하게 영구 저장되었습니다.`,
        });
        await ensureMatchingData(true);
        if (onImportSuccess) onImportSuccess();

      } else {
        toast({
          title: '저장 실패',
          description: res.error || 'DB 저장 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: '저장 중 오류 발생',
        description: err.message || '서버 통신 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>예체능 & 교내외 대회 실적 일괄 등록</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold">
                  {baseYear}학년도 재학생 기준
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                업로드한 엑셀에 <strong>기재된 학생들만 실시간 추출</strong>하여 DB 재학생 정보와 대조·누적 병합합니다.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-10 px-3.5 text-xs sm:text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
              title="내가 등록한 예체능 및 대회 실적 데이터를 확인하고 수정/삭제합니다"
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
              <span>등록 내역 관리 (수정/삭제)</span>
            </Button>

            {/* 2종 개별 서식 다운로드 드롭다운 메뉴 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4 text-xs sm:text-sm bg-amber-50/90 hover:bg-amber-100 text-amber-800 border-2 border-amber-200 hover:border-amber-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Download className="h-4 w-4 text-amber-600" />
                  <span>일괄 업로드 서식 다운로드</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-[310px] rounded-xl text-xs font-semibold p-1.5 shadow-xl border-slate-200">
                <DropdownMenuItem
                  onClick={() => handleDownloadTemplate('sports')}
                  className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg"
                >
                  <Activity className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">1. 예체능 (운동부·관악부) 참여 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">운동부/관악부 학기별 활동 (6학기 5점) (.xlsx)</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleDownloadTemplate('contest')}
                  className="cursor-pointer gap-2.5 py-2 px-3 rounded-lg"
                >
                  <Medal className="h-4 w-4 text-purple-600 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-800 whitespace-nowrap">2. 교내외대회 참가·입상 명단</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">입상 1.0점, 단순참가 0.5점 (최대 5점) (.xlsx)</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {files.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-10 px-3 text-xs text-slate-500 hover:text-rose-600 font-bold rounded-xl gap-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>초기화</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* 2. 드래그앤드롭 파일 업로드 영역 */}
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
            files.length > 0
              ? 'border-amber-400 bg-amber-50/20'
              : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50/50'
          }`}
        >
            <input
              type="file"
              id="arts-contest-file-input"
              multiple
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="arts-contest-file-input"
              className="flex flex-col items-center justify-center cursor-pointer space-y-3"
            >
              <div className="p-3.5 rounded-2xl bg-amber-100 text-amber-700 shadow-2xs">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-800">
                  엑셀 파일을 이곳에 끌어다 놓거나 클릭하여 선택하세요
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  운동부/관악부 명단, 대회 입상 명단 등 여러 파일을 한꺼번에 드래그앤드롭할 수 있습니다.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-xs font-bold border-amber-300 text-amber-700 bg-white hover:bg-amber-50 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById('arts-contest-file-input')?.click();
                }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-amber-600" />
                파일 탐색기 열기
              </Button>
            </label>
          </div>

          {/* 업로드된 파일 리스트 배지 */}
          {files.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                  업로드된 파일 ({files.length}개):
                </span>
                {files.map((f, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="bg-white border border-slate-200 text-slate-700 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-2xs font-bold"
                  >
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(i)}
                      className="text-slate-400 hover:text-rose-500 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold h-7 px-2 rounded-lg"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                전체 초기화
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. 업로드된 파일 대상 실시간 대조 및 점수 산출 테이블 */}
      {uploadedRows.length > 0 && (
        <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="p-6 pb-4 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-black text-slate-900">
                  업로드 학생 실적 대조 및 점수 검증
                </CardTitle>
                <Badge className="bg-amber-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                  엑셀 기재 학생 {stats.total}명
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                업로드된 엑셀에 기재된 학생들만 표시됩니다. DB 학적과 자동 대조하여 매칭 상태 및 산출 점수를 확인하세요.
              </p>
            </div>

            {/* 일괄 저장 버튼 */}
            <Button
              onClick={handleSaveToDatabase}
              disabled={isSaving || stats.matched === 0}
              className="font-extrabold text-xs h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5 shrink-0"
            >
              {isSaving ? (
                <span>저장 중...</span>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>DB 매칭 완료 학생 일괄 저장 ({stats.matched}명)</span>
                </>
              )}
            </Button>
          </CardHeader>

          {/* 4. 통계 요약 위젯 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-4 border-b border-slate-100 bg-white">
            <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-emerald-800">✅ DB 매칭 성공</div>
                <div className="text-lg font-black text-emerald-700">{stats.matched}명</div>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-500 opacity-80" />
            </div>

            <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-rose-800">⚠️ DB 불일치/미등록</div>
                <div className="text-lg font-black text-rose-700">{stats.unmatched}명</div>
              </div>
              <AlertCircle className="h-6 w-6 text-rose-500 opacity-80" />
            </div>

            <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-amber-800">🏃 운동/관악부 실적</div>
                <div className="text-lg font-black text-amber-700">{stats.totalSportsParticipants}명</div>
              </div>
              <Activity className="h-6 w-6 text-amber-500 opacity-80" />
            </div>

            <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold text-purple-800">🏆 교내외 대회 실적</div>
                <div className="text-lg font-black text-purple-700">{stats.totalContestParticipants}명</div>
              </div>
              <Medal className="h-6 w-6 text-purple-500 opacity-80" />
            </div>
          </div>

          {/* 5. 필터 및 검색 툴바 */}
          <div className="p-6 pt-4 pb-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* 상태 필터 */}
              <Select
                value={statusFilter}
                onValueChange={(val: any) => setStatusFilter(val)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs font-bold rounded-lg bg-white border-slate-200">
                  <SelectValue placeholder="매칭 상태" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">전체 상태 ({uploadedRows.length})</SelectItem>
                  <SelectItem value="matched">✅ 매칭 완료 ({stats.matched})</SelectItem>
                  <SelectItem value="unmatched">⚠️ 불일치 ({stats.unmatched + stats.ambiguous})</SelectItem>
                </SelectContent>
              </Select>

              {/* 학년 필터 */}
              <Select
                value={gradeFilter}
                onValueChange={(val: any) => setGradeFilter(val)}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs font-bold rounded-lg bg-white border-slate-200">
                  <SelectValue placeholder="학년 필터" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="all">전체 학년</SelectItem>
                  <SelectItem value="3">3학년</SelectItem>
                  <SelectItem value="2">2학년</SelectItem>
                  <SelectItem value="1">1학년</SelectItem>
                </SelectContent>
              </Select>

              {/* 검색어 */}
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="성명, 학과, 학급 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-lg bg-white border-slate-200"
                />
              </div>
            </div>

            <div className="text-xs font-extrabold text-slate-500">
              검색 결과: <span className="text-amber-600 font-black">{filteredRows.length}</span>명
            </div>
          </div>

          {/* 6. 데이터 테이블 */}
          <div className="overflow-x-auto">
            <Table className="text-xs border-collapse">
              <TableHeader className="bg-slate-100/70 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-center font-bold w-12 py-2.5">번호</TableHead>
                  <TableHead className="text-center font-bold w-24">매칭 상태</TableHead>
                  <TableHead className="text-center font-bold w-36">엑셀 기재 학적</TableHead>
                  <TableHead className="text-center font-bold w-36">DB 매칭 학적</TableHead>
                  <TableHead className="font-bold min-w-[200px]">🏃 운동부·관악부 이수 내역</TableHead>
                  <TableHead className="font-bold min-w-[240px]">🏆 교내외대회 실적 (입상/참가)</TableHead>
                  <TableHead className="text-center font-bold w-24">예체능점수</TableHead>
                  <TableHead className="text-center font-bold w-24">대회점수</TableHead>
                  <TableHead className="text-center font-bold w-24 text-amber-800 bg-amber-50/50">합계(10점)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400 font-medium">
                      조건에 일치하는 학생 데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, idx) => (
                    <TableRow
                      key={row.rowKey}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.matchStatus === 'unmatched'
                          ? 'bg-rose-50/20'
                          : row.matchStatus === 'ambiguous'
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <TableCell className="text-center font-medium text-slate-400 py-3">{idx + 1}</TableCell>

                      {/* 매칭 상태 배지 및 동명이인 선택 */}
                      <TableCell className="text-center">
                        {row.matchStatus === 'matched' ? (
                          <div className="space-y-1">
                            <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold px-2 py-0.5 rounded-md">
                              ✅ 매칭완료
                            </Badge>
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  setMatchingTarget({
                                    rowKey: row.rowKey,
                                    excelStudentName: row.excelStudentName,
                                    excelGrade: row.excelGrade,
                                    excelMajor: row.excelMajor,
                                    excelClassNumber: row.excelClassNumber,
                                    excelStudentNumber: row.excelStudentNumber,
                                    unmatchedReason: row.unmatchedReason,
                                    currentSelectedStudentId: row.studentId,
                                  })
                                }
                                className="text-[9px] text-slate-400 hover:text-amber-700 underline font-medium cursor-pointer"
                              >
                                학적 변경
                              </button>
                            </div>
                          </div>
                        ) : row.matchStatus === 'ambiguous' ? (
                          <div className="space-y-1">
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md">
                              ⚠️ 동명이인
                            </Badge>
                            <div className="flex items-center gap-1 justify-center">
                              <Select
                                value={row.selectedStudentId || 'none'}
                                onValueChange={(val) => {
                                  setManualSelections((prev) => ({ ...prev, [row.rowKey]: val }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-[10px] w-32 border-amber-300 bg-white">
                                  <SelectValue placeholder="학생 선택" />
                                </SelectTrigger>
                                <SelectContent className="text-xs">
                                  <SelectItem value="none">선택 안 함</SelectItem>
                                  {row.candidateStudents?.map((cand) => (
                                    <SelectItem key={cand.id} value={cand.id}>
                                      {cand.student_name} ({baseYear - cand.graduation_year + 4}학년 {cand.class_info}반 {cand.student_number}번)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setMatchingTarget({
                                    rowKey: row.rowKey,
                                    excelStudentName: row.excelStudentName,
                                    excelGrade: row.excelGrade,
                                    excelMajor: row.excelMajor,
                                    excelClassNumber: row.excelClassNumber,
                                    excelStudentNumber: row.excelStudentNumber,
                                    unmatchedReason: row.unmatchedReason,
                                    currentSelectedStudentId: row.studentId,
                                  })
                                }
                                className="h-7 px-1.5 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-50"
                                title="전체 재학생 중 검색"
                              >
                                <Search className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge className="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md">
                              ⚠️ 불일치
                            </Badge>
                            <div className="text-[10px] text-rose-600 font-bold max-w-[120px] truncate" title={row.unmatchedReason}>
                              {row.unmatchedReason}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMatchingTarget({
                                  rowKey: row.rowKey,
                                  excelStudentName: row.excelStudentName,
                                  excelGrade: row.excelGrade,
                                  excelMajor: row.excelMajor,
                                  excelClassNumber: row.excelClassNumber,
                                  excelStudentNumber: row.excelStudentNumber,
                                  unmatchedReason: row.unmatchedReason,
                                  currentSelectedStudentId: row.studentId,
                                })
                              }
                              className="h-6 px-2 text-[10px] font-bold border-rose-300 text-rose-700 bg-white hover:bg-rose-50 rounded-md gap-1 cursor-pointer"
                            >
                              <Search className="h-2.5 w-2.5" />
                              <span>수동 학생 매칭</span>
                            </Button>
                          </div>
                        )}
                      </TableCell>

                      {/* 엑셀 기재 학적 */}
                      <TableCell className="text-center">
                        <div className="font-bold text-slate-800">{row.excelStudentName}</div>
                        <div className="text-[10px] text-slate-500">
                          {row.excelGrade ? `${row.excelGrade}학년 ` : ''}
                          {row.excelMajor || ''} {row.excelClassNumber ? `${row.excelClassNumber}반` : ''} {row.excelStudentNumber ? `${row.excelStudentNumber}번` : ''}
                        </div>
                      </TableCell>

                      {/* DB 매칭 학적 */}
                      <TableCell className="text-center">
                        {row.studentId ? (
                          <>
                            <div className="font-black text-slate-900">{row.studentName}</div>
                            <div className="text-[10px] text-emerald-700 font-bold">
                              {row.currentGrade}학년 {row.currentMajor} {row.currentClass}반 {row.currentNumber}번
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">-</span>
                        )}
                      </TableCell>

                      {/* 운동부/관악부 참여 내역 */}
                      <TableCell>
                        {Object.keys(row.artsSports).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.artsSports).map(([term, dept]) => (
                              <span
                                key={term}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                              >
                                <span className="text-[9px] font-black px-1 rounded bg-amber-200 text-amber-900">{term}</span>
                                <span>{dept}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-normal">미참여</span>
                        )}
                      </TableCell>

                      {/* 교내외대회 실적 */}
                      <TableCell>
                        {row.contestList.length > 0 ? (
                          <div className="space-y-1 max-w-[280px]">
                            {row.contestList.map((c, i) => (
                              <div
                                key={i}
                                className="text-[10px] leading-tight flex items-center justify-between gap-1 p-1 rounded bg-slate-50 border border-slate-200"
                              >
                                <div className="truncate font-medium text-slate-700">
                                  <span className="font-bold text-slate-900 mr-1">[{c.category || '교내대회'}]</span>
                                  {c.title}
                                </div>
                                <Badge
                                  className={`text-[9px] font-extrabold px-1 py-0 shrink-0 ${
                                    c.type === 'award'
                                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {c.award || (c.type === 'award' ? '입상(1.0점)' : '참가(0.5점)')}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-normal">실적 없음</span>
                        )}
                      </TableCell>

                      {/* 예체능 점수 */}
                      <TableCell className="text-center font-bold text-amber-800">
                        {row.artsSportsScore}점
                        <div className="text-[9px] text-slate-400 font-normal">({row.artsSportsSemesters}학기)</div>
                      </TableCell>

                      {/* 대회 점수 */}
                      <TableCell className="text-center font-bold text-purple-800">
                        {row.contestScore}점
                        <div className="text-[9px] text-slate-400 font-normal">
                          (입상{row.contestAwardCount} / 참가{row.contestParticipateCount})
                        </div>
                      </TableCell>

                      {/* 합계 점수 */}
                      <TableCell className="text-center font-black text-amber-900 bg-amber-50/50 text-sm">
                        {row.totalArtsContestScore}점
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 수동 학생 매칭 검색 모달 */}
      <ManualStudentMatchingDialog
        isOpen={!!matchingTarget}
        onClose={() => setMatchingTarget(null)}
        target={matchingTarget}
        activeStudents={activeStudents}
        baseYear={baseYear}
        onSelectStudent={(rowKey, studentId) => {
          setManualSelections((prev) => ({ ...prev, [rowKey]: studentId }));
          toast({
            title: '수동 매칭 완료',
            description: '선택한 DB 재학생으로 실적이 정상 연결되었습니다.',
          });
        }}
        onResetMatching={(rowKey) => {
          setManualSelections((prev) => ({ ...prev, [rowKey]: 'none' }));
          toast({
            title: '매칭 제외 처리',
            description: '해당 행의 매칭이 해제되었습니다.',
          });
        }}
      />

      {/* 등록 내역 관리 및 삭제 모달 */}
      <DeleteMyRecordsDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        category="arts_contest"
        categoryTitle="예체능 & 교내외 대회실적"
        isAdmin={isAdmin}
        onSuccess={async () => {
          await ensureMatchingData(true);
          if (onImportSuccess) onImportSuccess();
        }}
      />
    </div>
  );
}

