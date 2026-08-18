'use server'

import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface MasterCertificate {
  name: string;
  levels: string[];
}

const getSystemSettingsCached = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'base_year')
        .single()

      if (error) throw error
      return { baseYear: (data.value as any).year }
    } catch (error) {
      console.error('Error reading settings from database:', error)
      return { baseYear: 2026 }
    }
  },
  ['system-settings'],
  { revalidate: 3600, tags: ['settings'] }
)

/**
 * 시스템 설정 조회 (기준년도 등)
 */
export async function getSystemSettings(): Promise<{ baseYear: number }> {
  return getSystemSettingsCached()
}

export interface CertificationConfig {
  gradeWeights: Record<string, number>;
  attendanceRules: {
    baseScore: number;
    unexcusedAbsentDeduct: number;
    unexcusedLateDeduct: number;
    maxDeductLimit: number;
  };
  certificateRules: {
    basePointsPerCert: number;
    maxCertificatePoints: number;
  };
}

const DEFAULT_CERTIFICATION_CONFIG: CertificationConfig = {
  gradeWeights: { "A": 5, "B": 4, "C": 3, "D": 2, "E": 1 },
  attendanceRules: {
    baseScore: 100,
    unexcusedAbsentDeduct: 5,
    unexcusedLateDeduct: 2,
    maxDeductLimit: 50,
  },
  certificateRules: {
    basePointsPerCert: 10,
    maxCertificatePoints: 50,
  },
};

/**
 * 옥저인증제 종합 설정 조회 (성적, 출결, 자격증 점수)
 */
export async function getCertificationConfig(): Promise<CertificationConfig> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'certification_config')
      .single();

    if (error) throw error;
    return {
      ...DEFAULT_CERTIFICATION_CONFIG,
      ...(data.value as Partial<CertificationConfig>),
    };
  } catch (error) {
    return DEFAULT_CERTIFICATION_CONFIG;
  }
}

/**
 * 옥저인증제 종합 설정 저장
 */
export async function updateCertificationConfig(config: CertificationConfig) {
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'certification_config',
        value: config,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    revalidateTag('cert-grades');
    revalidatePath('/admin/settings');
    revalidatePath('/admin/certification/grades');
    return { success: true };

  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * 시스템 설정 저장 (baseYear 변경 시 전년도 자동 스냅샷 백업 및 Audit Log 기록)
 */
export async function updateSystemSettings(settings: { baseYear: number }) {
  const supabase = createAdminClient();

  try {
    // 기존 기준년도 확인
    const currentSettings = await getSystemSettings();
    const oldBaseYear = currentSettings.baseYear;

    // 만약 학사학년도가 변경되면 변경 전 학년도 데이터 자동 스냅샷 백업 수행
    if (oldBaseYear !== settings.baseYear) {
      const { createAcademicHistorySnapshot } = await import('@/lib/academic-snapshots');
      await createAcademicHistorySnapshot({
        baseYear: oldBaseYear,
        snapshotName: `${oldBaseYear}학년도 학적 최종 마감 자동 스냅샷`
      });
    }

    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: 'base_year', 
        value: { year: settings.baseYear },
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    // Audit Log 기록
    const { logAuditAction } = await import('@/lib/audit-logger');
    await logAuditAction({
      action_type: 'SYSTEM_SETTING_UPDATE',
      target_name: '학사학년도 설정',
      details: { oldBaseYear, newBaseYear: settings.baseYear }
    });

    revalidateTag('settings');
    revalidatePath('/', 'layout');
    return { success: true, snapshotCreated: oldBaseYear !== settings.baseYear };
  } catch (error: any) {
    console.error('Error updating settings in database:', error);
    return { error: error.message };
  }
}

/**
 * 마스터 자격증 목록 조회
 */
export async function getMasterCertificates(): Promise<MasterCertificate[]> {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('master_certificates')
      .select('name, levels')
      .order('name')

    if (error) throw error
    
    return (data || []).map(item => ({
      name: item.name,
      levels: Array.isArray(item.levels) ? item.levels : []
    }))
  } catch (error) {
    console.error('Error reading certificates from database:', error)
    return [
      { name: "컴퓨터활용능력", levels: ["1급", "2급"] },
      { name: "전기기능사", levels: [] }
    ]
  }
}

/**
 * [캐싱] 마스터 자격증 목록 서버 메모리 캐싱
 */
export async function getCachedMasterCertificates(): Promise<MasterCertificate[]> {
  return unstable_cache(
    async () => getMasterCertificates(),
    ['master-certificates-list'],
    {
      revalidate: 86400,
      tags: ['settings', 'master-certificates']
    }
  )();
}

/**
 * 마스터 자격증 목록 저장
 */
export async function updateMasterCertificates(certificates: MasterCertificate[]) {
  const supabase = await createClient()

  try {
    const { error: deleteError } = await supabase
      .from('master_certificates')
      .delete()
      .neq('name', '')

    if (deleteError) throw deleteError

    if (certificates.length > 0) {
      const { error: insertError } = await supabase
        .from('master_certificates')
        .insert(certificates.map(cert => ({
          name: cert.name,
          levels: cert.levels
        })))

      if (insertError) throw insertError
    }

    revalidateTag('master-certificates');
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating certificates in database:', error)
    return { error: error.message }
  }
}

export interface DashboardChartLayout {
  grade3Order?: string[];
  lowerGradeOrder?: string[];
}

/**
 * 대시보드 차트 배치 순서 조회 (서버 캐싱)
 */
export async function getDashboardChartLayout(): Promise<DashboardChartLayout> {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'dashboard_chart_layout')
          .single();

        if (error) throw error;
        return (data.value as DashboardChartLayout) || {};
      } catch (error) {
        return {};
      }
    },
    ['dashboard-chart-layout'],
    { revalidate: 3600, tags: ['settings', 'dashboard-layout'] }
  )();
}

/**
 * 대시보드 차트 배치 순서 저장 (관리자 전용)
 */
export async function saveDashboardChartLayout(key: 'grade3Order' | 'lowerGradeOrder', newOrder: string[]) {
  const supabase = createAdminClient();

  try {
    const { data: existingData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'dashboard_chart_layout')
      .maybeSingle();

    const currentLayout: DashboardChartLayout = existingData?.value ? (existingData.value as any) : {};
    const updatedLayout: DashboardChartLayout = {
      ...currentLayout,
      [key]: newOrder
    };

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'dashboard_chart_layout',
        value: updatedLayout,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    revalidateTag('settings');
    revalidateTag('dashboard-layout');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving dashboard chart layout:', error);
    return { error: error.message };
  }
}
