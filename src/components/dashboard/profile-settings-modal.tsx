'use client';

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
import { useToast } from '@/hooks/use-toast';
import { updatePassword } from '@/lib/auth-actions';
import { Loader2, KeyRound, ShieldCheck } from 'lucide-react';

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileSettingsModal({ open, onOpenChange }: ProfileSettingsModalProps) {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isPending, setIsPending] = React.useState(false);
  const { toast } = useToast();

  // 모달이 닫힐 때 발생하는 모든 스타일 잠금(pointer-events, overflow)을 강제로 해제
  React.useEffect(() => {
    if (!open) {
      const fixPointerEvents = () => {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
        document.documentElement.style.pointerEvents = 'auto';
        document.documentElement.style.overflow = 'auto';
        
        // Radix UI가 생성한 잔여 스타일 제거
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if ((el as HTMLElement).style.pointerEvents === 'none') {
            (el as HTMLElement).style.pointerEvents = 'auto';
          }
        });
      };

      // 즉시 실행 및 약간의 지연 후 재실행 (안정성 확보)
      fixPointerEvents();
      const timer = setTimeout(fixPointerEvents, 100);
      const timer2 = setTimeout(fixPointerEvents, 300);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [open]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast({ variant: 'destructive', title: '비밀번호를 입력하세요.' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (password.length < 6) {
      toast({ variant: 'destructive', title: '비밀번호는 최소 6자 이상이어야 합니다.' });
      return;
    }

    setIsPending(true);
    try {
      const result = await updatePassword(password);
      if (result.success) {
        toast({ title: '비밀번호 변경 완료', description: '다음에 로그인할 때 새로운 비밀번호를 사용하세요.' });
        onOpenChange(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        toast({ variant: 'destructive', title: '변경 실패', description: result.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: '오류 발생', description: '비밀번호 변경 중 알 수 없는 오류가 발생했습니다.' });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modal={true} // true 유지하되 내부 핸들러로 제어
    >
      <DialogContent 
        className="sm:max-w-[400px]"
        onCloseAutoFocus={(e) => {
          e.preventDefault(); // 닫힐 때 포커스 이동 차단 (충돌 방지)
          document.body.style.pointerEvents = 'auto';
        }}
        onInteractOutside={() => {
          setTimeout(() => {
            document.body.style.pointerEvents = 'auto';
          }, 0);
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            프로필 설정
          </DialogTitle>
          <DialogDescription>
            계정 보안을 위해 주기적으로 비밀번호를 변경하는 것을 권장합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdatePassword} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="최소 6자 이상 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="한 번 더 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  변경 중...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  비밀번호 변경
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
