import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data';
import { unstable_cache } from 'next/cache';
import { getMasterAdminInfo } from '@/app/(dashboard)/admin/users/actions';

/**
 * 사용자별 개별 메뉴 권한 맵 조회 (Next.js 캐시 적용)
 */
export const getCachedCustomPermissionsMap = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    try {
      const supabase = createAdminClient();
      const { data: permSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'user_custom_permissions')
        .maybeSingle();

      if (permSetting?.value && typeof permSetting.value === 'object') {
        return permSetting.value as Record<string, string[]>;
      }
    } catch (err) {
      console.error('Failed to get cached custom permissions:', err);
    }
    return {};
  },
  ['user-custom-permissions-map'],
  { revalidate: 3600, tags: ['system_settings'] }
);

/**
 * 교수학습지원 및 입학지원 페이지 접근 권한 검사
 * - 모든 교직원 및 관리자: 기본 접근 허용
 * - 사용자 관리에서 개별 권한이 지정된 경우 해당 설정 우선 준수
 * - 학생(student): 접근 불가
 */
export async function checkTeachingSupportPermission(targetPath: string): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  if (profile.role === 'student') return false;

  const masterInfo = await getMasterAdminInfo();
  const masterUsername = masterInfo.username;
  const isMaster = Boolean(
    profile.role === 'admin' && (
      (masterUsername && profile.username === masterUsername) ||
      profile.username === '이호중' ||
      profile.full_name === '이호중'
    )
  );

  if (isMaster) return true;

  try {
    const permMap = await getCachedCustomPermissionsMap();
    const userPerms = permMap[profile.id];
    // 관리자가 해당 사용자에게 개별 커스텀 권한 목록을 설정해 둔 경우 해당 권한 준수
    if (Array.isArray(userPerms)) {
      if (targetPath === '/teaching-support/substitute/admin') {
        return userPerms.includes('/teaching-support/substitute');
      }
      return userPerms.includes(targetPath);
    }
  } catch (err) {
    console.error('Permission check error:', err);
  }

  // 기본값: 모든 교직원 및 관리자 접근 허용
  return true;
}
