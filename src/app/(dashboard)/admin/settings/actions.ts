'use server'

import { revalidatePath, unstable_cache, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

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
  const supabase = createAdminClient();
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
 * [캐싱] 옥저인증제 종합 설정 서버 메모리 캐싱 (0.005초 응답)
 */
export async function getCachedCertificationConfig(): Promise<CertificationConfig> {
  return unstable_cache(
    async () => getCertificationConfig(),
    ['certification-config-cache'],
    { revalidate: 86400, tags: ['settings', 'cert-grades'] }
  )();
}

/**
 * 옥저인증제 종합 설정 저장
 */
export async function updateCertificationConfig(config: CertificationConfig) {
  const supabase = createAdminClient();
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
  const supabase = createAdminClient()

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

export interface MeritDemeritRule {
  id: string;
  type: 'merit' | 'demerit';
  category: string;
  name: string;
  points: number;
  description?: string;
  isActive: boolean;
  order?: number;
}

const DEFAULT_MERIT_DEMERIT_RULES: MeritDemeritRule[] = [
  // 상점 (Merit)
  { id: 'm-1', type: 'merit', category: '봉사/선행', name: '교내외 선행 및 모범 행동', points: 3, isActive: true, order: 1 },
  { id: 'm-2', type: 'merit', category: '봉사/선행', name: '교내 환경 정화 및 자발적 봉사활동', points: 2, isActive: true, order: 2 },
  { id: 'm-3', type: 'merit', category: '기본생활', name: '학급 및 학생회 임원 활동 솔선수범', points: 3, isActive: true, order: 3 },
  { id: 'm-4', type: 'merit', category: '학습활동', name: '수업 태도 우수 및 학업 성취 향상', points: 2, isActive: true, order: 4 },
  { id: 'm-5', type: 'merit', category: '학습활동', name: '국가기술자격증/공인자격증 취득', points: 5, isActive: true, order: 5 },
  { id: 'm-6', type: 'merit', category: '학습활동', name: '교내외 기능경기대회 및 경시대회 입상', points: 5, isActive: true, order: 6 },
  { id: 'm-7', type: 'merit', category: '기본생활', name: '한 학기 무결석 (개근)', points: 4, isActive: true, order: 7 },
  { id: 'm-8', type: 'merit', category: '기본생활', name: '교직원 지도 보조 및 교내 행사 지원', points: 1, isActive: true, order: 8 },

  // 벌점 (Demerit)
  { id: 'd-1', type: 'demerit', category: '출결/지각', name: '무단 지각 / 무단 조퇴 / 무단 결과', points: 1, isActive: true, order: 1 },
  { id: 'd-2', type: 'demerit', category: '출결/지각', name: '무단 결석 (1일당)', points: 3, isActive: true, order: 2 },
  { id: 'd-3', type: 'demerit', category: '복장/용모', name: '교복 및 용모 규정 위반', points: 1, isActive: true, order: 3 },
  { id: 'd-4', type: 'demerit', category: '수업태도', name: '수업 중 전자기기(휴대폰) 무단 사용', points: 2, isActive: true, order: 4 },
  { id: 'd-5', type: 'demerit', category: '수업태도', name: '수업 진행 방해 및 교사 지도 불응', points: 3, isActive: true, order: 5 },
  { id: 'd-6', type: 'demerit', category: '생활안전', name: '교내 흡연 또는 담배/라이터 소지', points: 5, isActive: true, order: 6 },
  { id: 'd-7', type: 'demerit', category: '생활안전', name: '교내 시설물 및 공공 비품 훼손', points: 3, isActive: true, order: 7 },
  { id: 'd-8', type: 'demerit', category: '생활안전', name: '폭력, 괴롭힘 및 언어폭력', points: 5, isActive: true, order: 8 },
  { id: 'd-9', type: 'demerit', category: '기본생활', name: '지정 구역 외 무단 외출', points: 2, isActive: true, order: 9 },
];

/**
 * 표준 상벌점 기본 규정 프리셋 조회 (비동기 함수)
 */
export async function getDefaultMeritDemeritRules(): Promise<MeritDemeritRule[]> {
  return DEFAULT_MERIT_DEMERIT_RULES;
}

/**
 * 상벌점 기준 항목 조회 (캐싱 적용)
 */
export async function getMeritDemeritRules(): Promise<MeritDemeritRule[]> {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'merit_demerit_rules')
      .maybeSingle();

    if (error) throw error;
    if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
      return data.value as MeritDemeritRule[];
    }
    return DEFAULT_MERIT_DEMERIT_RULES;
  } catch (error) {
    console.error('Error fetching merit demerit rules:', error);
    return DEFAULT_MERIT_DEMERIT_RULES;
  }
}

/**
 * [캐싱] 상벌점 기준 항목 서버 메모리 캐시 (초고속 응답)
 */
export async function getCachedMeritDemeritRules(): Promise<MeritDemeritRule[]> {
  return unstable_cache(
    async () => getMeritDemeritRules(),
    ['merit-demerit-rules-cache'],
    {
      revalidate: 86400,
      tags: ['settings', 'merit-demerit-rules']
    }
  )();
}

/**
 * 상벌점 기준 항목 일괄 저장/수정
 */
export async function updateMeritDemeritRules(rules: MeritDemeritRule[]) {
  const supabase = createAdminClient();
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'merit_demerit_rules',
        value: rules,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    revalidateTag('settings');
    revalidateTag('merit-demerit-rules');
    revalidateTag('merit-demerit');
    revalidatePath('/admin/settings');
    revalidatePath('/merit-demerit');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving merit demerit rules:', error);
    return { error: error.message };
  }
}
