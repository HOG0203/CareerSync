'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changeStudentPassword } from '@/app/login/actions';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await changeStudentPassword(formData);

    setIsPending(false);

    if (result?.error) {
      setErrorMsg(result.error);
    } else if (result?.success) {
      toast({
        title: '비밀번호 변경 완료',
        description: '새로운 비밀번호가 성공적으로 설정되었습니다.',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">비밀번호 변경</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                안전한 계정 사용을 위해 새 비밀번호를 설정하세요.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword" className="text-xs font-semibold text-slate-700">
              현재 비밀번호
            </Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="현재 비밀번호 입력"
              required
              className="h-9 text-xs"
            />
            <span className="text-[11px] text-slate-400">초기 상태인 경우 학생 휴대전화 번호 뒷자리 4개</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700">
              새 비밀번호
            </Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="새 비밀번호 입력 (4자리 이상)"
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
              새 비밀번호 확인
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="새 비밀번호 재입력"
              required
              className="h-9 text-xs"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs h-9"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  변경 중...
                </>
              ) : (
                '비밀번호 저장'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
