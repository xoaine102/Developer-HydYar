import { useApp } from "../store/AppContext";

export default function ToastHost() {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[90vw] w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item surface-card px-4 py-3 text-sm shadow-overlay pointer-events-auto flex items-start gap-2"
          style={{
            borderLeft: `4px solid ${t.type === "error" ? "var(--danger)" : t.type === "success" ? "var(--success)" : "var(--accent-purple)"}`,
          }}
        >
          <span className="font-semibold shrink-0">
            {t.type === "error" ? "Lỗi" : t.type === "success" ? "Thành công" : "Thông báo"}:
          </span>
          <span className="text-ink">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
