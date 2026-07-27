import { buildStyleGuideDocumentSrcDoc } from "@/lib/web-style-guide/build-srcdoc";
import type { WebStyleGuideDocument } from "@/lib/web-style-guide/document";

export function StyleGuideDocumentFrame({
  doc,
  className,
}: {
  doc: WebStyleGuideDocument;
  className?: string;
}) {
  const srcDoc = buildStyleGuideDocumentSrcDoc(doc);

  return (
    <iframe
      title="Website style guide preview"
      srcDoc={srcDoc}
      className={className ?? "w-full min-h-[78vh] rounded-2xl border border-border bg-white"}
      sandbox=""
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
