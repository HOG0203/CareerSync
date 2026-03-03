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
import { PlusCircle } from 'lucide-react';
import { createUser } from './actions';
import { useToast } from '@/hooks/use-toast';

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
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          신규 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 등록</DialogTitle>
          <DialogDescription>
            시스템에 접속할 수 있는 새로운 교직원 또는 관리자 계정을 생성합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="username">아이디</Label>
            <Input id="username" name="username" placeholder="로그인 시 사용할 아이디" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" placeholder="미입력 시 기본값: 123123" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">권한 설정</Label>
            <Select name="role" defaultValue="teacher">
              <SelectTrigger>
                <SelectValue placeholder="역할 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">교직원 (일반 권한)</SelectItem>
                <SelectItem value="admin">관리자 (모든 권한)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
              {isPending ? '처리 중...' : '계정 생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
