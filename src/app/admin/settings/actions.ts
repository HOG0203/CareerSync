'use server'

import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'

const CERT_FILE_PATH = path.join(process.cwd(), 'src/lib/certificates.json')
const SETTINGS_FILE_PATH = path.join(process.cwd(), 'src/lib/system-settings.json')

export interface MasterCertificate {
  name: string;
  levels: string[];
}

/**
 * 시스템 설정 조회
 */
export async function getSystemSettings(): Promise<{ baseYear: number }> {
  try {
    const content = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return { baseYear: 2026 }
  }
}

/**
 * 시스템 설정 저장
 */
export async function updateSystemSettings(settings: { baseYear: number }) {
  try {
    await fs.mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true })
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

/**
 * 마스터 자격증 목록 조회
 */
export async function getMasterCertificates(): Promise<MasterCertificate[]> {
  try {
    const content = await fs.readFile(CERT_FILE_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
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
  try {
    const sortedCerts = [...certificates].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    await fs.mkdir(path.dirname(CERT_FILE_PATH), { recursive: true })
    await fs.writeFile(CERT_FILE_PATH, JSON.stringify(sortedCerts, null, 2), 'utf-8')
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
