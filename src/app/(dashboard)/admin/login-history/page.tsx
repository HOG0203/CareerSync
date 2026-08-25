import React from 'react';
import { getCachedAuditLogs } from '@/lib/audit-logger';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { LoginHistoryClient } from './login-history-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '로그인 및 작업 이력 | CareerSync',
  description: '사용자 로그인 접속 현황 및 로그인별 실제 작업 내역 추적',
};

export default async function LoginHistoryPage() {
  // 1. 관리자 권한 확인 및 Audit Logs 병렬 조회
  const [userProfile, allLogs] = await Promise.all([
    getCurrentUserProfile(),
    getCachedAuditLogs()
  ]);


  if (!userProfile || userProfile.role !== 'admin') {
    redirect('/dashboard');
  }


  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <KeyRound className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            로그인 및 활동 이력
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            교사 및 관리자의 <span className="text-blue-600 font-bold">로그인 접속 기록</span>과 해당 로그인 세션 동안 수행된 <span className="text-blue-600 font-bold">실제 작업 내역</span>을 추적합니다.
          </p>
        </div>
      </div>

      <LoginHistoryClient logs={allLogs} />
    </div>
  );
}
