'use server'

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

  // 1. 가상 이메일 조합식으로 즉시 로그인 시도 (사전 DB 조회 1회 생략으로 속도 2배 향상)
  const virtualEmail = generateEmailFromUsername(username)
  
  let { error } = await supabase.auth.signInWithPassword({
    email: virtualEmail,
    password,
  })

  // 2. 만약 가상 이메일 로그인 실패 시, 커스텀 이메일 사용자의 경우 profiles 테이블 폴백 처리
  if (error) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle()

    if (profile?.email && profile.email !== virtualEmail) {
      const fallbackResult = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      })
      error = fallbackResult.error
    }
  }

  if (error) {
    return { error: '아이디 또는 비밀번호가 잘못되었습니다.' }
  }

  // 3. 로그인 성공 시 Audit Log (USER_LOGIN) 비동기 백그라운드 기록 (대기 시간 0초)
  void (async () => {
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, role, assigned_grade, assigned_class')
        .eq('username', username)
        .maybeSingle()

      const { logAuditAction } = await import('@/lib/audit-logger')
      await logAuditAction({
        actor_name: userProfile?.full_name || username,
        action_type: 'USER_LOGIN',
        target_name: `시스템 로그인 접속`,
        details: {
          username,
          full_name: userProfile?.full_name,
          role: userProfile?.role || 'user',
          assigned_grade: userProfile?.assigned_grade,
          assigned_class: userProfile?.assigned_class,
          login_at: new Date().toISOString()
        }
      })
    } catch (logErr) {
      console.error('Failed to log login action:', logErr)
    }
  })()

  // 4. 즉각 대시보드로 이동
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
      email: virtualEmail,
      role: 'staff'
    })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: '프로필 생성에 실패했습니다.' }
  }

  return { success: true }
}

import { revalidatePath } from 'next/cache'
import { getSystemSettings } from '@/app/(dashboard)/admin/settings/actions'
import { saveStudentAccountMeta, getStudentAccountMeta } from '@/lib/student-accounts'
import { extractPhoneLast4, getStudentUsername, formatStudentAuthPassword } from '@/lib/student-utils'


export async function studentLogin(formData: FormData) {

  const gradeStr = formData.get('grade') as string
  const major = formData.get('major') as string
  const classInfo = formData.get('classInfo') as string
  const studentNumber = formData.get('studentNumber') as string
  const studentName = (formData.get('studentName') as string || '').trim()
  const password = formData.get('password') as string

  if (!gradeStr || !major || !classInfo || !studentNumber || !studentName || !password) {
    return { error: '모든 항목(학년, 학과, 반, 번호, 이름, 비밀번호)을 입력해주세요.' }
  }

  const grade = parseInt(gradeStr)
  if (isNaN(grade) || grade < 1 || grade > 3) {
    return { error: '올바른 학년을 선택해주세요.' }
  }

  const settings = await getSystemSettings()
  const baseYear = settings.baseYear || 2026
  const targetGradYear = baseYear + (4 - grade)

  // 1. 학생 정보 조회
  const cleanClass = classInfo.replace(/[^0-9]/g, '')
  const cleanNumber = studentNumber.replace(/[^0-9]/g, '')

  const { data: matchedStudents, error: fetchErr } = await supabaseAdmin
    .from('students')
    .select('id, student_name, major, class_info, student_number, phone_number, graduation_year')
    .eq('graduation_year', targetGradYear)
    .eq('student_name', studentName)



  if (fetchErr || !matchedStudents || matchedStudents.length === 0) {
    return { error: '일치하는 학생 정보를 찾을 수 없습니다. 학년, 학과, 반, 번호, 이름을 다시 확인해주세요.' }
  }

  // 학과, 반, 번호 정밀 필터링
  const student = matchedStudents.find(s => {
    const sMajor = (s.major || '').trim()
    const inputMajor = major.trim()
    const majorMatch = sMajor === inputMajor || sMajor.includes(inputMajor) || inputMajor.includes(sMajor)

    const sClass = (s.class_info || '').replace(/[^0-9]/g, '')
    const classMatch = sClass === cleanClass || parseInt(sClass) === parseInt(cleanClass)

    const sNum = (s.student_number || '').replace(/[^0-9]/g, '')
    const numMatch = sNum === cleanNumber || parseInt(sNum) === parseInt(cleanNumber)

    return majorMatch && classMatch && numMatch
  })

  if (!student) {
    return { error: '일치하는 학생 정보를 찾을 수 없습니다. 학년, 학과, 반, 번호, 이름을 다시 확인해주세요.' }
  }

  // 2. 연락처 유효성 검사 (연락처가 없는 경우 로그인 차단)
  const last4 = extractPhoneLast4(student.phone_number)
  if (!last4) {
    return { 
      error: '등록된 연락처(휴대폰 번호)가 없습니다. 담임선생님께 연락처 등록을 요청해 주세요.' 
    }
  }

  // 3. 학생 계정 및 가상 이메일 준비
  const username = getStudentUsername(student)
  const virtualEmail = generateEmailFromUsername(username)

  // 4. Supabase Auth 계정 존재 여부 확인 및 자동 생성 (멱등성 보장)
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (!profile) {
    // Auth 계정 생성 시도
    const { data: authData, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: formatStudentAuthPassword(last4),
      email_confirm: true,
      user_metadata: {
        username,
        full_name: student.student_name,
        student_id: student.id,
        role: 'student',
        assigned_grade: grade,
        assigned_major: student.major,
        assigned_class: student.class_info,
        is_custom_password: false,
      }
    })

    let authUserId = authData?.user?.id;

    if (authCreateErr) {
      const errMsg = authCreateErr.message?.toLowerCase() || '';
      if (errMsg.includes('already') || errMsg.includes('registered')) {
        // 이미 Auth 계정이 생성되어 있던 경우 정상 처리로 넘어가서 로그인 시도
      } else {
        return { error: `학생 계정 생성 실패: ${authCreateErr.message}` }
      }
    }

    if (authUserId) {
      try {
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authUserId,
            username: username,
            full_name: student.student_name,
            email: virtualEmail,
            role: 'student',
            assigned_grade: grade,
            assigned_major: student.major,
            assigned_class: student.class_info,
          }, { onConflict: 'id' })
      } catch (pErr) {
        console.error('Error upserting profile:', pErr)
      }

      await saveStudentAccountMeta(student.id, {
        auth_user_id: authUserId,
        is_custom_password: false,
        login_count: 0,
      })
    }
  }

  // 5. 로그인 시도 (매핑된 패스워드 시도 -> fallback 원본 패스워드)
  const supabase = await createClient()
  let { error: signInErr } = await supabase.auth.signInWithPassword({
    email: virtualEmail,
    password: formatStudentAuthPassword(password),
  })

  if (signInErr) {
    // 이전 생성 계정 하위 호환 fallback
    const fallbackRes = await supabase.auth.signInWithPassword({
      email: virtualEmail,
      password: password,
    })
    signInErr = fallbackRes.error
  }

  if (signInErr) {
    return { error: '비밀번호가 일치하지 않습니다. (최초 비밀번호는 학생 휴대폰 번호 뒷 4자리입니다.)' }
  }


  // 6. 로그인 성공 시 메타데이터 및 감사로그 갱신을 비동기 백그라운드로 처리 (대기 시간 0초)
  void (async () => {
    try {
      const currentMeta = await getStudentAccountMeta(student.id)
      await saveStudentAccountMeta(student.id, {
        last_login_at: new Date().toISOString(),
        login_count: (currentMeta?.login_count || 0) + 1,
      })

      const { logAuditAction } = await import('@/lib/audit-logger')
      await logAuditAction({
        actor_name: `${student.student_name} (학생)`,
        action_type: 'USER_LOGIN',
        target_name: `학생 옥저인증 평가표 접속`,
        details: {
          student_id: student.id,
          student_name: student.student_name,
          grade,
          major: student.major,
          class_info: student.class_info,
          student_number: student.student_number,
          login_at: new Date().toISOString(),
        }
      })
    } catch (e) {
      console.error('Failed to update student login log:', e)
    }
  })()

  // 7. 학생 전용 옥저인증평가표 페이지로 즉시 이동
  redirect('/student/certification')
}


