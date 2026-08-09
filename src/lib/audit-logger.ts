'use server';

import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';

export interface AuditLogEntry {
  id: string;
  actor_id?: string;
  actor_name: string;
  action_type: 'STUDENT_UPDATE' | 'STUDENT_BULK_UPDATE' | 'USER_CREATE' | 'USER_ROLE_UPDATE' | 'HOMEROOM_ASSIGN' | 'PASSWORD_RESET' | 'COMPANY_UPSERT' | 'COMPANY_DELETE' | 'SYSTEM_SETTING_UPDATE' | 'BASE_YEAR_SNAPSHOT';
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
        actor_id: actorId || null,
        actor_name: actorName,
        action_type: params.action_type,
        target_name: params.target_name,
        details: typeof params.details === 'object' ? params.details : { message: params.details },
        created_at: newLog.created_at
      });

    // 2. 만약 audit_logs 테이블이 없으면 system_settings 저장소에 폴백 기록
    if (tableErr) {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', AUDIT_SETTINGS_KEY)
        .single();

      let currentLogs: AuditLogEntry[] = existing?.value ? (existing.value as any).logs || [] : [];
      // 최대 1000건 유지
      currentLogs = [newLog, ...currentLogs].slice(0, 1000);

      await supabase.from('system_settings').upsert({
        key: AUDIT_SETTINGS_KEY,
        value: { logs: currentLogs },
        updated_at: new Date().toISOString()
      });
    }

    revalidateTag('audit-logs');
    return { success: true };
  } catch (error) {
    console.error('Audit log record error:', error);
    return { success: false };
  }
}

/**
 * [캐싱] Audit Log 전체 목록 서버 메모리 캐싱 조회
 */
export async function getCachedAuditLogs() {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      
      // 1. audit_logs 테이블에서 먼저 시도
      const { data: tableLogs, error: tableErr } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      let logs: AuditLogEntry[] = [];

      if (!tableErr && tableLogs) {
        logs = tableLogs.map(l => ({
          id: l.id,
          actor_id: l.actor_id,
          actor_name: l.actor_name,
          action_type: l.action_type,
          target_name: l.target_name,
          details: l.details,
          created_at: l.created_at
        }));
      } else {
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
    ['audit-logs-list-all-500'],
    {
      revalidate: 86400,
      tags: ['audit-logs']
    }
  )();
}
