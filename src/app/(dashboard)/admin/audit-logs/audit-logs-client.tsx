'use client';

import * as React from 'react';
import { AuditLogEntry } from '@/lib/audit-logger';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Search, Filter, History, Eye, Info, Clock, User, ShieldCheck } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AuditLogsClientProps {
  logs: AuditLogEntry[];
  currentType: string;
  currentSearch: string;
}

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  STUDENT_UPDATE: { label: '학생정보 수정', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  STUDENT_BULK_UPDATE: { label: '학생 일괄 수정', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  USER_CREATE: { label: '계정 생성', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  USER_ROLE_UPDATE: { label: '권한 변경', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  HOMEROOM_ASSIGN: { label: '담임교사 배정', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PASSWORD_RESET: { label: '비밀번호 초기화', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  COMPANY_UPSERT: { label: '기업정보 등록/수정', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPANY_DELETE: { label: '기업 정보 삭제', color: 'bg-red-50 text-red-700 border-red-200' },
  SYSTEM_SETTING_UPDATE: { label: '기준학년도 변경', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  BASE_YEAR_SNAPSHOT: { label: '학적 백업 스냅샷', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

export function AuditLogsClient({ logs, currentType, currentSearch }: AuditLogsClientProps) {
  const [search, setSearch] = React.useState(currentSearch);
  const [activeType, setActiveType] = React.useState(currentType);
  const [selectedLog, setSelectedLog] = React.useState<AuditLogEntry | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // 각 유형별 개수 집계 (0ms 메모이제이션)
  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    logs.forEach(l => {
      counts[l.action_type] = (counts[l.action_type] || 0) + 1;
    });
    return counts;
  }, [logs]);

  // 브라우저 0ms 메모이제이션 클라이언트 필터링
  const filteredLogs = React.useMemo(() => {
    let list = logs;
    if (activeType && activeType !== 'all') {
      list = list.filter(l => l.action_type === activeType);
    }
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      list = list.filter(l =>
        (l.actor_name || '').toLowerCase().includes(q) ||
        (l.target_name || '').toLowerCase().includes(q) ||
        JSON.stringify(l.details || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, activeType, search]);

  const handleTypeChange = (type: string) => {
    setActiveType(type);
    const params = new URLSearchParams(window.location.search);
    if (type !== 'all') {
      params.set('type', type);
    } else {
      params.delete('type');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    const params = new URLSearchParams(window.location.search);
    if (val.trim() !== '') {
      params.set('search', val);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 및 검색 바 */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <Button
            size="sm"
            variant={activeType === 'all' ? 'default' : 'outline'}
            onClick={() => handleTypeChange('all')}
            className={cn("text-xs font-bold rounded-xl", activeType === 'all' && "bg-indigo-600 hover:bg-indigo-700")}
          >
            전체 ({typeCounts['all'] || 0})
          </Button>
          {Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => {
            const count = typeCounts[key] || 0;
            return (
              <Button
                key={key}
                size="sm"
                variant={activeType === key ? 'default' : 'outline'}
                onClick={() => handleTypeChange(key)}
                className={cn("text-xs font-medium rounded-xl whitespace-nowrap gap-1", activeType === key && "bg-indigo-600 hover:bg-indigo-700")}
              >
                <span>{cfg.label}</span>
                <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-bold", activeType === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="작업자, 대상, 내용 검색..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* 작업 이력 테이블 */}
      <Card className="shadow-sm border-none bg-white rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b py-4 px-4 sm:px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              작업 기록 목록
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              최근 발생한 시스템 작업 이력이 시각적으로 기록됩니다. (필터링: {filteredLogs.length}건 / 전체 {logs.length}건)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <History className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-xs font-medium">기록된 작업 이력이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4 sm:pl-6 w-[170px]">일시</th>
                    <th className="p-3 w-[120px]">작업자</th>
                    <th className="p-3 w-[130px]">작업 유형</th>
                    <th className="p-3 min-w-[150px]">작업 대상</th>
                    <th className="p-3 pr-4 sm:pr-6 w-[90px] text-center">상세 보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.map((log) => {
                    const typeCfg = ACTION_TYPE_CONFIG[log.action_type] || { label: log.action_type, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4 sm:pl-6 font-mono text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {formatDate(log.created_at)}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            {log.actor_name}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border", typeCfg.color)}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          <div>{log.target_name}</div>
                          {log.details && typeof log.details === 'object' && (log.details.old_value !== undefined || log.details.new_value !== undefined) && (
                            <div className="flex items-center gap-1 mt-1 text-[10.5px]">
                              <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-mono border border-rose-200 max-w-[130px] truncate">
                                {String(log.details.old_value ?? '(빈값)')}
                              </span>
                              <span className="text-slate-400 font-black shrink-0">➔</span>
                              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono border border-emerald-200 max-w-[130px] truncate">
                                {String(log.details.new_value ?? '(빈값)')}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 pr-4 sm:pr-6 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> 상세
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 세부 내역 모달 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-600" />
              작업 이력 세부 내역
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              선택한 작업의 구체적인 변경 사항 및 파라미터 정보입니다.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">일시:</span>
                  <span className="font-mono text-slate-700 font-bold">{formatDate(selectedLog.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">작업자:</span>
                  <span className="font-bold text-slate-900">{selectedLog.actor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">작업 유형:</span>
                  <span className="font-bold text-indigo-700">{ACTION_TYPE_CONFIG[selectedLog.action_type]?.label || selectedLog.action_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">작업 대상:</span>
                  <span className="font-bold text-emerald-700">{selectedLog.target_name}</span>
                </div>
              </div>

              {/* 이전 값 -> 변경 후 값 비교 카드 */}
              {selectedLog.details && typeof selectedLog.details === 'object' && (selectedLog.details.old_value !== undefined || selectedLog.details.new_value !== undefined) && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                  <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1">
                    🔄 데이터 변경 시각적 비교 (Before ➔ After)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-rose-600 block">이전 상태 (Before)</span>
                      <span className="font-bold text-rose-900 font-mono break-all block">{String(selectedLog.details.old_value ?? '(빈값)')}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg space-y-1">
                      <span className="text-[10px] font-bold text-emerald-600 block">변경 후 상태 (After)</span>
                      <span className="font-bold text-emerald-900 font-mono break-all block">{String(selectedLog.details.new_value ?? '(빈값)')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-slate-700 mb-1">상세 파라미터 (JSON)</h4>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[220px]">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button size="sm" onClick={() => setSelectedLog(null)} className="w-full font-bold text-xs">
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
