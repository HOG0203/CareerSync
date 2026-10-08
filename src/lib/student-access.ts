import { getCurrentUserProfile } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/server';
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions';
import { canEditStudentField, isAssignedStudent } from '@/lib/access-policy';

/** Authorize the entire request before any service-role write. */
export async function authorizeStudentUpdates(updates: { id: string; field: string }[]): Promise<string | null> {
  const profile = await getCurrentUserProfile();
  if (!profile) return '로그인이 필요합니다.';
  if (!Array.isArray(updates) || updates.some(u => !u || typeof u.id !== 'string' || !u.id || !canEditStudentField(profile.role, u.field))) {
    return '수정할 수 없는 항목이 포함되어 있습니다.';
  }
  const { baseYear } = await getSystemSettings();
  const supabase = createAdminClient();
  const ids = [...new Set(updates.map(u => u.id))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const { data, error } = await supabase.from('students')
      .select('id, graduation_year, major, class_info').in('id', chunk);
    if (error) return '학생 접근 권한을 확인하지 못했습니다.';
    if (!data || data.length !== chunk.length || data.some(s => !isAssignedStudent(profile, s, baseYear))) {
      return '담당 학생만 수정할 수 있습니다.';
    }
  }
  return null;
}
