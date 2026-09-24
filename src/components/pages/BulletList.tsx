/** Thin-rule list used for "what we handle" / "what to tell us" style content. */
export function BulletList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 border-t border-line py-3.5 text-body last:border-b">
          <span aria-hidden="true" className="mt-[12px] h-px w-3 shrink-0 bg-blue" />
          {item}
        </li>
      ))}
    </ul>
  );
}
