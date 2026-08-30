'use client';

// ==============================================================================
// src/app/(dashboard)/teaching-support/timetable/timetable-import-modal.tsx
// 전체 교사 시간표 엑셀 업로드 및 실시간 파싱 프리뷰 모달
// ==============================================================================

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Users, 
  Building2, 
  Clock, 
  Sparkles,
  CalendarCheck
} from 'lucide-react';
import { 
  parseTimetableExcel, 
  ParsedTimetableResult 
} from '@/lib/timetable/parser';
import { uploadTimetableExcel } from './actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TimetableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (result: ParsedTimetableResult) => void;
}

export function TimetableImportModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: TimetableImportModalProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [academicYear, setAcademicYear] = React.useState<number>(new Date().getFullYear());
  const [semester, setSemester] = React.useState<number>(2);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parsedPreview, setParsedPreview] = React.useState<ParsedTimetableResult | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setParsedPreview(null);
      setIsParsing(false);
      setIsUploading(false);
    }
  }, [isOpen]);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      // 파일명에서 학년도/학기 추론
      let inferredYear = academicYear;
      let inferredSem = semester;

      const yearMatch = file.name.match(/(\d{4})\s*학년도/);
      if (yearMatch) inferredYear = parseInt(yearMatch[1]);

      const semMatch = file.name.match(/([12])\s*학기/);
      if (semMatch) inferredSem = parseInt(semMatch[1]);

      setAcademicYear(inferredYear);
      setSemester(inferredSem);

      const result = parseTimetableExcel(buffer, inferredYear, inferredSem);
      setParsedPreview(result);

      toast({
        title: "시간표 파일 분석 완료",
        description: `교사 ${result.totalTeachers}명, ${result.totalClasses}개 학반(${result.totalSlots}개 수업 슬롯)이 확인되었습니다.`,
      });
    } catch (err: any) {
      console.error('Parsing error:', err);
      toast({
        title: "파일 분석 오류",
        description: err.message || "시간표 엑셀 파일 형식을 파싱하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setParsedPreview(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('academicYear', String(academicYear));
      formData.append('semester', String(semester));

      const res = await uploadTimetableExcel(formData);
      if (res.success && res.data) {
        toast({
          title: "시간표 등록 완료! 🎉",
          description: res.message || `${academicYear}학년도 ${semester}학기 시간표가 데이터베이스에 성공적으로 등록되었습니다.`,
        });
        onUploadSuccess(res.data);
        onClose();
      } else {
        toast({
          title: "시간표 등록 실패",
          description: res.error || "시간표 저장 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "서버 오류",
        description: err.message || "시간표 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] rounded-2xl p-0 overflow-hidden shadow-2xl border-0">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl text-blue-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                전체 교사 시간표 엑셀 업로드
              </DialogTitle>
              <DialogDescription className="text-blue-200/80 text-xs mt-0.5">
                로컬의 전체교사시간표 엑셀 파일을 업로드하여 시간표 DB를 일괄 구축합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5 bg-slate-50/50 max-h-[75vh] overflow-y-auto">
          {/* 학년도 및 학기 선택 */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">대상 학년도</Label>
              <Select 
                value={String(academicYear)} 
                onValueChange={v => setAcademicYear(parseInt(v))}
              >
                <SelectTrigger className="h-9 text-xs font-bold bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map(y => (
                    <SelectItem key={y} value={String(y)} className="text-xs font-bold">
                      {y}학년도
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">대상 학기</Label>
              <Select 
                value={String(semester)} 
                onValueChange={v => setSemester(parseInt(v))}
              >
                <SelectTrigger className="h-9 text-xs font-bold bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-xs font-bold">1학기</SelectItem>
                  <SelectItem value="2" className="text-xs font-bold">2학기</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 드래그 앤 드롭 영역 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
              isDragging 
                ? "border-blue-500 bg-blue-50/80 scale-[0.99]" 
                : "border-slate-300 bg-white hover:bg-slate-50/80 hover:border-blue-400"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-full">
              <UploadCloud className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {selectedFile ? selectedFile.name : '시간표 엑셀 파일을 이곳에 끌어다 놓거나 클릭하여 선택하세요'}
              </p>
              <p className="text-[11px] text-slate-400">
                지원 양식: <span className="font-semibold text-slate-600">2. 2026학년도 2학기 전체교사시간표.xlsx</span>
              </p>
            </div>
          </div>

          {/* 파싱 로딩 */}
          {isParsing && (
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-blue-700 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>엑셀 시간표 구조를 분석하고 있습니다...</span>
            </div>
          )}

          {/* 파싱 결과 미리보기 카드 */}
          {parsedPreview && (
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  파싱 분석 통계 (정상 확인됨)
                </span>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  {academicYear}학년도 {semester}학기
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg text-center border border-slate-100">
                  <span className="text-[10.5px] text-slate-500 font-bold block flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-indigo-600" /> 등록 교사
                  </span>
                  <span className="text-sm font-black text-slate-900">{parsedPreview.totalTeachers}명</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-center border border-slate-100">
                  <span className="text-[10.5px] text-slate-500 font-bold block flex items-center justify-center gap-1">
                    <Building2 className="h-3 w-3 text-emerald-600" /> 식별 학반
                  </span>
                  <span className="text-sm font-black text-slate-900">{parsedPreview.totalClasses}개 학반</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-center border border-slate-100">
                  <span className="text-[10.5px] text-slate-500 font-bold block flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3 text-blue-600" /> 총 수업 슬롯
                  </span>
                  <span className="text-sm font-black text-slate-900">{parsedPreview.totalSlots}교시</span>
                </div>
              </div>

              {/* 샘플 교사 프리뷰 칩 */}
              <div className="space-y-1 pt-1">
                <span className="text-[10.5px] text-slate-400 font-bold">포함된 교사 목록 (일부)</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-slate-50/80 rounded-lg border border-slate-100">
                  {parsedPreview.teachers.slice(0, 30).map(t => (
                    <span 
                      key={t.teacherName} 
                      className="text-[10.5px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 shadow-2xs"
                    >
                      {t.teacherName} {t.homeroomClass && <span className="text-indigo-600">({t.homeroomClass})</span>}
                    </span>
                  ))}
                  {parsedPreview.teachers.length > 30 && (
                    <span className="text-[10.5px] text-slate-400 font-medium px-1 self-center">
                      +{parsedPreview.teachers.length - 30}명 더 있음
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-slate-100/80 border-t flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedFile || !parsedPreview || isUploading || isParsing}
            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                DB에 등록 중...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                시간표 데이터베이스 등록
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
