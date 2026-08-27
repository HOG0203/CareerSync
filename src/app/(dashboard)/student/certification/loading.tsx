import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="학생 인증제 종합평가표를 불러오는 중입니다..." />;
}