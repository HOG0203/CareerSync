'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserProfile } from '@/lib/data'

/**
 * 현장실습 레코드 상태/일정 빠른 수정 Server Action
 */
export async function updateFieldTrainingStatusAction(
  recordId: string,
  field: string,
  value: any
) {
  const profile = await getCurrentUserProfile()
  if (profile?.role !== 'admin') {
    return { success: false, error: '현장실습 정보 수정은 관리자 권한이 필요합니다.' }
  }

  const supabase = await createClient()

  const allowedFields = [
    'stipend_status',
    'hiring_status',
    'conversion_date',
    'return_reason',
    'company',
    'start_date',
    'end_date'
  ]

  if (!allowedFields.includes(field)) {
    return { success: false, error: '허용되지 않은 수정 항목입니다.' }
  }

  const { error } = await supabase
    .from('field_training_records')
    .update({
      [field]: value === '' || value === 'CLEARED' ? null : value,
      updated_at: new Date().toISOString()
    })
    .eq('id', recordId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/field-training')
  revalidatePath('/students')
  revalidatePath('/class-management')
  revalidatePath('/company-info')
  revalidatePath('/employment-status')

  return { success: true }
}
