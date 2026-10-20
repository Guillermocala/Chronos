import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown con estilos de la app (sin plugin de tipografía). Solo texto de confianza propia. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_em]:text-muted-foreground [&_hr]:border-border [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h3 className="text-base font-semibold" {...props} />,
          h2: (props) => <h4 className="pt-2 text-sm font-semibold" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs [&_td]:border-t [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium" {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
