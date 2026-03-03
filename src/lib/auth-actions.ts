'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * 사용자 비밀번호 변경
 */
export async function updatePassword(newPassword: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error updating password:', error)
    return { error: error.message }
  }
}
