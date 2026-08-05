'use client';

import * as React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  Settings, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { importUploadedCertificates } from './actions';
import { useRouter } from 'next/navigation';

interface ParsedClassPreview {
  fileName: string;
  major: string;
  grade: number;
  classInfo: string;
  studentCerts: Record<string, string[]>;
  totalStudents: number;
  totalCerts: number;
  rawRows: any[][];
}

// 브라우저 내 파싱을 위한 로컬 헬퍼 함수
function parseNeisCertificates(rawRows: any[][]) {
  // 1. 학과/학년/반 감지 (모든 행 탐색)
  let major = '';
  let grade = 0;
  let classInfo = '';
  let classRowIndex = -1;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    
    const classStr = row.find((cell: any) => typeof cell === 'string' && cell.includes('학년')) || '';
    const classMatch = classStr.match(/(?:공업계\s+)?([가-힣]+)\s+(\d)학년?\s+(\d+)반?/);
    if (classMatch) {
      major = classMatch[1].trim();
      grade = parseInt(classMatch[2]);
      classInfo = classMatch[3] + '반';
      classRowIndex = i;
      break;
    }
  }

  if (classRowIndex === -1) {
    throw new Error('학과 및 학년 반 정보를 감지할 수 없습니다. (예: 스마트전기과 3학년 1반)');
  }

  // 2. 헤더 행 감지
  let headerRowIndex = -1;
  for (let i = classRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    const hasNumberHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '번호');
    const hasNameHeader = row.some((cell: any) => typeof cell === 'string' && cell.replace(/\s+/g, '') === '성명');
    if (hasNumberHeader || hasNameHeader) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = classRowIndex + 1; // 폴백
  }

  // 3. 학생별 자격증 정보 수집
  const studentCerts: Record<string, string[]> = {};
  let currentNum = '';
  let currentName = '';

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const num = row[0];
    const name = row[1];
    const type = row[2]?.toString().trim();
    const certName = row[3]?.toString().trim();

    if (type !== '자격증') continue;

    const hasValidNumber = num !== null && num !== undefined && num !== '' && !isNaN(Number(num));
    if (hasValidNumber) {
      currentNum = num.toString().trim();
      currentName = name ? name.toString().trim() : '';
    }

    if (currentName && certName && certName !== '') {
      if (!studentCerts[currentName]) {
        studentCerts[currentName] = [];
      }
      if (!studentCerts[currentName].includes(certName)) {
        studentCerts[currentName].push(certName);
      }
    }
  }

  return { major, grade, classInfo, studentCerts };
}

