import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-20">
      <div className="text-7xl font-black brand-text mb-4">404</div>
      <h1 className="text-2xl font-bold mb-2">Không tìm thấy trang</h1>
      <p className="text-muted mb-6">Đường dẫn này không tồn tại hoặc đã bị di chuyển.</p>
      <Link to="/" className="btn-primary">Về trang chủ</Link>
    </div>
  );
}
