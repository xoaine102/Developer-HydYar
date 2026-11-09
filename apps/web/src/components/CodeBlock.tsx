import { useState } from "react";
import { useApp } from "../store/AppContext";

/** Code block with copy button. Used in markdown renderer and reference table. */
export default function CodeBlock({ code, language, compact = false }: { code: string; language?: string; compact?: boolean }) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast("Đã sao chép vào bộ nhớ đệm", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Không thể sao chép (trình duyệt chặn)", "error");
    }
  };

  return (
    <div className="relative group" style={{ background: "var(--code-bg)", borderRadius: 10 }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ color: "#a7a2d0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="font-mono uppercase tracking-wide">{language ?? "code"}</span>
        <button
          onClick={copy}
          className="px-2 py-0.5 rounded text-xs hover:bg-white/10 transition"
          style={{ color: "#eceaff" }}
          aria-label="Sao chép code"
        >
          {copied ? "✓ Đã copy" : "Sao chép"}
        </button>
      </div>
      <pre className={`font-mono overflow-x-auto text-[#eceaff] ${compact ? "p-2 text-xs" : "p-3 text-sm"}`} style={{ margin: 0, background: "transparent" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
