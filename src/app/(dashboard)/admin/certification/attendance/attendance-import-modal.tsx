'use client';

import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileUp, CalendarCheck } from 'lucide-react';
import { AttendanceImportClient } from './attendance-import-client';

export function AttendanceImportModal({ baseYear }: { baseYear: number }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 sm:gap-2 shadow-lg shadow-indigo-200 text-xs sm:text-sm px-2.5 sm:px-4 h-8 sm:h-10 whitespace-nowrap shrink-0">
          <FileUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">출결 데이터 일괄 업로드</span>
          <span className="sm:hidden">출결 업로드</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-0 border-none shadow-2xl rounded-2xl overflow-hidden">
        {/* 통일된 상단 헤더 */}
        <DialogHeader className="p-4 sm:p-6 bg-white border-b border-slate-100 shrink-0 flex flex-row items-center justify-start text-left w-full">
          <div className="flex items-center gap-3.5 text-left justify-start">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 shadow-sm">
              <CalendarCheck className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex flex-col items-start text-left">
              <div className="flex items-center gap-2 text-left">
                <DialogTitle className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight text-left">출결 현황 일괄 업로드</DialogTitle>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200/60 text-xs px-2.5 py-0.5 rounded-md font-bold">NEIS 연동</Badge>
              </div>
              <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium mt-1 text-left">
                NEIS 출결 엑셀 파일(.xlsx, .xls)을 가져와 전교생 출결 현황을 자동 업로드합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {/* 내부 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <AttendanceImportClient baseYear={baseYear} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
