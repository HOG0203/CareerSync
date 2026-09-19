'use server';

import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';

export interface AuditLogEntry {
  id: string;
  actor_id?: string;
  actor_name: string;
  action_type: 'USER_LOGIN' | 'USER_LOGOUT' | 'PAGE_VIEW' | 'STUDENT_UPDATE' | 'STUDENT_BULK_UPDATE' | 'USER_CREATE' | 'USER_ROLE_UPDATE' | 'USER_DELETE' | 'HOMEROOM_ASSIGN' | 'PASSWORD_RESET' | 'COMPANY_UPSERT' | 'COMPANY_DELETE' | 'SYSTEM_SETTING_UPDATE' | 'BASE_YEAR_SNAPSHOT' | 'BASE_YEAR_SNAPSHOT_DELETE' | 'BASE_YEAR_SNAPSHOT_RESTORE';
  target_name: string;
  details?: Record<string, any> | string;
  created_at: string;
}

const AUDIT_SETTINGS_KEY = 'audit_logs_store';

/**
 * Audit Log 기록 저장 함수
 */
export async function logAuditAction(params: {
  actor_name?: string;
  action_type: AuditLogEntry['action_type'];
  target_name: string;
  details?: Record<string, any> | string;
}) {
  try {
    const supabase = createAdminClient();
    
    // 현재 접속자 프로필 정보 확인 (없으면 파라미터 또는 시스템)
    let actorName = params.actor_name;
    let actorId: string | undefined = undefined;

    if (!actorName) {
      const userProfile = await getCurrentUserProfile();
      if (userProfile) {
        actorName = userProfile.full_name || '관리자';
        actorId = userProfile.id;
      } else {
        actorName = '시스템 관리자';
      }
    }

    const finalActorName = actorName || '시스템 관리자';

    const newLog: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actor_id: actorId,
      actor_name: finalActorName,
      action_type: params.action_type,
      target_name: params.target_name,
      details: params.details,
      created_at: new Date().toISOString()
    };

    // 1. audit_logs 전용 테이블 시도
    const { error: tableErr } = await supabase
      .from('audit_logs')
      .insert({
        id: newLog.id,
        actor_id: actorId || null,
        actor_name: finalActorName,
        action_type: params.action_type,
        target_name: params.target_name,
        details: typeof params.details === 'object' ? params.details : { message: params.details },
        created_at: newLog.created_at
      });

    // 2. 만약 audit_logs 테이블이 없으면 중요한 시스템 작업에 한해 system_settings 저장소에 폴백 기록
    if (tableErr) {
      // ⚠️ PAGE_VIEW(단순 페이지 조회)는 초당 수회 발생하는 텔레메트리이므로,
      // 전용 테이블이 없을 때 300KB 대용량 JSON을 매번 system_settings에 읽고 쓰지 않도록 스킵하여 DB 락 방지
      if (params.action_type === 'PAGE_VIEW') {
        return { success: true };
      }

      const { data: existing } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', AUDIT_SETTINGS_KEY)
        .maybeSingle();

      let currentLogs: AuditLogEntry[] = existing?.value ? (existing.value as any).logs || [] : [];
      // 최대 1000건 유지
      currentLogs = [newLog, ...currentLogs].slice(0, 1000);

      await supabase.from('system_settings').upsert({
        key: AUDIT_SETTINGS_KEY,
        value: { logs: currentLogs },
        updated_at: new Date().toISOString()
      });
    }

    // 중요한 상태 변경 작업에 한해서만 감사 로그 캐시 무효화 (PAGE_VIEW 시에는 캐시 유지)
    if (params.action_type !== 'PAGE_VIEW') {
      try {
        revalidateTag('audit-logs');
      } catch {
        // ignore if revalidateTag is called outside request lifecycle
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Audit log record error:', error);
    return { success: false };
  }
}

/**
 * 페이지 조회(방문) 로그 기록 Server Action (로그인 이력 페이지 자체는 제외)
 */
export async function recordPageViewAction(path: string, pageName: string) {
  try {
    // 로그인 이력 관리 페이지 자체 조회는 기록에서 제외
    if (path.includes('/admin/login-history')) {
      return { success: true };
    }

    const userProfile = await getCurrentUserProfile();
    if (!userProfile) return { success: false };

    const actorName = userProfile.full_name || userProfile.username || '사용자';

    return await logAuditAction({
      actor_name: actorName,
      action_type: 'PAGE_VIEW',
      target_name: `[${pageName}] 페이지 조회`,
      details: {
        path,
        page_name: pageName,
        role: userProfile.role,
        viewed_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Failed to record page view:', err);
    return { success: false };
  }
}

/**
 * [캐싱] Audit Log 전체 목록 서버 메모리 캐싱 조회
 */
export async function getCachedAuditLogs(maxLimit: number = 3000) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      
      // 1. audit_logs 테이블에서 청크 페이징 조회 (최대 maxLimit건)
      let allTableLogs: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      let hasTableErr = false;

      while (allTableLogs.length < maxLimit) {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + CHUNK - 1);

        if (error) {
          hasTableErr = true;
          break;
        }
        if (!data || data.length === 0) break;
        allTableLogs.push(...data);
        if (data.length < CHUNK) break;
        from += CHUNK;
      }

      let logs: AuditLogEntry[] = [];

      if (!hasTableErr && allTableLogs.length > 0) {
        logs = allTableLogs.map(l => ({
          id: l.id,
          actor_id: l.actor_id,
          actor_name: l.actor_name,
          action_type: l.action_type,
          target_name: l.target_name,
          details: l.details,
          created_at: l.created_at
        }));
      } else if (hasTableErr) {
        // 폴백: system_settings에서 조회
        const { data: fallbackData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', AUDIT_SETTINGS_KEY)
          .single();

        logs = fallbackData?.value ? (fallbackData.value as any).logs || [] : [];
      }

      return logs;
    },
    ['audit-logs-list-all-v3'],
    {
      revalidate: 86400,
      tags: ['audit-logs']
    }
  )();
}
