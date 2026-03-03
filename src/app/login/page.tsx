'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { login } from '@/app/login/actions';

const initialState = { error: '' };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await login(formData);
    return result || initialState;
  }, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl">다시 오신 것을 환영합니다</CardTitle>
          <CardDescription>
            대시보드에 액세스하려면 자격 증명을 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}