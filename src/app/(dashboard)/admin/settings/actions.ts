'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface MasterCertificate {
  name: string;
  levels: string[];
}

/**
 * 시스템 설정 조회 (기준년도 등)
 */
export async function getSystemSettings(): Promise<{ baseYear: number }> {
  const supabase = await createClient()
  
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
}

/**
 * 시스템 설정 저장
 */
export async function updateSystemSettings(settings: { baseYear: number }) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ 
        key: 'base_year', 
        value: { year: settings.baseYear },
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating settings in database:', error)
    return { error: error.message }
  }
}

/**
 * 마스터 자격증 목록 조회
 */
export async function getMasterCertificates(): Promise<MasterCertificate[]> {
  const supabase = await createClient()

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
 * 마스터 자격증 목록 저장
 */
export async function updateMasterCertificates(certificates: MasterCertificate[]) {
  const supabase = await createClient()

  try {
    // 트랜잭션 대신 기존 데이터를 삭제하고 다시 삽입하는 방식 (또는 upsert 활용)
    // 1. 기존 데이터 삭제
    const { error: deleteError } = await supabase
      .from('master_certificates')
      .delete()
      .neq('name', '___dummy___') // 전체 삭제를 위한 트릭

    if (deleteError) throw deleteError

    // 2. 새 데이터 삽입
    if (certificates.length > 0) {
      const { error: insertError } = await supabase
        .from('master_certificates')
        .insert(certificates.map(cert => ({
          name: cert.name,
          levels: cert.levels
        })))

      if (insertError) throw insertError
    }

    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating certificates in database:', error)
    return { error: error.message }
  }
}
