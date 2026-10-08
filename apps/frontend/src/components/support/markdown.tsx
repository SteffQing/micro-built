"use client";

import Link from "next/link";
import Markdown from "react-markdown";

// What a reply may render: paragraphs, lists, bold and links. HTML in the text is dropped (skipHtml), anything else
// is unwrapped to its text.
const ALLOWED = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];

/** A reply's markdown. Internal links (`/…`) navigate in the app and call `onNavigate` (the modal closes). */
export function SupportMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  return (
    <div className="space-y-2 break-words [overflow-wrap:anywhere] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
      <Markdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{
          a: ({ href = "", children }) =>
            href.startsWith("/") && !href.startsWith("//") ? (
              <Link href={href} onClick={onNavigate} className="font-medium text-brand underline underline-offset-2">
                {children}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">
                {children}
              </a>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
