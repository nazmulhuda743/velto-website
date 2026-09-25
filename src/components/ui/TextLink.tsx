import Link from "@/components/i18n/Link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "./icons";
import { T } from "@/components/i18n/T";

type TextLinkProps = {
  href: string;
  children: ReactNode;
  external?: boolean;
  inverse?: boolean;
  className?: string;
  event?: string;
  placement?: string;
  branch?: string;
};

/**
 * Plain text navigation (spec §16). Navy text with a Velto blue rule so the
 * link stays AA-legible on white and soft backgrounds.
 */
export function TextLink({
  href,
  children,
  external = false,
  inverse = false,
  className = "",
  event,
  placement,
  branch,
}: TextLinkProps) {
  const cls = `group inline-flex items-center gap-2 py-1.5 font-semibold ${
    inverse ? "text-white" : "text-navy"
  } ${className}`;
  const inner = (
    <>
      <span
        className={`underline decoration-1 underline-offset-[6px] transition-colors ${
          inverse
            ? "decoration-cyan group-hover:decoration-white"
            : "decoration-blue/60 group-hover:decoration-blue"
        }`}
      >
        {children}
      </span>
      {external ? (
        <ArrowUpRight className={`size-4 shrink-0 ${inverse ? "text-cyan" : "text-blue"}`} />
      ) : (
        <ArrowRight
          className={`size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none ${
            inverse ? "text-cyan" : "text-blue"
          }`}
        />
      )}
    </>
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        data-analytics={event}
        data-placement={placement}
        data-branch={branch}
      >
        {inner}
        <span className="sr-only">
          {" "}
          <T k="common.opensNewTab" />
        </span>
      </a>
    );
  }
  return (
    <Link href={href} className={cls} data-analytics={event} data-placement={placement} data-branch={branch}>
      {inner}
    </Link>
  );
}
