'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { 
  parseNeisVolunteerWorkbook, 
  ParsedNeisVolunteerStudent,
  ParseVolunteerResult 
} from '@/lib/neis-volunteer-parser';
import { batchImportVolunteerAction } from '../actions';
import { DeleteMyRecordsDialog } from './delete-my-records-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  HeartHandshake, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  Loader2, 
  Trash2, 
  Save, 
  Info,
  Search,
  Sparkles,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VolunteerImportCardProps {
  isAdmin: boolean;
  userProfile: any;
  baseYear?: number;
  onImportSuccess?: () => void;
}

export function VolunteerImportCard({
  isAdmin,
  userProfile,
  baseYear = 2026,
  onImportSuccess,
}: VolunteerImportCardProps) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [files, setFiles] = React.useState<File[]>([]);
  const [parsedResults, setParsedResults] = React.useState<ParseVolunteerResult[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // 모든 파싱된 파일들의 학생 목록 합산
  const allParsedStudents = React.useMemo(() => {
    const list: ParsedNeisVolunteerStudent[] = [];
    parsedResults.forEach(r => {
      list.push(...r.students);
    });
    return list;
  }, [parsedResults]);

  // 검색 및 필터
  const filteredStudents = React.useMemo(() => {
    if (!search.trim()) return allParsedStudents;
    const q = search.toLowerCase().trim();
    return allParsedStudents.filter(s => 
      s.studentName.toLowerCase().includes(q) ||
      s.studentNumber.includes(q) ||
      s.classInfo.toLowerCase().includes(q) ||
      s.major.toLowerCase().includes(q)
    );
  }, [allParsedStudents, search]);

  // 통계
  const stats = React.useMemo(() => {
    const totalStudents = allParsedStudents.length;
    if (totalStudents === 0) return { totalStudents: 0, avgHours: 0, perfectScoreCount: 0, totalActivities: 0 };

    const totalHoursSum = allParsedStudents.reduce((acc, s) => acc + s.totalHours, 0);
    const avgHours = Math.round((totalHoursSum / totalStudents) * 10) / 10;
    const perfectScoreCount = allParsedStudents.filter(s => s.calculatedScore >= 5.0).length;
    const totalActivities = parsedResults.reduce((acc, r) => acc + r.totalActivities, 0);

    return { totalStudents, avgHours, perfectScoreCount, totalActivities };
  }, [allParsedStudents, parsedResults]);

  // 파일 선택 및 드롭 처리
  const handleFileChange = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsParsing(true);
    const fileArr = Array.from(selectedFiles).filter(f => 
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    if (fileArr.length === 0) {
      toast({
        variant: 'destructive',
        title: '지원하지 않는 파일 형식',
        description: '나이스 엑셀 파일(.xlsx, .xls)을 선택해 주세요.'
      });
      setIsParsing(false);
      return;
    }

    try {
      const newResults: ParseVolunteerResult[] = [];

      for (const file of fileArr) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const res = parseNeisVolunteerWorkbook(wb, file.name);
        newResults.push(res);
      }

      setFiles(prev => [...prev, ...fileArr]);
      setParsedResults(prev => [...prev, ...newResults]);

      toast({
        title: '나이스 엑셀 분석 완료',
        description: `${fileArr.length}개 파일에서 총 ${newResults.reduce((acc, r) => acc + r.students.length, 0)}명의 봉사활동 데이터를 추출했습니다.`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '파일 분석 실패',
        description: err.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.'
      });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setFiles([]);
    setParsedResults([]);
    setSearch('');
  };

  // 최종 DB 저장 실행
  const handleSaveToDatabase = async () => {
    if (allParsedStudents.length === 0) return;

    setIsSaving(true);
    try {
      const payload = allParsedStudents.map(s => ({
        grade: s.grade,
        classInfo: s.classInfo,
        major: s.major,
        studentNumber: s.studentNumber,
        studentName: s.studentName,
        schoolHours: s.schoolHours,
        outsideHours: s.outsideHours,
      }));

      const res = await batchImportVolunteerAction(payload);

      if (res.success) {
        toast({
          title: '봉사활동 일괄 등록 완료 🎉',
          description: `총 ${res.updatedCount}명의 학생 봉사활동 시간이 옥저인재인증제 DB에 성공적으로 반영되었습니다.`
        });
        handleClear();
        if (onImportSuccess) onImportSuccess();
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: res.error || '저장 중 오류가 발생했습니다.'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버와 통신 중 문제가 발생했습니다.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="border border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>나이스(NEIS) 봉사활동 엑셀 일괄 등록</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">
                    {baseYear}학년도 재학생 기준
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  나이스에서 다운로드한 「학교생활기록부 봉사활동상황」 엑셀 파일을 그대로 등록하여 점수를 자동 계산합니다.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-10 px-3.5 text-xs sm:text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 hover:border-rose-300 font-black rounded-xl gap-2 shadow-xs cursor-pointer transition-all"
                title="내가 등록한 봉사활동 데이터 목록을 확인하고 수정/삭제합니다"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>등록 내역 관리 (수정/삭제)</span>
              </Button>

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

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* 설명 알림창 */}
          <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-start gap-3 text-xs text-emerald-950 shadow-2xs">
            <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="leading-relaxed space-y-1">
              <p className="font-extrabold text-emerald-900 text-xs sm:text-sm">
                💡 나이스 다운로드 파일 100% 무변경 지원 (다중 파일 지원)
              </p>
              <p className="text-emerald-800 text-[11px] sm:text-xs">
                • 기관명에 <strong>(학교)</strong> 또는 <strong>대구공업고등학교</strong>가 포함된 활동은 <strong>교내 봉사시간(x0.025)</strong>으로, <strong>(개인)</strong> 또는 외부 기관은 <strong>교외 봉사시간(x0.05)</strong>으로 자동 분류 계산됩니다.
                <br />
                • 여러 반의 엑셀 파일을 한 번에 드래그하여 전교생을 동시에 일괄 등록할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 파일 업로드 드롭존 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFileChange(e.dataTransfer.files);
            }}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
              files.length > 0 
                ? "border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40" 
                : "border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx, .xls"
              onChange={(e) => handleFileChange(e.target.files)}
              className="hidden"
            />

            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              {isParsing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            <div>
              <p className="text-sm font-black text-slate-800">
                나이스 봉사활동 엑셀 파일들을 클릭하거나 드래그하여 업로드하세요
              </p>
              <p className="text-xs text-slate-500 mt-1">
                여러 학급의 엑셀 파일(.xlsx, .xls)을 동시에 선택할 수 있으며, 교내 및 교외 봉사시간이 자동 분류 계산됩니다.
              </p>
            </div>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-w-2xl">
                {files.map((f, i) => (
                  <Badge key={i} className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 gap-1.5 shadow-2xs">
                    <FileSpreadsheet className="h-3 w-3" />
                    <span>{f.name}</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 파싱 결과 미리보기 */}
          {allParsedStudents.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* 요약 KPI 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 block">총 분석 학생</span>
                  <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.totalStudents}명</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 block">총 봉사활동 레코드</span>
                  <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.totalActivities}건</span>
                </div>
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[11px] font-bold text-indigo-700 block">학생 평균 봉사시간</span>
                  <span className="text-xl font-black text-indigo-700 mt-0.5 block">{stats.avgHours}시간</span>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-700 block">만점(5점) 대상자</span>
                  <span className="text-xl font-black text-emerald-700 mt-0.5 block">{stats.perfectScoreCount}명</span>
                </div>
              </div>

              {/* 검색 및 테이블 헤더 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    추출된 학생별 봉사시간 및 인증 배점 미리보기 ({filteredStudents.length}명)
                  </h4>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="학생명, 학과, 반, 번호 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* 미리보기 테이블 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[420px] overflow-y-auto bg-white">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-100/90 sticky top-0 z-10">
                    <TableRow className="text-slate-700 font-bold text-xs">
                      <TableHead className="font-extrabold text-slate-800 w-[160px]">학생 정보</TableHead>
                      <TableHead className="font-extrabold text-slate-800 text-center w-[100px]">교내 봉사</TableHead>
                      <TableHead className="font-extrabold text-slate-800 text-center w-[100px]">교외 봉사</TableHead>
                      <TableHead className="font-extrabold text-slate-800 text-center w-[110px]">총 봉사시간</TableHead>
                      <TableHead className="font-extrabold text-slate-800 text-center w-[130px]">예상 인증점수</TableHead>
                      <TableHead className="font-extrabold text-slate-800 text-center">세부 내역</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((st, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{st.studentName} ({st.studentNumber}번)</span>
                            <span className="text-[11px] text-slate-500">{st.major} {st.classInfo} ({st.grade}학년)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-800">
                          {st.schoolHours}시간
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-800">
                          {st.outsideHours}시간
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-black text-emerald-700">{st.totalHours}시간</span>
                          <span className="text-[10px] text-slate-400 block">({st.activityCount}건)</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn(
                            "text-xs font-black px-2 py-0.5 shadow-2xs",
                            st.calculatedScore >= 5.0 ? "bg-emerald-600 text-white" : "bg-emerald-700 text-white"
                          )}>
                            {st.calculatedScore}점 / 5점
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-[11px]">
                          <span className="truncate max-w-[280px] inline-block">
                            {st.details?.map(d => `${d.content}(${d.hours}h)`).slice(0, 3).join(', ')}
                            {(st.details?.length || 0) > 3 && ` 외 ${(st.details?.length || 0) - 3}건`}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 하단 저장 바 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2 text-xs text-emerald-950 font-bold">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>총 {allParsedStudents.length}명의 학생 봉사활동 데이터를 저장할 준비가 되었습니다.</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    disabled={isSaving}
                    className="h-10 px-4 text-xs bg-white text-slate-700 font-bold rounded-xl border-slate-200 hover:bg-slate-50"
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveToDatabase}
                    disabled={isSaving}
                    className="h-10 px-5 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>DB 일괄 저장하기 ({allParsedStudents.length}명)</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteMyRecordsDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        category="volunteer"
        categoryTitle="나이스 봉사활동"
        isAdmin={isAdmin}
        onSuccess={() => {
          if (onImportSuccess) onImportSuccess();
        }}
      />
    </>
  );
}

