import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";

export default function Register() {
  const { login, toast } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ user: any; accessToken: string }>("/api/auth/register", {
        method: "POST",
        body: { email, username, password },
        noAuth: true,
      });
      login(data.accessToken, data.user);
      toast("Tài khoản đã tạo. Người dùng đầu tiên trở thành Quản trị viên.", "success");
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-black mb-1">Tạo tài khoản</h1>
        <p className="text-muted text-sm mb-6">Miễn phí, không cần thẻ. Người đăng ký đầu tiên được quyền Quản trị viên.</p>
        {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(224,85,119,0.12)", color: "var(--danger)" }}>{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Tên người dùng</label>
            <input required minLength={3} maxLength={20} className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="hydyar_fan" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Mật khẩu (≥6 ký tự)</label>
            <input type="password" required minLength={6} className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang tạo…" : "Đăng ký"}
          </button>
        </form>
        <p className="text-sm text-muted mt-4 text-center">
          Đã có tài khoản? <Link to="/login" className="text-accent-blue font-semibold hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
