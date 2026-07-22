// Lesson-body typography, per DESIGN.md: 16/24 body, mono for
// commands/paths, proper heading scale, accent links.

import type { ComponentProps } from "react";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

export const lessonComponents: NonNullable<MDXRemoteProps["components"]> = {
  h2: (props: ComponentProps<"h2">) => (
    <h2
      className="mt-8 text-[20px] font-semibold leading-[28px] text-text first:mt-0"
      {...props}
    />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3 className="mt-6 text-base font-semibold text-text" {...props} />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="mt-4 text-base leading-[24px] text-text first:mt-0" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-[24px] text-text" {...props} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-[24px] text-text" {...props} />
  ),
  li: (props: ComponentProps<"li">) => <li className="marker:text-text-dim" {...props} />,
  strong: (props: ComponentProps<"strong">) => (
    <strong className="font-semibold text-text" {...props} />
  ),
  a: (props: ComponentProps<"a">) => (
    <a
      className="text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      {...props}
    />
  ),
  code: (props: ComponentProps<"code">) => (
    <code className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-text" {...props} />
  ),
  pre: (props: ComponentProps<"pre">) => (
    <pre
      className="mt-4 overflow-x-auto rounded-md border border-hairline bg-surface-2 p-4 font-mono text-[13px] leading-[20px] text-text [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  table: (props: ComponentProps<"table">) => (
    <div className="mt-4 overflow-x-auto rounded-md border border-hairline">
      <table className="w-full border-collapse text-[13px] leading-[20px]" {...props} />
    </div>
  ),
  thead: (props: ComponentProps<"thead">) => (
    <thead className="bg-surface-2 text-text-dim" {...props} />
  ),
  tr: (props: ComponentProps<"tr">) => <tr className="border-b border-hairline last:border-0" {...props} />,
  th: (props: ComponentProps<"th">) => (
    <th className="px-3 py-2 text-left font-medium" {...props} />
  ),
  td: (props: ComponentProps<"td">) => <td className="px-3 py-2 text-text" {...props} />,
};