export function CertificateImportModal() {
  const [open, setOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [previews, setPreviews] = React.useState<ParsedClassPreview[]>([]);
  const [expandedIndices, setExpandedIndices] = React.useState<Record<number, boolean>>({});
  const [importResult, setImportResult] = React.useState<{
    successCount: number;
    skippedCount: number;
    errors: string[] | null;
  } | null>(null);
  
  const { toast } = useToast();
  const router = useRouter();

  // 결과 리셋
  React.useEffect(() => {
    if (!open) {
      setPreviews([]);
      setExpandedIndices({});
      setImportResult(null);
      setIsProcessing(false);
    }
  }, [open]);

  // 다중 파일 선택 및 브라우저 파싱 (미리보기 빌드)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setImportResult(null);
    const newPreviews: ParsedClassPreview[] = [];

    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      try {
        const fileData = await new Promise<any[][]>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = new Uint8Array(event.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
              resolve(rawRows);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('파일 읽기 실패'));
          reader.readAsArrayBuffer(file);
        });

        const parsed = parseNeisCertificates(fileData);
        const totalStudents = Object.keys(parsed.studentCerts).length;
        const totalCerts = Object.values(parsed.studentCerts).reduce((sum, certs) => sum + certs.length, 0);

        newPreviews.push({
          fileName: file.name,
          major: parsed.major,
          grade: parsed.grade,
          classInfo: parsed.classInfo,
          studentCerts: parsed.studentCerts,
          totalStudents,
          totalCerts,
          rawRows: fileData
        });

      } catch (err: any) {
        toast({
          variant: "destructive",
          title: `${file.name} 분석 실패`,
          description: err.message || "올바른 NEIS 자격증 엑셀 규격이 아닙니다.",
        });
      }
    }

    setPreviews(prev => [...prev, ...newPreviews]);
    setIsProcessing(false);
    // 파일 input 값 리셋하여 동일 파일 재선택 가능하게 함
    e.target.value = '';
  };

  // 상세 보기 토글
  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // 대기 목록 개별 삭제
  const removePreview = (idxToRemove: number) => {
    setPreviews(prev => prev.filter((_, idx) => idx !== idxToRemove));
    setExpandedIndices(prev => {
      const updated = { ...prev };
      delete updated[idxToRemove];
      return updated;
    });
  };

  // 미리보기 데이터 데이터베이스 반영
  const handleApplyImport = async () => {
    if (previews.length === 0) return;
    setIsProcessing(true);
    
    let totalSuccess = 0;
    let totalSkipped = 0;
    let allErrors: string[] = [];

    for (const preview of previews) {
      try {
        const res = await importUploadedCertificates(preview.rawRows);
        if (res.success) {
          totalSuccess += res.successCount || 0;
          totalSkipped += res.skippedCount || 0;
          if (res.errors) {
            allErrors = [...allErrors, ...res.errors];
          }
        } else {
          allErrors.push(`[${preview.fileName}] 업로드 실패: ${res.error}`);
          totalSkipped += preview.totalStudents;
        }
      } catch (e: any) {
        allErrors.push(`[${preview.fileName}] 서버 오류: ${e.message}`);
        totalSkipped += preview.totalStudents;
      }
    }

    setImportResult({
      successCount: totalSuccess,
      skippedCount: totalSkipped,
      errors: allErrors.length > 0 ? allErrors : null
    });

    setPreviews([]);
    setExpandedIndices({});
    setIsProcessing(false);

    toast({
      title: "일괄 반영 완료",
      description: `성공: ${totalSuccess}명, 미매칭/오류: ${totalSkipped}명`,
    });
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 sm:gap-2 shadow-lg shadow-indigo-200 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-10 whitespace-nowrap shrink-0">
          <FileUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">자격증 데이터 업로드</span>
          <span className="sm:hidden">자격증 업로드</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl flex flex-col p-0 border-none shadow-2xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors overflow-hidden">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">자격증 일괄 등록 시스템</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-medium mt-1">
                여러 개의 NEIS 자격증 엑셀 파일을 가져와 미리 확인하고 일괄 등록합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* 가이드 안내 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex gap-3 text-slate-600">
            <AlertCircle className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">NEIS 자격증 엑셀 파일 업로드 가이드</p>
              <p className="text-[11px] leading-relaxed text-slate-500">
                • 여러 개의 엑셀 파일을 마우스 드래그나 Shift 키를 이용해 **한꺼번에 여러 개 선택하여 업로드**할 수 있습니다.<br />
                • 업로드 시 DB에 바로 저장되지 않고, 학급명과 학생별 파싱된 자격증 내역을 **먼저 보여주는 미리보기 기능**이 제공됩니다.
              </p>
            </div>
          </div>

          {/* 파일 uploader 카드 */}
          <div className="border border-slate-200 bg-slate-50/10 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileUp className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-900">
                자격증 엑셀 파일 선택
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-500 max-w-md">
                개인 컴퓨터에서 NEIS 양식 엑셀 파일(기계1-3, 전기3-1 등)을 불러옵니다.
              </p>
            </div>

            <div className="relative w-full max-w-xs">
              <input 
                type="file" 
                multiple
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden" 
                id="excel-file-uploader" 
              />
              <label 
                htmlFor="excel-file-uploader"
                className={`w-full h-11 border-2 border-dashed rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer transition-colors ${
                  isProcessing
                    ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" 
                    : "border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    엑셀 파일 분석 중...
                  </span>
                ) : (
                  "컴퓨터에서 복수 파일 선택"
                )}
              </label>
            </div>
          </div>

          {/* 미리보기 리스트 */}
          {previews.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-slate-700">
                  업로드 대기 리스트 ({previews.length}개 파일)
                </span>
                <span className="text-[10px] text-slate-400 font-medium">적용하기 버튼을 누르면 최종 DB에 병합 반영됩니다.</span>
              </div>

              <div className="space-y-3">
                {previews.map((preview, idx) => (
                  <div key={idx} className="border border-slate-200/80 rounded-xl p-4 bg-white hover:shadow-sm transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-black text-slate-800">{preview.fileName}</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {preview.major} • {preview.grade}학년 {preview.classInfo}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                          학생 {preview.totalStudents}명
                        </span>
                        <span className="text-[10px] font-black bg-amber-100/60 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                          자격증 {preview.totalCerts}건
                        </span>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleExpand(idx)}
                          className="h-7 px-1.5 hover:bg-slate-100 text-slate-500 rounded-md gap-0.5 text-[10px] font-bold"
                        >
                          {expandedIndices[idx] ? (
                            <>
                              접기
                              <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              상세보기
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </Button>

                        <button 
                          onClick={() => removePreview(idx)}
                          className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {/* 학생별 자격증 상세 미리보기 */}
                    {expandedIndices[idx] && (
                      <div className="mt-3 border-t pt-3 text-left space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar bg-slate-50/50 p-3 rounded-lg">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">실제 파싱된 자격증 내역 미리보기</p>
                        {Object.entries(preview.studentCerts).map(([studentName, certs]) => (
                          <div key={studentName} className="flex justify-between items-start py-1 border-b border-slate-200/40 last:border-none text-[11px]">
                            <span className="font-bold text-slate-700 w-16 shrink-0">{studentName}</span>
                            <div className="flex flex-wrap gap-1 justify-end max-w-xl">
                              {certs.map((c, i) => (
                                <span key={i} className="bg-white border text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none whitespace-nowrap">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 일괄 적용 제출 버튼 영역 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setPreviews([]); setExpandedIndices({}); }}
                  className="font-bold text-xs h-9 px-4 border-slate-200"
                >
                  대기 목록 전체 비우기
                </Button>
                <Button 
                  onClick={handleApplyImport}
                  disabled={isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 px-5 text-xs gap-1.5 shadow-md shadow-indigo-100"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      DB 반영 저장 중...
                    </>
                  ) : (
                    "대기 리스트 전체 DB 반영하기"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 업로드 결과 표시 */}
          {importResult && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in-50 duration-200">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-black text-xs text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  최종 반영 결과 리포트
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  성공: {importResult.successCount}명 / 실패·보류: {importResult.skippedCount}명
                </span>
              </div>
              <div className="p-4 space-y-3 bg-slate-50/30">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">성공 학생 수</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">{importResult.successCount}명</p>
                  </div>
                  <div className="bg-white border rounded-lg p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">실패/미매칭 학생 수</p>
                    <p className="text-xl font-black text-rose-500 mt-1">{importResult.skippedCount}명</p>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-rose-600">미매칭/오류 상세 내역 (최대 10건):</p>
                    <div className="bg-white border border-rose-100 rounded-lg p-3 max-h-[150px] overflow-y-auto text-[10px] text-slate-600 space-y-1 custom-scrollbar">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="flex gap-1.5 items-start text-left leading-normal">
                          <span className="text-rose-400 shrink-0 font-bold">•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <p className="text-[9px] text-slate-400 italic text-center mt-2">외 {importResult.errors.length - 10}건의 내역이 더 있습니다.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
