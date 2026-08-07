'use server';

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

const DOMAIN = 'careersync.local'

export async function createUser(formData: FormData) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const username = formData.get('username') as string
  const password = (formData.get('password') as string) || '123123'
  const role = formData.get('role') as string // 'admin' or 'teacher'
  const fullName = (formData.get('fullName') as string) || username

  if (!username || !role) {
    return { error: '아이디와 권한은 필수 입력 항목입니다.' }
  }

  const trimmedUsername = username.trim()
  const trimmedFullName = fullName.trim()

  // 1. 아이디 중복 체크
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', trimmedUsername)
    .maybeSingle()

  if (existingProfile) {
    return { error: '이미 사용 중인 아이디입니다.' }
  }

  // 가상 이메일 생성
  const safeLocalPart = Buffer.from(trimmedUsername.toLowerCase()).toString('hex')
  const virtualEmail = `${safeLocalPart}@${DOMAIN}`

  // 2. Supabase Auth 사용자 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: virtualEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username: trimmedUsername,
      full_name: trimmedFullName,
    }
  })

  if (authError) {
    return { error: `계정 생성 실패: ${authError.message}` }
  }

  // 3. Profiles 테이블 데이터 삽입
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ 
      id: authData.user.id, 
      username: trimmedUsername,
      full_name: trimmedFullName,
      email: virtualEmail,
      role: role as any,
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    return { error: `프로필 설정 실패: ${profileError.message}` }
  }

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * 사용자 일괄 생성 (Excel Import용)
 */
export async function bulkCreateUsers(users: { username: string, fullName: string, role: string }[]) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const results = {
    successCount: 0,
    failures: [] as { username: string, reason: string }[]
  }

  for (const user of users) {
    try {
      const { username, fullName, role } = user
      if (!username || !role) {
        results.failures.push({ username: username || 'Unknown', reason: '아이디 또는 권한 누락' })
        continue
      }

      const trimmedUsername = username.trim()
      const trimmedFullName = fullName.trim() || trimmedUsername
      const mappedRole = role === '관리자' ? 'admin' : 'teacher'

      // 1. 중복 체크
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .maybeSingle()

      if (existing) {
        results.failures.push({ username: trimmedUsername, reason: '이미 존재하는 아이디' })
        continue
      }

      // 2. Auth 사용자 생성
      const safeLocalPart = Buffer.from(trimmedUsername.toLowerCase()).toString('hex')
      const virtualEmail = `${safeLocalPart}@${DOMAIN}`

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: virtualEmail,
        password: '123123',
        email_confirm: true,
        user_metadata: {
          username: trimmedUsername,
          full_name: trimmedFullName,
        }
      })

      if (authError) {
        results.failures.push({ username: trimmedUsername, reason: `Auth 생성 실패: ${authError.message}` })
        continue
      }

      // 3. Profile 생성
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({ 
          id: authData.user.id, 
          username: trimmedUsername,
          full_name: trimmedFullName,
          email: virtualEmail,
          role: mappedRole as any,
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        // Auth는 생성되었는데 프로필이 실패한 경우 (일단 실패로 기록)
        results.failures.push({ username: trimmedUsername, reason: `프로필 생성 실패: ${profileError.message}` })
        continue
      }

      results.successCount++
    } catch (err: any) {
      results.failures.push({ username: user.username, reason: `알 수 없는 오류: ${err.message}` })
    }
  }

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true, count: results.successCount, failures: results.failures }
}

/**
 * 관리자용 사용자 비밀번호 초기화 (123123으로 초기화)
 */
export async function resetUserPassword(userId: string) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  // Supabase Auth Admin API를 사용하여 비밀번호 강제 업데이트
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: '123123'
  })

  if (authError) {
    console.error('Error resetting password:', authError)
    return { error: `비밀번호 초기화 실패: ${authError.message}` }
  }

  return { success: true }
}

export async function updateUserRole(userId: string, newRole: string) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole as any })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateAssignedClass(userId: string, data: { year: number | null, major: string | null, className: string | null, grade: number | null }) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ 
      assigned_year: data.year,
      assigned_major: data.major,
      assigned_class: data.className,
      assigned_grade: data.grade
    })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidateTag('profiles');
  revalidateTag('teachers');
  revalidatePath('/admin/users');
  revalidatePath('/employment-status');
  revalidatePath('/class-management');
  revalidatePath('/students');
  return { success: true };
}

export async function deleteUser(userId: string) {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) {
    return { error: '권한이 없습니다.' }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    return { error: error.message }
  }

  revalidateTag('profiles')
  revalidateTag('teachers')
  revalidatePath('/admin/users')
  return { success: true }
}
