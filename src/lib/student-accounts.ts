'use server';

import { unstable_cache, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUserProfile } from '@/lib/data';
import { logAuditAction } from '@/lib/audit-logger';
import { extractPhoneLast4, getStudentUsername, formatStudentAuthPassword } from '@/lib/student-utils';


export interface StudentAccountMeta {
  student_id: string; // students.id (UUID)
  auth_user_id?: string;
  is_custom_password: boolean;
  password_changed_at?: string | null;
  last_login_at?: string | null;
  login_count: number;
  last_reset_at?: string | null;
  last_reset_by?: string | null;
}

const STUDENT_ACCOUNTS_KEY = 'student_accounts_store';

/**
 * 전체 학생 계정 메타데이터 맵 조회 (캐싱 적용)
 */
export const getCachedStudentAccountsStore = unstable_cache(
  async (): Promise<Record<string, StudentAccountMeta>> => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', STUDENT_ACCOUNTS_KEY)
        .maybeSingle();

      if (error || !data) {
        return {};
      }

      return (data.value as Record<string, StudentAccountMeta>) || {};
    } catch (e) {
      console.error('Error fetching student_accounts_store:', e);
      return {};
    }
  },
  ['student-accounts-store-cache'],
  { revalidate: 3600, tags: ['student-accounts'] }
);

/**
 * 특정 학생의 계정 메타데이터 조회
 */
export async function getStudentAccountMeta(studentId: string): Promise<StudentAccountMeta | null> {
  const store = await getCachedStudentAccountsStore();
  return store[studentId] || null;
}

/**
 * 학생 계정 메타데이터 저장/업데이트
 */
export async function saveStudentAccountMeta(studentId: string, metaPatch: Partial<StudentAccountMeta>) {
  const supabase = createAdminClient();
  const store = await getCachedStudentAccountsStore();

  const current = store[studentId] || {
    student_id: studentId,
    is_custom_password: false,
    login_count: 0,
  };

  const updated: StudentAccountMeta = {
    ...current,
    ...metaPatch,
    student_id: studentId,
  };

  store[studentId] = updated;

  await supabase
    .from('system_settings')
    .upsert({
      key: STUDENT_ACCOUNTS_KEY,
      value: store,
      updated_at: new Date().toISOString(),
    });

  revalidateTag('student-accounts');
  return updated;
}

/**
 * 학생 정보 수정 시(전화번호 변경 등), 커스텀 비밀번호 미설정 학생의 비밀번호를 자동 동기화
 */
export async function syncStudentPhonePassword(studentId: string, newPhone: string | null | undefined) {
  try {
    const last4 = extractPhoneLast4(newPhone);
    if (!last4) return;

    const meta = await getStudentAccountMeta(studentId);
    // 비밀번호를 이미 직접 변경한 학생은 동기화 제외
    if (meta && meta.is_custom_password) {
      return;
    }

    // 학생 정보 조회
    const supabase = createAdminClient();
    const { data: student } = await supabase
      .from('students')
      .select('id, student_name')
      .eq('id', studentId)

      .maybeSingle();

    if (!student) return;

    const username = getStudentUsername(student);
    const safeLocalPart = Buffer.from(username.toLowerCase()).toString('hex');
    const virtualEmail = `${safeLocalPart}@careersync.local`;

    // Auth 계정 조회
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', virtualEmail)
      .maybeSingle();

    if (userProfile?.id) {
      // Supabase Auth 유저 비밀번호 갱신
      await supabaseAdmin.auth.admin.updateUserById(userProfile.id, {
        password: formatStudentAuthPassword(last4),
      });

      // 메타데이터 상태 유지/동기화
      await saveStudentAccountMeta(studentId, {
        auth_user_id: userProfile.id,
        is_custom_password: false,
      });
    }
  } catch (e) {
    console.error('Failed to sync student phone password:', e);
  }
}

/**
 * 담임교사 / 관리자의 학생 비밀번호 초기화 액션
 * 1. 학생의 등록된 휴대폰 번호 뒷자리 4자리로 비밀번호 재설정
 * 2. is_custom_password = false 로 초기화 (변경이력 초기화)
 * 3. 감사 로그 기록
 */
