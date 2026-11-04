'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  FileUp, 
  AlertCircle, 
  Loader2, 
  User, 
  Trash2,
  Info,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  uploadStudentAttendance, 
  matchStudentsForAttendance, 
  deleteAllStudentAttendance,
  ParsedAttendanceData 
} from './actions';
import { cn } from '@/lib/utils';

export function AttendanceImportClient({ baseYear, onSuccess }: { baseYear: number; onSuccess?: () => void }) {
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<ParsedAttendanceData[]>([]);
  const [studentMatchMap, setStudentMatchMap] = React.useState<Record<string, { id: string; major: string; classInfo: string; gradYear: number }>>({});
  const [fileNames, setFileNames] = React.useState<string[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [importReport, setImportReport] = React.useState<{
    updatedCount: number;
    skippedCount: number;
    skippedStudents: string[];
  } | null>(null);
  const [isReportOpen, setIsReportOpen] = React.useState(false);

  const handleDeleteAll = async () => {
    if (!confirm('정말로 모든 학생의 출결 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    setIsDeleting(true);
    try {
      const res = await deleteAllStudentAttendance();
      if (res.success) {
        toast({ title: "초기화 완료", description: "출결 데이터가 모두 삭제되었습니다." });
        setParsedData([]);
        setFileNames([]);
        onSuccess?.();
      } else {
        toast({ variant: "destructive", title: "삭제 실패", description: res.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버 통신 중 오류가 발생했습니다." });
    } finally {
      setIsDeleting(false);
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsParsing(true);
    const newFileNames = Array.from(files).map(f => f.name);
    setFileNames(prev => Array.from(new Set([...prev, ...newFileNames])));

    const allNewRecords: ParsedAttendanceData[] = [];

    try {
      for (let f = 0; f < files.length; f++) {
        const file = files[f];
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        let fileMajor = '';
        let fileClass = '';
        let fileGrade = 3;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const rowText = (rawRows[i]?.join(' ') || '').replace(/\s+/g, '');
          const classMatch = rowText.match(/([가-힣]+)(\d)학년?-?(\d+)반?/);
          if (classMatch) {
            fileMajor = classMatch[1].trim();
            fileGrade = parseInt(classMatch[2]) || 3;
            fileClass = classMatch[3].trim();
            break;
          } else {
            const gradeMatch = rowText.match(/(\d)학년/);
            if (gradeMatch) {
              fileGrade = parseInt(gradeMatch[1]) || 3;
            }
          }
        }

        let currentStudentName = '';
        let currentStudentNumber = '';

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length < 4) continue;

          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();
          const col2 = String(row[2] || '').trim(); 
          const col3 = String(row[3] || '').trim(); 

          const isHeaderRow = col0 === '번호' || col1 === '성명' || col2 === '학년' || col2 === '학기' || col0.includes('/') || col1.includes('학년');
          const isCategoryHeader = col3 === '수업일수' || col1 === '소계' || col1 === '합계';
          if (isHeaderRow || isCategoryHeader) continue;

          const hasValidNumber = col0 !== '' && !isNaN(Number(col0));
          if (hasValidNumber) {
            currentStudentNumber = col0;
            if (col1 !== '') {
              currentStudentName = col1.replace(/\s+/g, '');
            }
          }

          const gradeObtained = parseInt(col2);
          const schoolDays = parseInt(col3);

          if (currentStudentName && !isNaN(gradeObtained) && [1, 2, 3].includes(gradeObtained) && !isNaN(schoolDays) && schoolDays > 0) {
            allNewRecords.push({
              studentName: currentStudentName,
              studentNumber: currentStudentNumber,
              gradeObtained,
              semester: 1, 
              schoolDays,
              absentDisease: parseInt(row[4]) || 0,
              absentUnexcused: parseInt(row[5]) || 0,
              absentOther: parseInt(row[6]) || 0,
              lateDisease: parseInt(row[7]) || 0,
              lateUnexcused: parseInt(row[8]) || 0,
              lateOther: parseInt(row[9]) || 0,
              earlyDisease: parseInt(row[10]) || 0,
              earlyUnexcused: parseInt(row[11]) || 0,
              earlyOther: parseInt(row[12]) || 0,
              outDisease: parseInt(row[13]) || 0,
              outUnexcused: parseInt(row[14]) || 0,
              outOther: parseInt(row[15]) || 0,
              remarks: row[16]?.toString() || '',
              major: fileMajor,
              classInfo: fileClass,
              currentGrade: fileGrade
            });
          }
        }
      }

      const updatedTotalData = [...parsedData, ...allNewRecords];
      
      const uniqueKeys = Array.from(new Set(updatedTotalData.map(s => `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}_${s.currentGrade}`)))
        .map(k => {
          const parts = k.split('_');
          return { major: parts[0], classInfo: parts[1], number: parts[2], name: parts[3], currentGrade: parseInt(parts[4]) };
        });

      const matchResult = await matchStudentsForAttendance(uniqueKeys, baseYear);
      const newMatchMap = matchResult.matchMap || {};
      setStudentMatchMap(newMatchMap);

      const finalData = updatedTotalData.map(s => {
        const key = `${s.major}_${s.classInfo}_${s.studentNumber}_${s.studentName}`;
        return { ...s, studentId: newMatchMap[key]?.id };
      });

      setParsedData(finalData);
      setIsParsing(false);
      toast({ title: "파일 분석 완료", description: `총 ${files.length}개의 출결 파일을 성공적으로 읽어왔습니다.` });
    } catch (error) {
      console.error('Parsing error:', error);
      setIsParsing(false);
      toast({ variant: "destructive", title: "파일 분석 실패", description: "엑셀 파일을 읽는 중 오류가 발생했습니다." });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleApply = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    try {
      const result = await uploadStudentAttendance(parsedData, baseYear);
      if (result.error) {
        toast({ variant: "destructive", title: "저장 실패", description: result.error });
      } else {
        if (result.skippedCount && result.skippedCount > 0) {
          setImportReport({
            updatedCount: result.count || 0,
            skippedCount: result.skippedCount,
            skippedStudents: result.skippedStudents || []
          });
          setIsReportOpen(true);
          toast({
            title: '출결 데이터 반영 완료 (일부 보류 발생)',
            description: `성공 ${result.count}건, 미매칭 보류 ${result.skippedCount}명입니다. 미반영 내역 팝업을 확인해주세요.`
          });
        } else {
          toast({ 
            title: "출결 일괄 등록 완료 🎉", 
            description: `총 ${result.count}건의 출결 데이터가 DB에 성공적으로 반영되었습니다.` 
          });
          setParsedData([]);
          setFileNames([]);
        }
        onSuccess?.();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "오류 발생", description: "서버와 통신 중 문제가 발생했습니다." });
    } finally {
      setIsUploading(false);
    }
  };

  const groupedData = React.useMemo(() => {
    const groups: Record<string, { studentName: string; studentNumber: string; major: string; classInfo: string; items: ParsedAttendanceData[] }> = {};
    
    parsedData.forEach(item => {
      const key = `${item.major}_${item.classInfo}_${item.studentNumber}_${item.studentName}`;
      if (!groups[key]) {
        groups[key] = {
          studentName: item.studentName,
          studentNumber: item.studentNumber,
          major: item.major,
          classInfo: item.classInfo,
          items: []
        };
      }
      if (!groups[key].items.find(existing => existing.gradeObtained === item.gradeObtained)) {
        groups[key].items.push(item);
      }
    });

    return Object.entries(groups).map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => {
        if (a.major !== b.major) return a.major.localeCompare(b.major);
        if (a.classInfo !== b.classInfo) return parseInt(a.classInfo) - parseInt(b.classInfo);
        return parseInt(a.studentNumber) - parseInt(b.studentNumber);
      });
  }, [parsedData]);

  return (
    <div className="p-5 sm:p-6 space-y-5">
      {/* 통일된 가이드 안내 카드 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs text-slate-700">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
          <Info className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h5 className="text-sm sm:text-base font-extrabold text-slate-900">NEIS 출결 엑셀 파일 업로드 가이드</h5>
          <div className="text-xs sm:text-sm leading-relaxed text-slate-700 space-y-1 font-medium">
            <p>• <strong className="text-slate-900 font-bold">출결 파일 다운 방법</strong>: NEIS &gt; 학생부 &gt; 학교생활기록부 &gt; 학생부 항목별 조회 &gt; 학반 선택 &gt; 출결상황 &gt; 출결상황 &gt; <span className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-xs font-bold text-slate-900 text-xs mx-0.5"><img src="/images/neis-floppy.png" alt="디스켓 아이콘" className="h-4 w-4 object-contain inline" /></span> 클릭 &gt; XLS data 클릭 &gt; 엑셀 파일 다운</p>
            <p>• 엑셀 파일(기계1-3, 전기3-1 등)을 <strong className="text-slate-900 font-bold">드래그앤드롭 또는 복수 선택</strong>하여 한꺼번에 업로드할 수 있습니다.</p>
            <p>• 업로드 즉시 학년별 출결 파싱 미리보기가 표시되며, <strong className="text-slate-900 font-bold">[대기 리스트 전체 DB 반영하기]</strong>를 클릭하여 반영합니다.</p>
          </div>
        </div>
      </div>

      {/* 통일된 파일 업로드 드롭존 영역 */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isParsing && !isUploading) setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isParsing && !isUploading) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (isParsing || isUploading) return;
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => {
          if (!isParsing && !isUploading) {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center space-y-3 cursor-pointer",
          isDragging 
            ? "border-indigo-500 bg-indigo-50/70 scale-[0.99] shadow-inner" 
            : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30"
        )}
      >
        <div className={cn(
          "h-12 w-12 rounded-2xl shadow-sm border flex items-center justify-center transition-all",
          isDragging ? "bg-indigo-600 text-white border-indigo-600 scale-110" : "bg-white border-slate-200/80 text-indigo-600"
        )}>
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-slate-800">
            {isDragging ? "여기에 파일을 놓아주세요!" : "NEIS 출결 엑셀 파일 선택 또는 드래그 앤 드롭"}
          </h4>
          <p className="text-[11px] text-slate-500 max-w-md">컴퓨터에서 출결 엑셀 파일(.xlsx, .xls)을 가져옵니다. 다중 선택 및 드래그 앤 드롭이 가능합니다.</p>
        </div>

        <div className="flex items-center justify-center pt-1" onClick={(e) => e.stopPropagation()}>
          <input 
            ref={fileInputRef}
            type="file" 
            id="xlsx-upload-attn" 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileInputChange} 
            disabled={isParsing || isUploading} 
            multiple 
          />
          <label 
            htmlFor="xlsx-upload-attn" 
            className={`inline-flex items-center gap-2 h-9 px-5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all ${
              isParsing || isUploading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            }`}
          >
            {isParsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                파일 분석 중...
              </>
            ) : (
              <>
                <FileUp className="h-3.5 w-3.5" />
                엑셀 파일 선택하기
              </>
            )}
          </label>
        </div>
      </div>

      {fileNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1 self-center">선택 파일 ({fileNames.length}개):</span>
          {fileNames.map((name, i) => (
            <Badge key={i} variant="outline" className="bg-white border-slate-200 text-slate-700 text-[10px] px-2 py-0.5">
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* 미리보기 리스트 */}
      {parsedData.length > 0 && (
        <div className="space-y-3 border border-slate-200 rounded-2xl p-4 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">학생 {groupedData.length}명 감지</Badge>
              <span className="text-xs font-bold text-slate-800">출결 미리보기 (정제 후)</span>
            </div>
            <Button 
              onClick={handleApply} 
              disabled={isUploading} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-5 rounded-xl text-xs gap-1.5 shadow-md shadow-emerald-100"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  DB 반영 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  대기 리스트 전체 DB 반영하기
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {groupedData.map((group) => {
              const matchKey = `${group.major}_${group.classInfo}_${group.studentNumber}_${group.studentName}`;
              const match = studentMatchMap[matchKey];
              const isMatched = !!match;

              return (
                <div key={group.key} className={cn("bg-white border rounded-xl shadow-xs overflow-hidden", isMatched ? "border-slate-200" : "border-rose-200 bg-rose-50/10")}>
                  <div className={cn("px-3.5 py-2.5 border-b flex items-center justify-between", isMatched ? "bg-slate-50/80" : "bg-rose-50/60")}>
                    <div className="flex items-center gap-2.5">
                      <User className={cn("h-4 w-4", isMatched ? "text-slate-400" : "text-rose-400")} />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{group.studentName}</span>
                        <Badge variant="outline" className="bg-white text-slate-600 text-[10px] px-1.5 py-0">{group.studentNumber}번</Badge>
                        {isMatched ? (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-2 py-0">
                            {match.gradYear}년 졸업예정
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] px-2 py-0">
                            DB 매칭 실패
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {group.items[0]?.currentGrade}학년 • {group.major.replace('공업계', '')} • {group.classInfo.replace('반', '')}반
                    </span>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-[10px] text-center border-collapse min-w-[500px]">
                      <thead className="bg-slate-50/50 text-slate-500 border-b">
                        <tr>
                          <th className="py-1.5 border-r w-14 font-bold">학년</th>
                          <th className="py-1.5 border-r text-rose-600 font-bold">미인정 (결석/지각/조퇴/결과)</th>
                          <th className="py-1.5 border-r text-blue-600 font-bold">질병 (결석/지각/조퇴/결과)</th>
                          <th className="py-1.5 border-r text-slate-600 font-bold">기타 (결석/지각/조퇴/결과)</th>
                          <th className="py-1.5 w-16 font-bold">수업일수</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.sort((a,b) => a.gradeObtained - b.gradeObtained).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 font-bold border-r text-slate-700">{item.gradeObtained}학년</td>
                            <td className="py-1.5 font-extrabold border-r text-rose-600">
                              {item.absentUnexcused} / {item.lateUnexcused} / {item.earlyUnexcused} / {item.outUnexcused}
                            </td>
                            <td className="py-1.5 font-bold border-r text-blue-600">
                              {item.absentDisease} / {item.lateDisease} / {item.earlyDisease} / {item.outDisease}
                            </td>
                            <td className="py-1.5 font-bold border-r text-slate-500">
                              {item.absentOther} / {item.lateOther} / {item.earlyOther} / {item.outOther}
                            </td>
                            <td className="py-1.5 font-medium text-slate-500">{item.schoolDays}일</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 미반영/보류 결과 안내 팝업 모달 */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-xl p-6 bg-white border border-slate-200 shadow-2xl rounded-3xl animate-in fade-in-50 zoom-in-95 duration-200">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertCircle className="h-5 w-5" />
              </span>
              <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">
                출결 데이터 일괄 업로드 결과 리포트
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
              업로드한 출결 엑셀 파일 중 시스템 학생 명부와 정상 매칭된 학생과 미매칭으로 보류된 학생 현황입니다.
            </DialogDescription>
          </DialogHeader>

          {/* 결과 통계 카드 */}
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-emerald-700">정상 반영 건수</span>
              <span className="text-2xl font-black text-emerald-800 mt-1">{importReport?.updatedCount}건</span>
            </div>
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-rose-700">미매칭 보류 학생 수</span>
              <span className="text-2xl font-black text-rose-700 mt-1">{importReport?.skippedCount}명</span>
            </div>
          </div>

          {/* 미매칭 보류 상세 명단 */}
          {importReport && importReport.skippedCount > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                  미반영 학생 명단 ({importReport.skippedCount}명)
                </span>
                <span className="text-[11px] text-slate-400">시스템 학생 명부와 불일치</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 max-h-[220px] overflow-y-auto space-y-2 divide-y divide-slate-100 custom-scrollbar">
                {importReport.skippedStudents.map((stStr, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] px-2 py-0.5 shrink-0">
                        미매칭
                      </Badge>
                      <span className="font-extrabold text-slate-800">{stStr}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 해결 가이드 안내 */}
              <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs space-y-2 mt-2 text-left">
                <p className="font-black text-blue-950 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  미반영 발생 원인 및 해결 가이드
                </p>
                <ul className="text-blue-900 text-[11px] leading-relaxed space-y-1.5 list-disc pl-4 font-medium">
                  <li>
                    <strong>학생 명부 미등록 (전입생 등)</strong>: 해당 학생이 시스템 학생 명부에 등록되어 있지 않은 경우 매칭되지 않습니다. <span className="font-bold underline text-blue-950">[학생 관리]</span> 또는 <span className="font-bold underline text-blue-950">[학생 등록/진급]</span> 메뉴에서 학생을 먼저 추가해주세요.
                  </li>
                  <li>
                    <strong>이름 표기 불일치 (괄호/오탈자/개명)</strong>: 나이스 엑셀에 학생 이름 뒤 괄호(예: 전입, 유예 등)나 한자, 오탈자가 기재되어 있는지 확인해주세요.
                  </li>
                  <li>
                    <strong>반 또는 번호 불일치</strong>: 학적 변동으로 반/번호가 DB와 다른 경우, 학생 관리에서 반/번호를 동일하게 수정한 뒤 다시 업로드하거나, <span className="font-bold underline text-blue-950">[출결 현황]</span> 또는 <span className="font-bold underline text-blue-950">[종합 인증평가]</span> 메뉴에서 해당 학생의 출결 정보를 수기로 직접 입력할 수 있습니다.
                  </li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              onClick={() => {
                setIsReportOpen(false);
                setParsedData([]);
                setFileNames([]);
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 rounded-xl"
            >
              확인 완료 (창 닫기)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
