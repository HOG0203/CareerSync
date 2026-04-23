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
import { FileUp } from 'lucide-react';
import { GradeImportClient } from '../../grade-import-client';

export function GradeImportModal() {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2">
          <FileUp className="h-4 w-4" />
          성적 데이터 업로드
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">성적 일괄 업로드 및 설정</DialogTitle>
          <DialogDescription>
            엑셀 파일을 업로드하여 학생들의 성적을 일괄 등록하거나 기존 데이터를 초기화합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <GradeImportClient />
        </div>
      </DialogContent>
    </Dialog>
  );
}
