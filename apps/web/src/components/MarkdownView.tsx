import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

/** Shared markdown renderer with code blocks + copy buttons. */
export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="doc-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const text = String(children ?? "").replace(/\n$/, "");
            if (!inline && match) {
              return <CodeBlock code={text} language={match[1]} />;
            }
            if (!inline && text.includes("\n")) {
              return <CodeBlock code={text} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            // Open external links in new tab; internal links navigate (simple: treat as href)
            const external = href && (href.startsWith("http://") || href.startsWith("https://"));
            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
