'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, UserPlus, Loader2, ShieldCheck, Shield } from 'lucide-react';
import { createUser } from './actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function CreateUserButton() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await createUser(formData);

    setIsPending(false);
    if (result.success) {
      toast({ title: '계정 생성 성공', description: '새로운 사용자가 성공적으로 등록되었습니다.' });
      setIsOpen(false);
    } else {
      toast({ variant: 'destructive', title: '생성 실패', description: result.error });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 font-bold gap-2 shadow-lg shadow-blue-100">
          <Plus className="h-4 w-4" />
          신규 사용자 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-900 text-white">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <UserPlus className="h-6 w-6 text-blue-400" />
            사용자 등록
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
            시스템에 접속할 수 있는 새로운 계정을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="bg-white">
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">아이디 (필수)</Label>
              <Input 
                id="username" 
                name="username" 
                placeholder="로그인 시 사용할 아이디 입력" 
                required 
                className="h-11 rounded-xl border-slate-200 focus:ring-blue-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">성명</Label>
              <Input 
                id="fullName" 
                name="fullName" 
                placeholder="사용자 실명 입력" 
                className="h-11 rounded-xl border-slate-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">비밀번호</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="미입력 시 기본값: 123123" 
                className="h-11 rounded-xl border-slate-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">권한 설정</Label>
              <Select name="role" defaultValue="teacher">
                <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-blue-500">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="teacher" className="py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-400" />
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-sm">교직원</span>
                        <span className="text-[10px] text-slate-500">일반 데이터 조회 및 담당 학반 관리</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin" className="py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-sm text-blue-600">관리자</span>
                        <span className="text-[10px] text-slate-500">모든 시스템 설정 및 계정 관리 권한</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending} className="rounded-xl font-bold">
              취소
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-black h-11 px-8 shadow-lg shadow-blue-100">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : '계정 생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
