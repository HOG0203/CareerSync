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
import * as React from 'react';

const initialState = { error: '' };

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex w-screen overflow-hidden animate-in fade-in duration-300">
      {/* Sidebar Skeleton */}
      <div className="w-64 border-r border-slate-200/80 bg-white p-4 hidden md:flex flex-col gap-6 shrink-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3 border-b border-slate-100">
          <div className="h-7 w-7 rounded-lg bg-blue-100 animate-pulse shrink-0" />
          <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div className="h-4 w-4 bg-slate-200 animate-pulse rounded shrink-0" />
              <div className="h-3.5 w-24 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-4 px-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 bg-slate-200 animate-pulse rounded" />
              <div className="h-3 w-14 bg-slate-100 animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Skeleton */}
        <header className="h-14 border-b border-slate-200/80 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>

        {/* Dashboard Body Skeleton */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Title Section */}
          <div className="space-y-1.5">
            <div className="h-6 w-48 bg-slate-200 animate-pulse rounded" />
            <div className="h-4 w-72 bg-slate-100 animate-pulse rounded" />
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-200/60 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-16 bg-slate-100 animate-pulse rounded" />
                  <div className="h-4 w-4 bg-slate-200 animate-pulse rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-7 w-12 bg-slate-200 animate-pulse rounded" />
                  <div className="h-3 w-28 bg-slate-100 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* Large Content Area Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col gap-4 min-h-[300px]">
              <div className="h-4 w-28 bg-slate-200 animate-pulse rounded" />
              <div className="flex-1 bg-slate-50/50 border border-dashed border-slate-200/60 rounded-lg animate-pulse" />
            </div>

            {/* List Area */}
            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col gap-4 min-h-[300px]">
              <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
              <div className="space-y-3 flex-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-slate-200 animate-pulse" />
                      <div className="h-3 w-20 bg-slate-200 animate-pulse rounded" />
                    </div>
                    <div className="h-3 w-8 bg-slate-100 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await login(formData);
    return result || initialState;
  }, initialState);

  if (isPending) {
    return <DashboardSkeleton />;
  }

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