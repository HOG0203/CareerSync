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
    return profile.username === masterInfo.username;
  } catch (err) {
    return false;
  }
}

/**
 * 서브관리자(Sub-Admin) 목록 조회
 */
export async function getSubAdminList(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'sub_admin_list')
      .maybeSingle();

    if (data?.value && Array.isArray(data.value)) {
      return data.value as string[];
    }
    return [];
  } catch (err) {
    console.error('Failed to get sub admin list:', err);
    return [];
  }
}

/**
 * 현재 로그인한 사용자가 서브관리자(또는 메인관리자)인지 검증 (방안 A형 준최고관리자)
 */
export async function checkIsSubAdmin(): Promise<boolean> {
  try {
    const isMaster = await checkIsMasterAdmin();
    if (isMaster) return true;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') return false;

    const subAdmins = await getSubAdminList();
    return subAdmins.includes(profile.username);
  } catch (err) {
    return false;
  }
}

/**
 * 서브관리자 임명 / 해제 (메인관리자 전용)
 */
export async function toggleSubAdminAction(targetUsername: string) {
  const isMaster = await checkIsMasterAdmin();
  if (!isMaster) {
    return { error: '메인관리자만 서브관리자를 임명하거나 해제할 수 있습니다.' };
  }

  const masterInfo = await getMasterAdminInfo();
  if (targetUsername === masterInfo.username) {
    return { error: '메인관리자는 서브관리자로 변경할 수 없습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('username', targetUsername)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const currentSubAdmins = await getSubAdminList();
  const isAlreadySubAdmin = currentSubAdmins.includes(targetUsername);

  let newSubAdmins: string[];
  let actionVerb: string;

  if (isAlreadySubAdmin) {
    newSubAdmins = currentSubAdmins.filter(u => u !== targetUsername);
    actionVerb = '서브관리자 해제';
  } else {
    newSubAdmins = [...currentSubAdmins, targetUsername];
    actionVerb = '서브관리자 임명';

    // 서브관리자로 임명 시 관리자(admin) 역할로 자동 승격
    if (targetProfile.role !== 'admin') {
      await supabaseAdmin
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', targetProfile.id);
    }
  }

  const { error } = await supabaseAdmin
    .from('system_settings')
    .upsert({
      key: 'sub_admin_list',
      value: newSubAdmins,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { error: error.message };
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_ROLE_UPDATE',
    target_name: `${actionVerb} ➔ ${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`,
    details: { targetUsername, isSubAdmin: !isAlreadySubAdmin },
  });

  revalidateTag('system_settings');
  revalidateTag('profiles');
  revalidatePath('/admin/users');
  revalidatePath('/', 'layout');
  return { success: true, isSubAdmin: !isAlreadySubAdmin, subAdminList: newSubAdmins };
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
  const canManage = (await checkIsMasterAdmin()) || (await checkIsSubAdmin())
  if (!canManage) {
    return { error: '메인관리자 또는 서브관리자만 신규 사용자를 등록할 수 있습니다.' }
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
 * 사용자 일괄 생성 (Excel Import용 - 메인관리자 및 서브관리자 허용)
 */
export async function bulkCreateUsers(users: { username: string, fullName: string, role: string }[]) {
  const canManage = (await checkIsMasterAdmin()) || (await checkIsSubAdmin())
  if (!canManage) {
    return { error: '메인관리자 또는 서브관리자만 일괄 계정을 생성할 수 있습니다.' }
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
 * 사용자 권한 등급 체계 (1: 메인관리자, 2: 서브관리자, 3: 일반관리자, 4: 일반교직원)
 */
export type AdminRank = 1 | 2 | 3 | 4;

export async function getUserRank(profile: { username?: string | null; full_name?: string | null; role?: string | null } | null): Promise<AdminRank> {
  if (!profile) return 4;
  const masterInfo = await getMasterAdminInfo();
  if (profile.username === masterInfo.username) {
    return 1;
  }
  if (profile.role === 'admin') {
    const subAdmins = await getSubAdminList();
    if (profile.username && subAdmins.includes(profile.username)) {
      return 2;
    }
    return 3;
  }
  return 4;
}

export async function getCurrentUserRank(): Promise<{ rank: AdminRank; profile: any | null }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { rank: 4, profile: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, full_name, role')
      .eq('id', user.id)
      .single();

    const rank = await getUserRank(profile);
    return { rank, profile };
  } catch (err) {
    return { rank: 4, profile: null };
  }
}

/**
 * 관리자용 사용자 비밀번호 초기화 (123123으로 초기화 - 상위 관리자만 하위 관리자/교직원 초기화 가능)
 */
export async function resetUserPassword(userId: string) {
  const { rank: actorRank } = await getCurrentUserRank();
  if (actorRank >= 4) {
    return { error: '비밀번호를 초기화할 권한이 없습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const targetRank = await getUserRank(targetProfile);
  if (actorRank >= targetRank) {
    return { error: '상위 또는 동급 관리자의 비밀번호는 초기화할 수 없습니다. (자신보다 하위 등급만 가능)' };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: '123123'
  });

  if (authError) {
    console.error('Error resetting password:', authError);
    return { error: `비밀번호 초기화 실패: ${authError.message}` };
  }

  const targetLabel = `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`;

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'PASSWORD_RESET',
    target_name: targetLabel,
    details: { userId }
  });

  return { success: true };
}

/**
 * 사용자 역할 변경 (상위 관리자만 하위 사용자의 역할 변경 가능)
 */
export async function updateUserRole(userId: string, newRole: string) {
  const { rank: actorRank } = await getCurrentUserRank();
  if (actorRank > 2) {
    return { error: '메인관리자 또는 서브관리자만 사용자의 역할을 변경할 수 있습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const targetRank = await getUserRank(targetProfile);
  if (actorRank >= targetRank) {
    return { error: '상위 또는 동급 관리자의 역할은 변경할 수 없습니다. (자신보다 하위 등급만 가능)' };
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole as any })
    .eq('id', userId);

  if (error) {
    return { error: error.message };
  }

  const targetLabel = `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`;

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_ROLE_UPDATE',
    target_name: targetLabel,
    details: { userId, oldRole: targetProfile?.role, newRole }
  });

  revalidateTag('profiles');
  revalidateTag('teachers');
  revalidatePath('/admin/users');
  return { success: true };
}

/**
 * 담당 학반 배정 (상위 관리자만 하위 사용자의 담당 학반 변경 가능)
 */
export async function updateAssignedClass(userId: string, data: { year: number | null, major: string | null, className: string | null, grade: number | null }) {
  const { rank: actorRank } = await getCurrentUserRank();
  if (actorRank >= 4) {
    return { error: '담당 학반을 배정할 권한이 없습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const targetRank = await getUserRank(targetProfile);
  if (actorRank >= targetRank) {
    return { error: '상위 또는 동급 관리자의 담당 학반은 변경할 수 없습니다. (자신보다 하위 등급만 가능)' };
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      assigned_year: data.year,
      assigned_major: data.major,
      assigned_class: data.className,
      assigned_grade: data.grade
    })
    .eq('id', userId);

  if (error) {
    return { error: error.message };
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'HOMEROOM_ASSIGN',
    target_name: `${targetProfile.full_name || targetProfile.username} 담임 배정 변경 (${data.grade ? `${data.grade}학년 ` : ''}${data.major || ''} ${data.className ? `${data.className}반` : ''})`,
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
 * 사용자 삭제 (상위 관리자만 하위 사용자 삭제 가능 & 본인 삭제 불가)
 */
export async function deleteUser(userId: string) {
  const { rank: actorRank, profile: actorProfile } = await getCurrentUserRank();
  if (actorRank > 2) {
    return { error: '메인관리자 또는 서브관리자만 계정을 삭제할 수 있습니다.' };
  }

  if (actorProfile && actorProfile.id === userId) {
    return { error: '현재 로그인 중인 본인 계정은 삭제할 수 없습니다.' };
  }

  // 삭제 대상 프로필 정보 먼저 조회
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const targetRank = await getUserRank(targetProfile);
  if (actorRank >= targetRank) {
    return { error: '상위 또는 동급 관리자의 계정은 삭제할 수 없습니다. (자신보다 하위 등급만 가능)' };
  }

  const targetLabel = `${targetProfile.full_name || targetProfile.username} (${targetProfile.username})`;

  // 1. public.profiles 테이블에서 먼저 삭제
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileErr) {
    return { error: `프로필 삭제 실패: ${profileErr.message}` };
  }

  // 2. Supabase Auth 유저 삭제
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authErr && !authErr.message?.toLowerCase().includes('not found')) {
    console.warn('Auth user delete notice:', authErr.message);
  }

  const { logAuditAction } = await import('@/lib/audit-logger');
  await logAuditAction({
    action_type: 'USER_DELETE',
    target_name: targetLabel,
    details: { userId, username: targetProfile?.username, role: targetProfile?.role }
  });

  revalidateTag('profiles');
  revalidateTag('teachers');
  revalidatePath('/admin/users');
  return { success: true };
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
 * 특정 사용자의 개별 메뉴 권한 설정 (상위 관리자만 하위 사용자의 권한 설정 가능)
 */
export async function saveUserCustomPermissionsAction(
  userId: string,
  allowedRoutes: string[] | null,
  userName?: string
) {
  const { rank: actorRank } = await getCurrentUserRank();
  if (actorRank > 2) {
    return { error: '메인관리자 또는 서브관리자만 개별 메뉴 권한을 설정할 수 있습니다.' };
  }

  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile) {
    return { error: '대상 사용자를 찾을 수 없습니다.' };
  }

  const targetRank = await getUserRank(targetProfile);
  if (actorRank >= targetRank) {
    return { error: '상위 또는 동급 관리자의 메뉴 권한은 변경할 수 없습니다. (자신보다 하위 등급만 가능)' };
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
      target_name: `메뉴 권한 설정: ${userName || targetProfile.full_name || userId}`,
      details: {
        userId,
        userName: targetProfile.full_name,
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