export async function resetStudentPasswordAction(studentId: string) {
  try {
    const supabase = createAdminClient();

    // 1. 현재 사용자 권한과 대상 학생 정보 병렬 조회 (0.1초)
    const [currentUser, studentRes] = await Promise.all([
      getCurrentUserProfile(),
      supabase.from('students').select('*').eq('id', studentId).maybeSingle(),
    ]);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) {
      return { success: false, error: '비밀번호 초기화 권한이 없습니다.' };
    }

    const student = studentRes.data;
    if (studentRes.error || !student) {
      return { success: false, error: '학생 정보를 찾을 수 없습니다.' };
    }

    // 담임교사인 경우 본인 담당 학년/학과/학반 학생인지 철저히 검증 (RBAC)
    if (currentUser.role === 'teacher') {
      const settings = await (await import('@/app/(dashboard)/admin/settings/actions')).getSystemSettings();
      const currentGrade = Math.max(1, Math.min(3, (settings.baseYear || 2026) + 4 - (student.graduation_year || (settings.baseYear + 1))));
      
      const isGradeMatch = !currentUser.assigned_grade || currentUser.assigned_grade === currentGrade;
      const isMajorMatch = !currentUser.assigned_major || currentUser.assigned_major === student.major;
      const isClassMatch = !currentUser.assigned_class || currentUser.assigned_class === student.class_info;

      if (!isGradeMatch || !isMajorMatch || !isClassMatch) {
        return {
          success: false,
          error: `해당 학생(${student.student_name})의 비밀번호 초기화 권한이 없습니다. (본인 담당 학반 학생만 초기화 가능)`,
        };
      }
    }

    const last4 = extractPhoneLast4(student.phone_number);
    if (!last4) {
      return { 
        success: false, 
        error: '학생의 등록된 연락처가 없습니다. 먼저 학생 관리에서 휴대폰 번호를 입력해주세요.' 
      };
    }

    const username = getStudentUsername(student);
    const safeLocalPart = Buffer.from(username.toLowerCase()).toString('hex');
    const virtualEmail = `${safeLocalPart}@careersync.local`;
    const authPassword = formatStudentAuthPassword(last4);

    // 2. 캐시된 메타데이터 또는 profiles에서 Auth User ID 즉시 획득
    const meta = await getStudentAccountMeta(studentId);
    let authUserId = meta?.auth_user_id;

    if (!authUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .or(`email.eq.${virtualEmail},username.eq.${username}`)
        .maybeSingle();
      authUserId = profile?.id;
    }

    // 3. Auth 계정이 없었던 경우에만 생성
    if (!authUserId) {
      const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: virtualEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: {
          username,
          full_name: student.student_name,
          student_id: student.id,
          role: 'student',
          assigned_major: student.major,
          assigned_class: student.class_info,
          is_custom_password: false,
        },
      });

      if (newAuth?.user) {
        authUserId = newAuth.user.id;
      } else if (createErr) {
        return { success: false, error: `계정 생성 실패: ${createErr.message}` };
      }
    } else {
      // 이미 존재하는 계정은 비밀번호 즉시 갱신
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: authPassword,
      });

      if (updateErr) {
        return { success: false, error: `비밀번호 초기화 실패: ${updateErr.message}` };
      }
    }

    // 4. 프로필 동기화 및 메타데이터 갱신 (단 1회 병렬 처리)
    if (authUserId) {
      await Promise.all([
        supabase.from('profiles').upsert({
          id: authUserId,
          username,
          full_name: student.student_name,
          email: virtualEmail,
          role: 'student',
          assigned_major: student.major,
          assigned_class: student.class_info,
          assigned_grade: student.graduation_year ? (2026 + 4 - student.graduation_year) : null,
        }, { onConflict: 'id' }),
        saveStudentAccountMeta(studentId, {
          auth_user_id: authUserId,
          is_custom_password: false,
          password_changed_at: null,
          last_reset_at: new Date().toISOString(),
          last_reset_by: currentUser.full_name || currentUser.username,
        }),
      ]);
    }

    // 5. 감사 로그는 백그라운드 비동기로 처리 (사용자 대기시간 제로화)
    void logAuditAction({
      actor_name: currentUser.full_name || currentUser.username,
      action_type: 'PASSWORD_RESET',
      target_name: `${student.student_name} (${student.class_info}반 ${student.student_number}번) 학생 비밀번호 초기화`,
      details: {
        student_id: student.id,
        student_name: student.student_name,
        reset_by: currentUser.full_name || currentUser.username,
        reset_to: '휴대폰 뒷 4자리',
        timestamp: new Date().toISOString(),
      },
    });

    return { 
      success: true, 
      message: `${student.student_name} 학생의 비밀번호가 휴대폰 뒷자리(${last4})로 초기화되었습니다.` 
    };
  } catch (e: any) {
    console.error('Error in resetStudentPasswordAction:', e);
    return { success: false, error: e.message || '초기화 중 오류가 발생했습니다.' };
  }
}
