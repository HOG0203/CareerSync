import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

// const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: {
    template: '%s | CareerSync',
    default: 'CareerSync - 취업 및 현장실습 통합 관리'
  },
  description: '졸업생 취업 이력, 현장실습 데이터, 자격증 취득 현황을 체계적으로 관리하는 학교 행정 전문 솔루션입니다.',
  keywords: ['취업관리', '현장실습', '학생관리', '커리어싱크', '직업계고'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CareerSync',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={cn('antialiased')}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
