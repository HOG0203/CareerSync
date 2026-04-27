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
import { FileUp, Settings } from 'lucide-react';
import { AttendanceImportClient } from './attendance-import-client';

export function AttendanceImportModal({ baseYear }: { baseYear: number }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-lg shadow-indigo-200">
          <FileUp className="h-4 w-4" />
          출결 데이터 일괄 업로드
        </Button>
      </DialogTrigger>
      {/* max-h와 overflow-y-auto 설정을 강화하여 내부 스크롤이 반드시 작동하도록 수정 */}
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 border-none shadow-2xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors overflow-hidden">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">출결 관리 시스템 설정</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-medium mt-1">
                엑셀 파일을 업로드하여 전교생의 출결 현황을 일괄 업데이트합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {/* 내부 컨텐츠 영역에 독립적인 스크롤 부여 */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <AttendanceImportClient baseYear={baseYear} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
