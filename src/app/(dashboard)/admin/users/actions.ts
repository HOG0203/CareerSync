'use server';

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

/**
 * 메인관리자(최고 관리자) 식별 정보 조회 (초기값: '이호중')
 */
export async function getMasterAdminInfo(): Promise<{ username: string; name: string }> {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'master_admin_info')
      .maybeSingle();

    if (data?.value && typeof data.value === 'object' && (data.value as any).username) {
      return data.value as { username: string; name: string };
    }
  } catch (err) {
    console.error('Failed to get master admin info:', err);
  }

  // 기본값: '이호중' 성명 또는 '이호중' 아이디를 가진 관리자 계정 탐색
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .or('full_name.eq.이호중,username.eq.이호중')
      .limit(1)
      .maybeSingle();

    if (profile) {
      return { username: profile.username, name: profile.full_name || profile.username };
    }
  } catch (err) {
    // fallback
  }

  return { username: '이호중', name: '이호중' };
}

/**
 * 현재 로그인한 사용자가 메인관리자(최고 관리자)인지 검증
 */
export async function checkIsMasterAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_name, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') return false;

    const masterInfo = await getMasterAdminInfo();
    return (
      profile.username === masterInfo.username ||
      profile.full_name === '이호중' ||
      profile.username === '이호중'
    );
  } catch (err) {
    return false;
  }
}

/**
 * 메인관리자 권한을 다른 사용자에게 이양
 */
export async function transferMasterAdminAction(newMasterUsername: string) {
  const isMaster = await checkIsMasterAdmin();
  if (!isMaster) {
    return { error: '메인관리자만 메인관리자 권한을 이양할 수 있습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('username', newMasterUsername)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  // 대상 사용자를 관리자로 자동 승격
  if (targetProfile.role !== 'admin') {
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', targetProfile.id);
  }

  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert({
      key: 'master_admin_info',
      value: {
        username: targetProfile.username,
        name: targetProfile.full_name || targetProfile.username,
      },
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { error: error.message };
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_ROLE_UPDATE',
    target_name: `메인관리자 권한 이양 ➔ ${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`,
    details: { newMasterUsername, newMasterName: targetProfile.full_name },
  });

  revalidateTag('system_settings');
  revalidateTag('profiles');
  revalidatePath('/admin/users');
  return { success: true };
}

const DOMAIN = 'careersync.local'

export async function createUser(formData: FormData) {
  const isMaster = await checkIsMasterAdmin()
  if (!isMaster) {
    return { error: '메인관리자만 신규 사용자를 등록할 수 있습니다.' }
  }

  const username = formData.get('username') as string
  const password = (formData.get('password') as string) || '123123'
  const role = formData.get('role') as string // 'admin' or 'teacher'
  const fullName = (formData.get('fullName') as string) || username

  if (!username || !role) {
    return { error: '아이디와 권한은 필수 입력 항목입니다.' }
  }

  const trimmedUsername = username.trim()
  const trimmedFullName = fullName.trim()

  // 1. 아이디 중복 체크
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', trimmedUsername)
    .maybeSingle()

  if (existingProfile) {
    return { error: '이미 사용 중인 아이디입니다.' }
  }

  // 가상 이메일 생성
  const safeLocalPart = Buffer.from(trimmedUsername.toLowerCase()).toString('hex')
  const virtualEmail = `${safeLocalPart}@${DOMAIN}`

  // 2. Supabase Auth 사용자 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: virtualEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username: trimmedUsername,
      full_name: trimmedFullName,
    }
  })

  if (authError) {
    return { error: `계정 생성 실패: ${authError.message}` }
  }

  // 3. Profiles 테이블 데이터 삽입
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ 
      id: authData.user.id, 
      username: trimmedUsername,
      full_name: trimmedFullName,
      email: virtualEmail,
      role: role as any,
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    return { error: `프로필 설정 실패: ${profileError.message}` }
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_CREATE',
    target_name: `${trimmedFullName} (${trimmedUsername})`,
    details: { role, username: trimmedUsername }
  });

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * 사용자 일괄 생성 (Excel Import용 - 메인관리자 전용)
 */
export async function bulkCreateUsers(users: { username: string, fullName: string, role: string }[]) {
  const isMaster = await checkIsMasterAdmin()
  if (!isMaster) {
    return { error: '메인관리자만 일괄 계정을 생성할 수 있습니다.' }
  }

  const results = {
    successCount: 0,
    failures: [] as { username: string, reason: string }[]
  }

  for (const user of users) {
    try {
      const { username, fullName, role } = user
      if (!username || !role) {
        results.failures.push({ username: username || 'Unknown', reason: '아이디 또는 권한 누락' })
        continue
      }

      const trimmedUsername = username.trim()
      const trimmedFullName = fullName.trim() || trimmedUsername
      const mappedRole = role === '관리자' ? 'admin' : 'teacher'

      // 1. 중복 체크
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .maybeSingle()

      if (existing) {
        results.failures.push({ username: trimmedUsername, reason: '이미 존재하는 아이디' })
        continue
      }

      // 2. Auth 사용자 생성
      const safeLocalPart = Buffer.from(trimmedUsername.toLowerCase()).toString('hex')
      const virtualEmail = `${safeLocalPart}@${DOMAIN}`

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: virtualEmail,
        password: '123123',
        email_confirm: true,
        user_metadata: {
          username: trimmedUsername,
          full_name: trimmedFullName,
        }
      })

      if (authError) {
        results.failures.push({ username: trimmedUsername, reason: `Auth 생성 실패: ${authError.message}` })
        continue
      }

      // 3. Profile 생성
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({ 
          id: authData.user.id, 
          username: trimmedUsername,
          full_name: trimmedFullName,
          email: virtualEmail,
          role: mappedRole as any,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        results.failures.push({ username: trimmedUsername, reason: `프로필 생성 실패: ${profileError.message}` })
        continue
      }

      results.successCount++
    } catch (err: any) {
      results.failures.push({ username: user.username, reason: `알 수 없는 오류: ${err.message}` })
    }
  }

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true, count: results.successCount, failures: results.failures }
}

