import { GlobalRotatingLoader } from "@/components/dashboard/loading-skeleton";

export default function Loading() {
  return <GlobalRotatingLoader message="로그인 및 접속 활동 이력을 불러오는 중입니다..." />;
}