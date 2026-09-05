import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';

async function getMasterAdminUsername(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'master_admin_info')
    .maybeSingle();
  return (data?.value as any)?.username ?? '';
}

/**
 * 교수학습지원 페이지 접근 권한 검사
 * - 모든 교직원 및 관리자: 기본 접근 허용
 * - 사용자 관리에서 개별 권한이 지정된 경우 해당 설정 우선 준수
 * - 학생(student): 접근 불가
 */
export async function checkTeachingSupportPermission(targetPath: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  if (profile.role === 'student') return false;

  const masterUsername = await getMasterAdminUsername();
  const isMaster = Boolean(masterUsername && profile.username === masterUsername);

  if (isMaster) return true;

  try {
    const supabase = await createClient();
    const { data: permSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'user_custom_permissions')
      .maybeSingle();

    if (permSetting?.value && typeof permSetting.value === 'object') {
      const permMap = permSetting.value as Record<string, string[]>;
      const userPerms = permMap[profile.id];
      // 관리자가 해당 사용자에게 개별 커스텀 권한 목록을 설정해 둔 경우 해당 권한 준수
      if (Array.isArray(userPerms)) {
        return userPerms.includes(targetPath);
      }
    }
  } catch (err) {
    console.error('Permission check error:', err);
  }

  // 기본값: 모든 교직원 및 관리자 접근 허용
  return true;
}
