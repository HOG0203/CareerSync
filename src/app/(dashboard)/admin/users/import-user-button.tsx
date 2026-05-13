'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, Download, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { bulkCreateUsers } from './actions';
import * as XLSX from 'xlsx';

export function ImportUserButton() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsPending(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // JSON으로 변환 (헤더 기준)
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast({ variant: 'destructive', title: '데이터 없음', description: '엑셀 파일에 유효한 데이터가 없습니다.' });
          setIsPending(false);
          return;
        }

        // 데이터 매핑 및 검증
        const users = jsonData.map(row => ({
          username: String(row['아이디'] || row['ID'] || '').trim(),
          fullName: String(row['성명'] || row['이름'] || '').trim(),
          role: String(row['권한'] || '').trim(), // '관리자' 또는 '교직원'
        })).filter(u => u.username && u.role);

        if (users.length === 0) {
          toast({ variant: 'destructive', title: '형식 오류', description: '필수 항목(아이디, 권한)이 누락되었거나 컬럼명이 일치하지 않습니다.' });
          setIsPending(false);
          return;
        }

        const result = await bulkCreateUsers(users);
        
        setIsPending(false);
        if (result.error) {
          toast({ variant: 'destructive', title: '업로드 실패', description: result.error });
        } else {
          const successCount = result.count || 0;
          const failureCount = result.failures?.length || 0;
          
          if (failureCount > 0) {
            toast({ 
              title: '일괄 업로드 완료 (부분 성공)', 
              description: `${successCount}개 계정 생성 성공, ${failureCount}개 실패.`,
              variant: 'default'
            });
            console.warn('실패 내역:', result.failures);
          } else {
            toast({ title: '업로드 성공', description: `${successCount}개의 계정이 생성되었습니다.` });
          }
          
          setIsOpen(false);
          setSelectedFile(null);
        }
      } catch (error) {
        console.error('Excel parse error:', error);
        toast({ variant: 'destructive', title: '파일 오류', description: '엑셀 파일을 읽는 중 오류가 발생했습니다.' });
        setIsPending(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { '아이디': 'teacher1', '성명': '홍길동', '권한': '교직원' },
      { '아이디': 'admin2', '성명': '김철수', '권한': '관리자' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, '사용자_일괄등록_양식.xlsx');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-bold gap-2 border-blue-200 text-blue-600 hover:bg-blue-50">
          <FileUp className="h-4 w-4" /> 엑셀 일괄 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl flex flex-col">
        <DialogHeader className="p-6 bg-slate-900 text-white">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <FileUp className="h-6 w-6 text-blue-400" />
            사용자 일괄 등록
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            엑셀 파일을 업로드하여 여러 계정을 한 번에 생성합니다.<br />
            초기 비밀번호는 <span className="font-bold text-blue-600 underline">123123</span>으로 설정됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="space-y-0.5">
                <p className="text-sm font-bold">1. 전용 양식 다운로드</p>
                <p className="text-[11px] text-slate-500">지정된 형식으로 데이터를 작성하세요.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={downloadTemplate} className="h-8 text-xs font-bold gap-1.5">
                <Download className="h-3.5 w-3.5" /> 양식 받기
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold px-1">2. 파일 선택 (.xlsx)</p>
              <div className="relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  disabled={isPending}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={cn(
                  "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-colors",
                  selectedFile ? "border-blue-400 bg-blue-50/30" : "border-slate-200 group-hover:border-slate-300 bg-slate-50/50"
                )}>
                  <FileUp className={cn("h-8 w-8 mb-1", selectedFile ? "text-blue-500" : "text-slate-300")} />
                  <p className="text-xs font-medium text-slate-500">
                    {selectedFile ? selectedFile.name : "클릭하거나 파일을 여기로 드래그하세요"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-amber-800">주의사항</p>
              <ul className="text-[10px] text-amber-700/80 list-disc list-inside leading-relaxed">
                <li>아이디와 권한(관리자/교직원)은 필수입니다.</li>
                <li>이미 존재하는 아이디는 생성되지 않고 건너뜁니다.</li>
                <li>한 번에 최대 100명까지 등록을 권장합니다.</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending} className="rounded-xl">취소</Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isPending}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl font-bold min-w-[120px]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : '업로드 시작'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
