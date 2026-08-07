import React, { Suspense } from 'react';
import { getCachedAuditLogs, AuditLogEntry } from '@/lib/audit-logger';
import { getCurrentUserProfile } from '@/lib/data';
import { redirect } from 'next/navigation';
import { History, ShieldCheck, Search, Filter, Calendar, User, FileText, ArrowUpDown, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TableLoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { AuditLogsClient } from './audit-logs-client';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; search?: string }>;
}) {
  const params = await searchParams;
  const suspenseKey = `${params.type || 'all'}-${params.search || 'all'}`;

  return (
    <Suspense key={suspenseKey} fallback={<TableLoadingSkeleton />}>
      <AuditLogsPageContent searchParams={params} />
    </Suspense>
  );
}

async function AuditLogsPageContent({
  searchParams,
}: {
  searchParams: { type?: string; search?: string };
}) {
  const params = searchParams;

  // 1. 관리자 권한 확인
  const userProfile = await getCurrentUserProfile();
  if (!userProfile || userProfile.role !== 'admin') {
    redirect('/dashboard');
  }

  // 2. Audit Log 캐시 데이터 조회
  const auditLogs = await getCachedAuditLogs({
    action_type: params.type,
    search: params.search
  });

  return (
    <div className="flex flex-col h-full gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <History className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600" />
            시스템 작업 이력 (Audit Logs)
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            학생 데이터 수정, 사용자 생성, 담임교사 배정, 학사학년도 백업 등 주요 시스템 작업 이력 조회
          </p>
        </div>
      </div>

      <AuditLogsClient logs={auditLogs} currentType={params.type || 'all'} currentSearch={params.search || ''} />
    </div>
  );
}
