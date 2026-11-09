import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useApp } from "../store/AppContext";

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ user: any; accessToken: string }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        noAuth: true,
      });
      login(data.accessToken, data.user);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="surface-card p-6 sm:p-8">
        <h1 className="text-2xl font-black mb-1">Đăng nhập</h1>
        <p className="text-muted text-sm mb-6">Chào mừng trở lại HydYar.</p>
        {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(224,85,119,0.12)", color: "var(--danger)" }}>{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Mật khẩu</label>
            <input type="password" required minLength={6} className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
        <p className="text-sm text-muted mt-4 text-center">
          Chưa có tài khoản? <Link to="/register" className="text-accent-blue font-semibold hover:underline">Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}
