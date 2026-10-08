import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPath } from '@/lib/access-policy'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isPublic = ['/login', '/privacy', '/delete-account'].includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api/') || pathname.startsWith('/share') || pathname === '/favicon.ico'
  const redirectTo = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  };
  
  if (!user && !isPublic) {
    return redirectTo('/login')
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role

    if (!role || !['admin', 'teacher', 'staff', 'student'].includes(role)) return redirectTo('/login');
    if (!canAccessPath(role, pathname)) {
      return redirectTo(role === 'student' ? '/student/certification' : '/dashboard')
    }

    if (pathname === '/' || pathname.startsWith('/login')) {
      return redirectTo(role === 'student' ? '/student/certification' : '/dashboard')
    }
  }

  return response
}
