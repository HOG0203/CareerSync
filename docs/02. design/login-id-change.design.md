# [Design] 로그인 아이디를 이름으로 변경

## 1. 데이터베이스 설계 (SQL)

### 1.1 `profiles` 테이블 (신규 또는 수정)
로그인 시 사용할 고유한 '이름'을 저장합니다.

```sql
-- profiles 테이블이 없을 경우 생성
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 설정
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
```

## 2. 인증 로직 설계

### 2.1 서버 액션 (`src/app/login/actions.ts`)
1. 사용자로부터 `username`과 `password`를 입력받음.
2. `public.profiles` 테이블에서 `username`에 해당하는 `id`를 조회.
3. `auth.users`에서 해당 `id`의 `email`을 가져오거나, 사전에 약속된 규칙(e.g. `username@app.local`)을 사용.
4. `supabase.auth.signInWithPassword`를 호출.

```typescript
// 예시 로직 (Pseudo-code)
export async function login(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  // 1. username으로 이메일 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('email_internal') // 내부용 이메일 필드 또는 매핑 테이블 필요
    .eq('username', username)
    .single();

  // 2. 실제 인증 진행
  await supabase.auth.signInWithPassword({
    email: profile.email_internal,
    password
  });
}
```

## 3. UI/UX 디자인

### 3.1 로그인 페이지
- **Label:** "아이디 (이름)"
- **Input Name:** `username`
- **Validation:** 2자 이상의 문자열, 공백 불가

## 4. 보안 고려사항
- `username`은 고유해야 함.
- 로그인 실패 시 "아이디 또는 비밀번호가 틀렸습니다"와 같이 통합된 에러 메시지 제공 (사용자 존재 여부 노출 방지)
