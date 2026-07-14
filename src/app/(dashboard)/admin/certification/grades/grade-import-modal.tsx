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
import { FileUp, Settings } from 'lucide-react';
import { GradeImportClient } from '@/app/(dashboard)/admin/grades/grade-import-client';

export function GradeImportModal() {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-lg shadow-indigo-200">
          <FileUp className="h-4 w-4" />
          성적 데이터 업로드
        </Button>
      </DialogTrigger>
      {/* flex flex-col과 overflow-hidden을 통해 내부 스크롤 영역을 보호함 */}
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 border-none shadow-2xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10 [&>button]:p-2 [&>button]:rounded-full [&>button]:transition-colors overflow-hidden">
        <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">성적 관리 시스템 설정</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs font-medium mt-1">
                엑셀 파일을 업로드하여 학생들의 성적을 일괄 등록하거나 기존 데이터를 초기화합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {/* 실제 컨텐츠 영역에 스크롤 부여 */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="py-4">
            <GradeImportClient />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
