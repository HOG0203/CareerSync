import { redirect } from 'next/navigation';

export default function SummaryRedirect() {
  redirect('/admin/grades/summary/grades');
}
