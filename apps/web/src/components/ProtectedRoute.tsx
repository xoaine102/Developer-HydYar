import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../store/AppContext";

export default function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        <div className="animate-pulse">Đang tải…</div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (adminOnly && user.role !== "ADMIN") {
    return (
      <div className="surface-card p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Truy cập bị từ chối</h2>
        <p className="text-muted">Bạn cần quyền quản trị viên để xem trang này.</p>
      </div>
    );
  }
  return <>{children}</>;
}