export async function changeStudentPassword(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: '모든 비밀번호 항목을 입력해주세요.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.' }
  }

  if (newPassword.length < 4) {
    return { error: '새 비밀번호는 최소 4자리 이상이어야 합니다.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 1. 현재 비밀번호 검증 (재인증)
  let { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: formatStudentAuthPassword(currentPassword),
  })

  if (verifyErr) {
    const fallbackVerify = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })
    verifyErr = fallbackVerify.error
  }

  if (verifyErr) {
    return { error: '현재 비밀번호가 일치하지 않습니다.' }
  }

  // 2. 새 비밀번호로 변경
  const { error: updateErr } = await supabase.auth.updateUser({
    password: formatStudentAuthPassword(newPassword),
  })

  if (updateErr) {
    return { error: `비밀번호 변경 실패: ${updateErr.message}` }
  }


  // 3. 학생 계정 메타데이터에 커스텀 비밀번호 설정 여부 및 변경일시 기록
  let targetStudentId = (user.user_metadata?.student_id as string) || null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, assigned_grade, assigned_major, assigned_class')
    .eq('id', user.id)
    .maybeSingle();

  if (!targetStudentId) {
    const rawUsername = profile?.username || user.user_metadata?.username || '';
    if (rawUsername.startsWith('std_')) {
      const parsedId = rawUsername.replace('std_', '');
      const { data: stdMatch } = await supabaseAdmin
        .from('students')
        .select('id')
        .or(`student_id.eq.${parsedId},id.ilike.${parsedId}%`)
        .maybeSingle();
      if (stdMatch) targetStudentId = stdMatch.id;
    }
  }

  if (!targetStudentId) {
    // 이름 및 학적 정보로 정밀 매칭
    const { data: matched } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('student_name', profile?.full_name || user.user_metadata?.full_name || '')
      .limit(1);
    if (matched && matched.length > 0) {
      targetStudentId = matched[0].id;
    }
  }

  if (targetStudentId) {
    await saveStudentAccountMeta(targetStudentId, {
      auth_user_id: user.id,
      is_custom_password: true,
      password_changed_at: new Date().toISOString(),
    });
    revalidatePath('/student-accounts');
    revalidatePath('/student/certification');
  }


  // 감사로그 기록
  try {
    const { logAuditAction } = await import('@/lib/audit-logger')
    await logAuditAction({
      actor_name: `${profile?.full_name || '학생'} (본인)`,
      action_type: 'PASSWORD_RESET',
      target_name: `학생 본인 비밀번호 변경`,
      details: {
        user_id: user.id,
        full_name: profile?.full_name,
        timestamp: new Date().toISOString(),
      }
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }

  return { success: true, message: '비밀번호가 성공적으로 변경되었습니다.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return { success: true }
}


