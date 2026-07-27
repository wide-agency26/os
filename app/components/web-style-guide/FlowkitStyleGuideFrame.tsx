import { buildFlowkitSrcDoc } from "@/lib/web-style-guide/build-srcdoc";

export function FlowkitStyleGuideFrame({
  bodyClass,
  fragment,
  stylesheetHrefs,
  inlineHeadStyles,
  className,
}: {
  bodyClass: string;
  fragment: string;
  stylesheetHrefs: string[];
  inlineHeadStyles: string;
  className?: string;
}) {
  const srcDoc = buildFlowkitSrcDoc({
    bodyClass,
    fragment,
    stylesheetHrefs,
    inlineHeadStyles,
  });

  return (
    <iframe
      title="Website style guide"
      srcDoc={srcDoc}
      className={className ?? "w-full min-h-[78vh] rounded-2xl border border-border bg-white"}
      sandbox=""
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
