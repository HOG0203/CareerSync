import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Supabase DB 자동 휴면(7일 연속 미사용 일시중지)을 방지하기 위한 0.001초 초경량 1행 쿼리
    await supabase.from('system_settings').select('key').limit(1);

    return NextResponse.json(
      { 
        status: 'ok', 
        message: 'Server & Supabase DB warm up ping successful',
        timestamp: new Date().toISOString() 
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    );
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'Ping failed' }, { status: 500 });
  }
}
