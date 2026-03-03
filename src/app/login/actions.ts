'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DOMAIN = 'careersync.local'

/**
 * 아이디를 기반으로 가상 이메일을 생성합니다.
 * 한글 아이디 지원을 위해 Hex 인코딩을 사용하여 ASCII 안전한 형식을 만듭니다.
 */
function generateEmailFromUsername(username: string): string {
  const safeLocalPart = Buffer.from(username.trim().toLowerCase()).toString('hex')
  return `${safeLocalPart}@${DOMAIN}`
}

export async function login(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  
  if (!username || !password) {
    return { error: '아이디와 비밀번호를 모두 입력해주세요.' }
  }

  const supabase = await createClient()

  // 1. username으로 profiles 테이블에서 사용자 ID 조회
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (profileError || !profile) {
    return { error: '아이디 또는 비밀번호가 잘못되었습니다.' }
  }

  // 2. admin 클라이언트를 사용하여 실제 이메일 정보 획득
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id)

  if (userError || !userData.user || !userData.user.email) {
    return { error: '아이디 또는 비밀번호가 잘못되었습니다.' }
  }

  // 3. 조회된 이메일로 로그인 수행
  const { error } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password,
  })

  if (error) {
    return { error: '아이디 또는 비밀번호가 잘못되었습니다.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  
  if (!username || !password || !fullName) {
    return { error: '모든 필드를 입력해주세요.' }
  }

  const virtualEmail = generateEmailFromUsername(username)

  // 1. 아이디 중복 체크
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existingProfile) {
    return { error: '이미 사용 중인 아이디입니다.' }
  }

  // 2. Supabase Auth에 사용자 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: virtualEmail,
    password: password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName
    }
  })

  if (authError || !authData.user) {
    return { error: `계정 생성 실패: ${authError?.message}` }
  }

  // 3. profiles 테이블에 정보 저장
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authData.user.id,
      username: username,
      full_name: fullName,
      email: virtualEmail, // <--- 이메일 컬럼 추가
      role: 'staff' // 기본 역할 설정
    })

  if (profileError) {
    // 만약 프로필 저장 실패 시 생성된 auth 계정 삭제 고려 (정합성)
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: '프로필 생성에 실패했습니다.' }
  }

  return { success: true }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
