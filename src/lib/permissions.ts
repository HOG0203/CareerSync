import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';

/**
 * 교수학습지원 페이지 접근 권한 검사
 * - 메인 관리자(이호중): 무조건 접근 가능 (기본 세팅)
 * - 그 외 모든 사용자: admin/users에서 커스텀 권한으로 해당 경로가 부여된 경우에만 접근 허용
 */
export async function checkTeachingSupportPermission(targetPath: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;

  const isMaster = 
    profile.username === '이호중' || 
    profile.full_name === '이호중';

  if (isMaster) return true;

  try {
    const supabase = await createClient();
    const [{ data: masterSetting }, { data: permSetting }] = await Promise.all([
      supabase.from('system_settings').select('value').eq('key', 'master_admin_info').maybeSingle(),
      supabase.from('system_settings').select('value').eq('key', 'user_custom_permissions').maybeSingle(),
    ]);

    const masterUsername = (masterSetting?.value as any)?.username || '이호중';
    if (profile.username === masterUsername) return true;

    if (permSetting?.value && typeof permSetting.value === 'object') {
      const permMap = permSetting.value as Record<string, string[]>;
      const userPerms = permMap[profile.id];
      if (Array.isArray(userPerms) && userPerms.includes(targetPath)) {
        return true;
      }
    }
  } catch (err) {
    console.error('Permission check error:', err);
  }

  return false;
}
