import { redirect } from 'next/navigation';

export default function CertificationRedirect() {
  redirect('/admin/certification/grades');
}
