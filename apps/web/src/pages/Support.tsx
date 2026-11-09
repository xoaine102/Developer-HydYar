import { useState } from "react";

const FAQS = [
  { q: "Chạy code ở đâu? An toàn không?", a: "JavaScript/TypeScript chạy trong Web Worker cách ly, Python qua Pyodide (WebAssembly), Lua qua Fengari, SQL qua sql.js — tất cả trong trình duyệt của bạn, không gửi code lên máy chủ khi không cần thiết. Một số ngôn ngữ (C, C++, PHP, Java…) dùng máy chủ thực thi với giới hạn CPU/bộ nhớ và không có mạng." },
  { q: "Tại sao không có Terminal shell thật?", a: "Trên Render Free (miễn phí) không thể cấp shell tương tác an toàn. Terminal của HydYar hiển thị output của lệnh đã chạy và cho phép nhập stdin cho chương trình tương tác — chúng tôi ghi rõ nhãn 'Terminal (output + stdin)' để không gây hiểu lầm." },
  { q: "Tài liệu nổi (DocOverlay) là gì?", a: "Từ trang bài học, nhấn 'Mở nổi' để cửa sổ tài liệu nổi lên trên IDE — bạn kéo, thay đổi kích thước, ghim vào mép màn hình. IDE không bị tải lại khi mở/đóng overlay." },
  { q: "Làm sao trở thành Quản trị viên?", a: "Người dùng đăng ký đầu tiên (hoặc email trùng BOOTSTRAP_ADMIN_EMAIL trên máy chủ) tự động có vai trò ADMIN và truy cập trang /admin để duyệt đóng góp tài liệu, xử lý báo cáo." },
  { q: "Dữ liệu SQL Playground lưu ở đâu?", a: "Chỉ trong bộ nhớ trình duyệt (SQLite WebAssembly). Nhấn 'Đặt lại môi trường' để khôi phục CSDL mẫu. PostgreSQL/MySQL tạm thời không khả dụng trên gói miễn phí." },
];

export default function Support() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const body = encodeURIComponent(`Tên: ${name}\nEmail: ${email}\n\n${message}`);
    const subj = encodeURIComponent(subject || "Hỗ trợ Developer HydYar");
    // Honest: no backend endpoint — open user's mail client. Never fake-send.
    window.location.href = `mailto:support@developer-hydyar.example?subject=${subj}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black mb-2">Trung tâm hỗ trợ</h1>
        <p className="text-muted">Câu hỏi thường gặp và cách liên hệ với đội ngũ HydYar.</p>
      </div>

      <div className="surface-card divide-y divide-border">
        {FAQS.map((f, i) => (
          <div key={i}>
            <button className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-surface-2 transition" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <span className="font-semibold">{f.q}</span>
              <span className="text-accent-purple font-bold">{openIdx === i ? "−" : "+"}</span>
            </button>
            {openIdx === i && <p className="px-4 pb-4 text-sm text-muted leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>

      <div className="surface-card p-6">
        <h2 className="font-bold text-lg mb-1">Liên hệ hỗ trợ</h2>
        <p className="text-sm text-muted mb-4">
          Hệ thống chưa có form gửi trực tiếp (chưa có endpoint). Nhấn gửi sẽ mở ứng dụng email của bạn với nội dung đã soạn sẵn — chúng tôi sẽ phản hồi qua email.
        </p>
        {sent && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(59,178,115,0.12)", color: "var(--success)" }}>
            Đã mở ứng dụng email của bạn. Nếu không tự mở, hãy gửi tới <b>support@developer-hydyar.example</b>.
          </div>
        )}
        <form onSubmit={sendEmail} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Tên của bạn" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="input-field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <input className="input-field" placeholder="Chủ đề" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input-field min-h-[120px]" placeholder="Mô tả vấn đề của bạn…" value={message} onChange={(e) => setMessage(e.target.value)} required />
          <button type="submit" className="btn-primary">✉ Gửi email hỗ trợ</button>
        </form>
      </div>
    </div>
  );
}
