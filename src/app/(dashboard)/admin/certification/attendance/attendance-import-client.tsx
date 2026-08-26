'use client';

import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
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
  const { toast } = useToast();

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
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

  const handleApply = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    try {
      const result = await uploadStudentAttendance(parsedData, baseYear);
      if (result.error) {
        toast({ variant: "destructive", title: "저장 실패", description: result.error });
      } else {
        toast({ title: "저장 완료", description: `${result.count}건의 출결 데이터를 저장했습니다.` });
        setParsedData([]);
        setFileNames([]);
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
      <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center text-indigo-600">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-slate-800">NEIS 출결 엑셀 파일 선택</h4>
          <p className="text-[11px] text-slate-500 max-w-md">컴퓨터에서 출결 엑셀 파일(.xlsx, .xls)을 가져옵니다. 다중 선택 가능합니다.</p>
        </div>

        <div className="flex items-center justify-center pt-1">
          <input 
            type="file" 
            id="xlsx-upload-attn" 
            className="hidden" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
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
    </div>
  );
}
