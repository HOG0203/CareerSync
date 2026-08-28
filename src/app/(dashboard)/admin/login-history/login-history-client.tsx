'use client';

import * as React from 'react';
import { AuditLogEntry } from '@/lib/audit-logger';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  KeyRound,
  Users,
  Activity,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  User,
  Shield,
  Layers,
  Eye,
  FileText,
  Filter,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoginHistoryClientProps {
  logs: AuditLogEntry[];
}

const ACTION_TYPE_CONFIG: Record<string, { label: string; color: string; isView?: boolean }> = {
  USER_LOGIN: { label: '시스템 로그인', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  USER_LOGOUT: { label: '시스템 로그아웃', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  PAGE_VIEW: { label: '페이지 조회', color: 'bg-sky-50 text-sky-700 border-sky-200', isView: true },
  STUDENT_UPDATE: { label: '학생정보 수정', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  STUDENT_BULK_UPDATE: { label: '학생 일괄 수정', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  USER_CREATE: { label: '계정 생성', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  USER_ROLE_UPDATE: { label: '권한 변경', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  USER_DELETE: { label: '계정 삭제', color: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' },
  HOMEROOM_ASSIGN: { label: '담임교사 배정', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  PASSWORD_RESET: { label: '비밀번호 초기화', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPANY_UPSERT: { label: '기업정보 등록/수정', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPANY_DELETE: { label: '기업 정보 삭제', color: 'bg-red-50 text-red-700 border-red-200' },
  SYSTEM_SETTING_UPDATE: { label: '시스템 설정 변경', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  BASE_YEAR_SNAPSHOT: { label: '학적 백업 스냅샷', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

interface LoginSessionItem {
  id: string;
  actorName: string;
  loginTime: string;
  role?: string;
  details?: any;
  actions: AuditLogEntry[];
  workCount: number;
  viewCount: number;
}

export function LoginHistoryClient({ logs }: LoginHistoryClientProps) {
  const [selectedUser, setSelectedUser] = React.useState<string>('all');
  const [dateFilter, setDateFilter] = React.useState<'all' | 'today' | '7days' | '30days'>('all');
  const [activityFilter, setActivityFilter] = React.useState<'all' | 'work_only' | 'view_only'>('all');
  const [search, setSearch] = React.useState<string>('');
  const [expandedSessionIds, setExpandedSessionIds] = React.useState<Record<string, boolean>>({});
  const [detailModalLog, setDetailModalLog] = React.useState<AuditLogEntry | null>(null);

  // 사용자명 정규화 (예: '이호중(이호중)' -> '이호중')
  const normalizeActorName = (name?: string) => {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').trim();
  };

  // 작업 대상 명칭 한글화 헬퍼 (과거 로그 호환)
  const formatTargetName = (targetName?: string) => {
    if (!targetName) return '';
    return targetName
      .replace(/\[admin\/certification\/import\]/g, '[인증제 엑셀 일괄 등록]')
      .replace(/admin\/certification\/import/g, '인증제 엑셀 일괄 등록')
      .replace(/\[admin\/certification\/grades\]/g, '[인증제 성적현황]')
      .replace(/\[admin\/certification\/attendance\]/g, '[인증제 출결현황]')
      .replace(/\[admin\/certification\/certificates\]/g, '[인증제 자격증현황]')
      .replace(/\[admin\/certification\]/g, '[인증제 종합 평가]')
      .replace(/\[admin\/login-history\]/g, '[로그인 및 활동 이력]')
      .replace(/\[admin\/audit-logs\]/g, '[작업 이력 관리]')
      .replace(/\[admin\/settings\]/g, '[시스템 설정]')
      .replace(/\[admin\/users\]/g, '[사용자 관리]')
      .replace(/\[admin\/students\]/g, '[학생 등록/진급]');
  };

  // 1. 전체 고유 사용자 목록 추출
  const uniqueUsers = React.useMemo(() => {
    const userSet = new Set<string>();
    logs.forEach(l => {
      const name = normalizeActorName(l.actor_name);
      if (name && name !== '시스템 관리자') {
        userSet.add(name);
      }
    });
    return Array.from(userSet).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [logs]);

  // 2. 로그인 세션 및 활동 이력 맵핑 구성
  const { loginSessions, stats } = React.useMemo(() => {
    const loginLogs = logs.filter(l => l.action_type === 'USER_LOGIN');
    const activityLogs = logs.filter(l => l.action_type !== 'USER_LOGIN' && l.action_type !== 'USER_LOGOUT');
    const workLogs = logs.filter(l => l.action_type !== 'USER_LOGIN' && l.action_type !== 'USER_LOGOUT' && l.action_type !== 'PAGE_VIEW');
    const viewLogs = logs.filter(l => l.action_type === 'PAGE_VIEW');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 1. 실제 로그인 로그 기반 세션 목록 (loginLogs는 최신순 정렬)
    const sessions: LoginSessionItem[] = loginLogs.map((loginLog, idx) => {
      const loginTime = new Date(loginLog.created_at).getTime();
      const actorNorm = normalizeActorName(loginLog.actor_name);
      
      // 동일 사용자의 직후(더 최신) 로그인 시각 찾기 (idx 이전 요소들 중 가장 가까운 최신 로그인)
      const newerLoginSameUser = loginLogs
        .slice(0, idx)
        .reverse()
        .find(l => normalizeActorName(l.actor_name) === actorNorm);
      const newerLoginTime = newerLoginSameUser 
        ? new Date(newerLoginSameUser.created_at).getTime() 
        : Infinity;
      
      // 이번 로그인 세션 중 수행된 모든 활동 매핑
      // 조건:
      // 1) 동일 사용자
      // 2) 로그인 시각 직전(오차 30초) 이후에 발생
      // 3) 다음 로그인 시각 발생 직전까지만 포함
      // 4) 단일 세션 최대 24시간 범위 제한
      const sessionActions = activityLogs.filter(al => {
        if (normalizeActorName(al.actor_name) !== actorNorm) return false;
        const actTime = new Date(al.created_at).getTime();
        const isAfterThisLogin = actTime >= loginTime - 30000;
        const isBeforeNextLogin = actTime < newerLoginTime;
        const isWithin24Hours = actTime <= loginTime + (24 * 60 * 60 * 1000);
        return isAfterThisLogin && isBeforeNextLogin && isWithin24Hours;
      });

      const role = typeof loginLog.details === 'object' ? loginLog.details?.role : undefined;
      const workCount = sessionActions.filter(a => a.action_type !== 'PAGE_VIEW').length;
      const viewCount = sessionActions.filter(a => a.action_type === 'PAGE_VIEW').length;

      return {
        id: loginLog.id,
        actorName: actorNorm || loginLog.actor_name,
        loginTime: loginLog.created_at,
        role: role === 'admin' ? '관리자' : role === 'teacher' ? '교사' : role || '사용자',
        details: loginLog.details,
        actions: sessionActions,
        workCount,
        viewCount
      };
    });

    // 2. 과거 활동 로그 (로그인 로깅 기능 도입 이전의 오래된 로그들) 날짜별 그룹화
    const assignedLogIds = new Set<string>();
    sessions.forEach(s => s.actions.forEach(a => a.id && assignedLogIds.add(a.id)));

    const unassignedLogs = activityLogs.filter(w => !assignedLogIds.has(w.id));
    if (unassignedLogs.length > 0) {
      const dateUserMap: Record<string, AuditLogEntry[]> = {};
      unassignedLogs.forEach(al => {
        const dStr = al.created_at.slice(0, 10);
        const u = normalizeActorName(al.actor_name) || '관리자';
        const key = `${dStr}_${u}`;
        if (!dateUserMap[key]) dateUserMap[key] = [];
        dateUserMap[key].push(al);
      });

      Object.entries(dateUserMap).forEach(([key, uLogs]) => {
        const [dStr, user] = key.split('_');
        // 과거 활동의 경우 해당 날짜의 최초 발생 시각을 기준으로 타임스탬프 설정 (최신 로그인 위로 튀지 않도록)
        const earliestLog = uLogs[uLogs.length - 1] || uLogs[0];
        const wCount = uLogs.filter(a => a.action_type !== 'PAGE_VIEW').length;
        const vCount = uLogs.filter(a => a.action_type === 'PAGE_VIEW').length;
        sessions.push({
          id: `history_${key}`,
          actorName: user,
          loginTime: earliestLog.created_at,
          role: '과거 활동 기록',
          details: { message: `${dStr} 시스템 활동 기록 (로그인 로깅 이전)` },
          actions: uLogs,
          workCount: wCount,
          viewCount: vCount
        });
      });
    }

    // 최신순 정렬
    sessions.sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());

    // KPI 통계 계산
    const todayLogins = loginLogs.filter(l => new Date(l.created_at).getTime() >= todayStart);
    const todayWorkLogs = workLogs.filter(w => new Date(w.created_at).getTime() >= todayStart);
    const todayViewLogs = viewLogs.filter(v => new Date(v.created_at).getTime() >= todayStart);
    const todayActiveUsers = new Set([
      ...todayLogins.map(l => normalizeActorName(l.actor_name)),
      ...todayWorkLogs.map(w => normalizeActorName(w.actor_name)),
      ...todayViewLogs.map(v => normalizeActorName(v.actor_name))
    ].filter(Boolean)).size;

    return {
      loginSessions: sessions,
      stats: {
        todayLoginsCount: todayLogins.length,
        todayActiveUsers,
        todayViewCount: todayViewLogs.length,
        totalViewCount: viewLogs.length,
        todayWorkCount: todayWorkLogs.length,
        totalWorkCount: workLogs.length,
        recentActor: sessions[0]?.actorName || '없음'
      }
    };
  }, [logs]);

  // 3. 필터링 로직
  const filteredSessions = React.useMemo(() => {
    let list = loginSessions;

    // 사용자 필터
    if (selectedUser !== 'all') {
      list = list.filter(s => s.actorName === selectedUser);
    }

    // 날짜 필터
    if (dateFilter !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      if (dateFilter === 'today') {
        list = list.filter(s => new Date(s.loginTime).getTime() >= todayStart);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = todayStart - (7 * 24 * 60 * 60 * 1000);
        list = list.filter(s => new Date(s.loginTime).getTime() >= sevenDaysAgo);
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = todayStart - (30 * 24 * 60 * 60 * 1000);
        list = list.filter(s => new Date(s.loginTime).getTime() >= thirtyDaysAgo);
      }
    }

    // 활동 유형 필터 (전체 / 변경 작업만 / 조회만)
    if (activityFilter === 'work_only') {
      list = list.filter(s => s.workCount > 0);
    } else if (activityFilter === 'view_only') {
      list = list.filter(s => s.viewCount > 0);
    }

    // 검색어 필터
    if (search.trim() !== '') {
      const q = search.toLowerCase().trim();
      list = list.filter(s => 
        s.actorName.toLowerCase().includes(q) ||
        JSON.stringify(s.details || '').toLowerCase().includes(q) ||
        s.actions.some(a => 
          formatTargetName(a.target_name).toLowerCase().includes(q) ||
          a.target_name.toLowerCase().includes(q) ||
          (ACTION_TYPE_CONFIG[a.action_type]?.label || '').toLowerCase().includes(q) ||
          JSON.stringify(a.details || '').toLowerCase().includes(q)
        )
      );
    }

    return list;
  }, [loginSessions, selectedUser, dateFilter, activityFilter, search]);

  const toggleSessionExpand = (id: string) => {
    setExpandedSessionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allExp: Record<string, boolean> = {};
    filteredSessions.forEach(s => { allExp[s.id] = true; });
    setExpandedSessionIds(allExp);
  };

  const collapseAll = () => {
    setExpandedSessionIds({});
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
        hour12: false
      });
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}일 전`;
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* 1. 상단 KPI 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">오늘 총 로그인</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900">{stats.todayLoginsCount}</span>
            <span className="text-xs font-semibold text-slate-500 ml-1.5">회 접속</span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">오늘 접속 사용자</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-indigo-600">{stats.todayActiveUsers}</span>
            <span className="text-xs font-semibold text-slate-500 ml-1.5">명 활동</span>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">오늘 페이지 조회</span>
            <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Eye className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-sky-600">{stats.todayViewCount}</span>
              <span className="text-xs font-semibold text-slate-500">회 (오늘)</span>
              <span className="text-[11px] text-slate-400 ml-1">/ 누적 {stats.totalViewCount}회</span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">오늘 변경 작업</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-emerald-600">{stats.todayWorkCount}</span>
              <span className="text-xs font-semibold text-slate-500">건 (오늘)</span>
              <span className="text-[11px] text-slate-400 ml-1">/ 누적 {stats.totalWorkCount}건</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. 검색 및 다중 필터 툴바 */}
      <Card className="border border-slate-200/80 bg-white shadow-sm rounded-2xl overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* 검색창 */}
            <div className="relative w-full sm:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="사용자명, 아이디, 페이지명, 작업 내용 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white rounded-lg"
              />
            </div>

            {/* 사용자 선택 필터 */}
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-9 text-xs w-[140px] bg-slate-50/50 border-slate-200 rounded-lg font-medium">
                <SelectValue placeholder="사용자 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-semibold">전체 사용자 ({uniqueUsers.length}명)</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 기간 필터 */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
              <Button
                type="button"
                variant={dateFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('all')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  dateFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                전체
              </Button>
              <Button
                type="button"
                variant={dateFilter === 'today' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('today')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  dateFilter === 'today' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                오늘
              </Button>
              <Button
                type="button"
                variant={dateFilter === '7days' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('7days')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  dateFilter === '7days' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                최근 7일
              </Button>
              <Button
                type="button"
                variant={dateFilter === '30days' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDateFilter('30days')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  dateFilter === '30days' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                30일
              </Button>
            </div>

            {/* 활동 유형 3단 필터 (전체 / 변경작업만 / 페이지만) */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
              <Button
                type="button"
                variant={activityFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActivityFilter('all')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  activityFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                전체 활동
              </Button>
              <Button
                type="button"
                variant={activityFilter === 'work_only' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActivityFilter('work_only')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  activityFilter === 'work_only' ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Activity className="h-3 w-3 mr-1" />
                변경 작업만
              </Button>
              <Button
                type="button"
                variant={activityFilter === 'view_only' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActivityFilter('view_only')}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-bold rounded-md transition-all",
                  activityFilter === 'view_only' ? "bg-sky-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye className="h-3 w-3 mr-1" />
                페이지 조회만
              </Button>
            </div>
          </div>

          {/* 모두 펼치기 / 접기 */}
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              전체 펼치기
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
              전체 접기
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. 로그인 및 작업 세션 타임라인 리스트 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500">
            총 <span className="text-blue-600 font-extrabold">{filteredSessions.length}</span>개의 로그인 세션 조회됨
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <Card className="bg-white border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">조회된 로그인 이력이 없습니다.</p>
                <p className="text-xs text-slate-400">선택한 필터 조건 또는 검색어를 다시 확인해주세요.</p>
              </div>
            </div>
          </Card>
        ) : (
          filteredSessions.map((session) => {
            const isExpanded = !!expandedSessionIds[session.id];
            const hasActions = session.actions.length > 0;

            const displayedActions = session.actions.filter(a => {
              if (activityFilter === 'work_only') return a.action_type !== 'PAGE_VIEW';
              if (activityFilter === 'view_only') return a.action_type === 'PAGE_VIEW';
              return true;
            });

            return (
              <Card 
                key={session.id}
                className={cn(
                  "border bg-white rounded-2xl shadow-xs transition-all overflow-hidden",
                  hasActions ? "border-slate-200/90" : "border-slate-200/60 opacity-95"
                )}
              >
                {/* 세션 헤더 */}
                <div 
                  onClick={() => toggleSessionExpand(session.id)}
                  className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                      session.workCount > 0
                        ? "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-2xs" 
                        : "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      <KeyRound className="h-5 w-5" />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{session.actorName}</span>
                        {session.role && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700 font-semibold border-slate-200">
                            {session.role}
                          </Badge>
                        )}
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                          로그인 접속
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(session.loginTime)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 font-semibold">{formatRelativeTime(session.loginTime)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 세션 내 작업 현황 배지 & 토글 버튼 */}
                  <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0 pl-13 sm:pl-0">
                    <div className="flex items-center gap-1.5">
                      {session.viewCount > 0 && (
                        <Badge className="bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-[11px] font-bold px-2 py-0.5 flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>조회 {session.viewCount}회</span>
                        </Badge>
                      )}
                      {session.workCount > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-bold px-2 py-0.5 flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          <span>작업 {session.workCount}건</span>
                        </Badge>
                      )}
                      {session.viewCount === 0 && session.workCount === 0 && (
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-slate-300" />
                          활동 없음
                        </span>
                      )}
                    </div>

                    <div className="h-8 w-8 rounded-lg bg-slate-100/80 text-slate-500 flex items-center justify-center hover:bg-slate-200/80 transition-colors shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* 세션 상세: 로그인 중 수행한 활동 타임라인 */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 bg-slate-50/70 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        로그인 세션 활동 타임라인 ({displayedActions.length}건)
                      </span>
                      {displayedActions.length > 0 && (
                        <span className="text-[11px] font-medium text-slate-500">
                          항목을 클릭하면 상세 내역을 확인할 수 있습니다.
                        </span>
                      )}
                    </div>

                    {displayedActions.length === 0 ? (
                      <div className="bg-white rounded-xl p-6 text-center border border-slate-200/60">
                        <p className="text-xs text-slate-500 font-medium">
                          선택한 활동 필터에 해당하는 이력이 없습니다.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-100">
                        {displayedActions.map((action, aIdx) => {
                          const actionConfig = ACTION_TYPE_CONFIG[action.action_type] || { 
                            label: action.action_type, 
                            color: 'bg-slate-100 text-slate-700 border-slate-200' 
                          };

                          const isPageView = action.action_type === 'PAGE_VIEW';

                          return (
                            <div 
                              key={action.id || aIdx}
                              onClick={() => setDetailModalLog(action)}
                              className={cn(
                                "relative pl-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white hover:bg-indigo-50/40 border rounded-xl transition-all cursor-pointer shadow-2xs group",
                                isPageView ? "border-slate-200/60" : "border-slate-200/90 hover:border-indigo-200"
                              )}
                            >
                              {/* 타임라인 점 */}
                              <div className={cn(
                                "absolute left-2.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ring-4 ring-white",
                                isPageView ? "bg-sky-400" : "bg-emerald-500"
                              )} />

                              <div className="flex items-center gap-2.5 flex-wrap flex-1">
                                <Badge variant="outline" className={cn("text-[11px] font-bold px-2 py-0.5 border shrink-0", actionConfig.color)}>
                                  {isPageView && <Eye className="h-3 w-3 mr-1 inline" />}
                                  {actionConfig.label}
                                </Badge>
                                <span className={cn(
                                  "text-xs sm:text-sm group-hover:text-indigo-600 transition-colors",
                                  isPageView ? "font-medium text-slate-700" : "font-bold text-slate-900"
                                )}>
                                  {formatTargetName(action.target_name)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-xs text-slate-500 font-medium">
                                <span>{formatDate(action.created_at)}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 px-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-md"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  상세보기
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* 4. 작업 상세 다이얼로그 모달 */}
      <Dialog open={!!detailModalLog} onOpenChange={(open) => !open && setDetailModalLog(null)}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-3xs">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>작업 상세 이력</span>
                  {detailModalLog && (
                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", ACTION_TYPE_CONFIG[detailModalLog.action_type]?.color || "bg-slate-50 text-slate-700")}>
                      {ACTION_TYPE_CONFIG[detailModalLog.action_type]?.label || detailModalLog.action_type}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  수행된 작업의 변경 전/후 상세 정보 및 JSON 데이터를 확인합니다.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detailModalLog && (
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 bg-white">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
                <div>
                  <span className="font-semibold text-slate-400 block mb-0.5 text-[11px]">작업 수행자</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-500" />
                    {detailModalLog.actor_name}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block mb-0.5 text-[11px]">작업 일시</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    {formatDate(detailModalLog.created_at)}
                  </span>
                </div>
                <div className="col-span-2 pt-2.5 border-t border-slate-200/80">
                  <span className="font-semibold text-slate-400 block mb-0.5 text-[11px]">작업 대상 및 내용</span>
                  <span className="font-extrabold text-indigo-700 text-sm">{formatTargetName(detailModalLog.target_name)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>상세 변경 데이터 (Payload JSON):</span>
                </span>
                <div className="relative rounded-xl border border-slate-800/60 overflow-hidden shadow-inner">
                  <pre className="p-4 bg-slate-950 text-slate-100 text-xs rounded-xl overflow-x-auto font-mono max-h-[260px] custom-scrollbar leading-relaxed">
                    {typeof detailModalLog.details === 'object' 
                      ? JSON.stringify(detailModalLog.details, null, 2) 
                      : String(detailModalLog.details || '내용 없음')}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailModalLog(null)}
              className="h-9 px-4 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-100 transition-all shadow-3xs"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