/**
 * 관리자용 사용자 비밀번호 초기화 (123123으로 초기화)
 */
export async function resetUserPassword(userId: string) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name')
    .eq('id', userId)
    .maybeSingle()

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: '123123'
  })

  if (authError) {
    console.error('Error resetting password:', authError)
    return { error: `비밀번호 초기화 실패: ${authError.message}` }
  }

  const targetLabel = targetProfile
    ? `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`
    : `계정 (ID: ${userId})`;

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'PASSWORD_RESET',
    target_name: targetLabel,
    details: { userId }
  });

  return { success: true }
}

/**
 * 사용자 역할 변경 (메인관리자 전용)
 */
export async function updateUserRole(userId: string, newRole: string) {
  const isMaster = await checkIsMasterAdmin()
  if (!isMaster) {
    return { error: '메인관리자만 사용자의 역할을 변경할 수 있습니다.' }
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  const masterInfo = await getMasterAdminInfo()
  if (targetProfile && (targetProfile.username === masterInfo.username || targetProfile.full_name === '이호중')) {
    return { error: '메인관리자의 역할은 변경할 수 없습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole as any })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  const targetLabel = targetProfile
    ? `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`
    : `계정 (ID: ${userId})`;

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_ROLE_UPDATE',
    target_name: targetLabel,
    details: { userId, oldRole: targetProfile?.role, newRole }
  });

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateAssignedClass(userId: string, data: { year: number | null, major: string | null, className: string | null, grade: number | null }) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      assigned_year: data.year,
      assigned_major: data.major,
      assigned_class: data.className,
      assigned_grade: data.grade
    })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'HOMEROOM_ASSIGN',
    target_name: `담임 배정 변경 (${data.grade ? `${data.grade}학년 ` : ''}${data.major || ''} ${data.className ? `${data.className}반` : ''})`,
    details: { userId, ...data }
  });

  revalidateTag('profiles');
  revalidateTag('teachers');
  revalidatePath('/admin/users');
  revalidatePath('/employment-status');
  revalidatePath('/class-management');
  revalidatePath('/students');
  return { success: true };
}

/**
 * 사용자 삭제 (메인관리자 전용 & 메인관리자 계정 보호)
 */
export async function deleteUser(userId: string) {
  const isMaster = await checkIsMasterAdmin()
  if (!isMaster) {
    return { error: '메인관리자만 계정을 삭제할 수 있습니다.' }
  }

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (currentUser && currentUser.id === userId) {
    return { error: '현재 로그인 중인 본인 계정은 삭제할 수 없습니다.' }
  }

  // 삭제 대상 프로필 정보 먼저 조회
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('username, full_name, role')
    .eq('id', userId)
    .maybeSingle()

  const masterInfo = await getMasterAdminInfo()
  if (targetProfile && (targetProfile.username === masterInfo.username || targetProfile.full_name === '이호중')) {
    return { error: '메인관리자 계정은 삭제할 수 없습니다.' }
  }

  const targetLabel = targetProfile
    ? `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`
    : `계정 (ID: ${userId})`;

  // 1. public.profiles 테이블에서 먼저 삭제
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileErr) {
    return { error: `프로필 삭제 실패: ${profileErr.message}` }
  }

  // 2. Supabase Auth 유저 삭제
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authErr && !authErr.message?.toLowerCase().includes('not found')) {
    console.warn('Auth user delete notice:', authErr.message)
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_DELETE',
    target_name: targetLabel,
    details: { userId, username: targetProfile?.username, role: targetProfile?.role }
  });

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * 전체 사용자의 개별 메뉴 권한 맵 조회
 */
export async function getUserCustomPermissionsMapAction(): Promise<Record<string, string[]>> {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'user_custom_permissions')
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      return data.value as Record<string, string[]>;
    }
    return {};
  } catch (err) {
    console.error('Failed to get user custom permissions:', err);
    return {};
  }
}

/**
 * 특정 사용자의 개별 메뉴 권한 설정 (메인관리자 전용)
 */
export async function saveUserCustomPermissionsAction(
  userId: string,
  allowedRoutes: string[] | null,
  userName?: string
) {
  const isMaster = await checkIsMasterAdmin();
  if (!isMaster) {
    return { error: '메인관리자만 개별 메뉴 권한을 설정할 수 있습니다.' };
  }

  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'user_custom_permissions')
      .maybeSingle();

    let currentMap: Record<string, string[]> = {};
    if (data?.value && typeof data.value === 'object') {
      currentMap = { ...(data.value as Record<string, string[]>) };
    }

    if (allowedRoutes === null) {
      delete currentMap[userId];
    } else {
      currentMap[userId] = allowedRoutes;
    }

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: 'user_custom_permissions',
        value: currentMap,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { error: error.message };
    }

    const { logAuditAction } = await import('@/lib/audit-logger');
    await logAuditAction({
      action_type: 'USER_ROLE_UPDATE',
      target_name: `메뉴 권한 설정: ${userName || userId}`,
      details: {
        userId,
        userName,
        isCustom: allowedRoutes !== null,
        allowedRoutes,
      },
    });

    revalidateTag('system_settings');
    revalidatePath('/admin/users');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || '저장 중 오류가 발생했습니다.' };
  }
}
