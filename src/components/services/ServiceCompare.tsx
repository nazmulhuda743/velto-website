import Link from "@/components/i18n/Link";
import { ArrowRight } from "@/components/ui/icons";
import { SERVICE_SUMMARY } from "@/content/service-summaries";
import { formatAmount } from "@/lib/format-price";
import { getServicePrices } from "@/lib/service-prices";

type CompareSlug = "wash-and-iron" | "ironing" | "dry-cleaning";

/** Facts from spec §4 (turnaround) and §5 (workflows). */
const OPTIONS: { slug: CompareSlug; name: string; does: string; time: string; forWhat: string }[] = [
  {
    slug: "wash-and-iron",
    name: "Wash & Iron",
    does: SERVICE_SUMMARY["wash-and-iron"],
    time: "Usually around 72 hours",
    forWhat: "Everyday clothes and linen that need washing.",
  },
  {
    slug: "ironing",
    name: "Ironing",
    does: SERVICE_SUMMARY.ironing,
    time: "General orders usually around 48 hours",
    forWhat: "Clothes already washed that just need pressing.",
  },
  {
    slug: "dry-cleaning",
    name: "Dry Cleaning",
    does: SERVICE_SUMMARY["dry-cleaning"],
    time: "Usually around 72 hours",
    forWhat: "Suits, saris, sherwanis and garments that need a closer look.",
  },
];

/** The same shirt across the three services, from the live price list. */
async function shirtPrices(): Promise<Partial<Record<CompareSlug, string>>> {
  const prices = await getServicePrices(["Shirt"]);
  if (prices.state !== "live") return {};
  const out: Partial<Record<CompareSlug, string>> = {};
  for (const s of prices.items[0]?.services ?? []) {
    if (s.amountMinor !== null && (s.slug === "wash-and-iron" || s.slug === "ironing" || s.slug === "dry-cleaning")) {
      out[s.slug] = formatAmount(s.amountMinor);
    }
  }
  return out;
}

export async function ServiceCompare({ current }: { current: CompareSlug | null }) {
  const shirt = await shirtPrices();
  const hasShirt = OPTIONS.every((o) => shirt[o.slug]);

  const nameCell = (o: (typeof OPTIONS)[number]) =>
    o.slug === current ? (
      <span className="t-h4 text-navy">
        {o.name}
        <span className="ml-2 align-middle t-caption font-medium text-secondary">This page</span>
      </span>
    ) : (
      <Link href={`/services/${o.slug}`} className="group inline-flex items-center gap-2 t-h4 text-navy hover:text-blue">
        {o.name}
        <ArrowRight className="size-4 text-blue transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    );

  return (
    <>
      {/* Desktop / tablet: one comparison table */}
      <table className="hidden w-full table-fixed border-collapse text-left md:table">
        <caption className="sr-only">Wash &amp; Iron, Ironing and Dry Cleaning compared</caption>
        <thead>
          <tr className="border-b border-navy">
            <td className="w-[22%]" />
            {OPTIONS.map((o) => (
              <th key={o.slug} scope="col" className={`pb-4 pr-6 align-bottom ${o.slug === current ? "" : "font-normal"}`}>
                {nameCell(o)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["What happens", "does"],
              ["Usually takes", "time"],
              ["Choose it for", "forWhat"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key} className="border-b border-line">
              <th scope="row" className="py-4 pr-6 align-top t-label uppercase text-navy">
                {label}
              </th>
              {OPTIONS.map((o) => (
                <td key={o.slug} className="py-4 pr-6 align-top text-body">
                  {o[key]}
                </td>
              ))}
            </tr>
          ))}
          {hasShirt ? (
            <tr className="border-b border-line">
              <th scope="row" className="py-4 pr-6 align-top t-label uppercase text-navy">
                One shirt
              </th>
              {OPTIONS.map((o) => (
                <td key={o.slug} className="py-4 pr-6 align-top font-semibold tabular-nums text-navy">
                  {shirt[o.slug]}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* Mobile: one block per service */}
      <ul className="border-t border-navy md:hidden">
        {OPTIONS.map((o) => (
          <li key={o.slug} className="border-b border-line py-5">
            <div className="flex items-baseline justify-between gap-4">
              {nameCell(o)}
              {hasShirt ? (
                <span className="t-small text-secondary">
                  Shirt <span className="font-semibold tabular-nums text-navy">{shirt[o.slug]}</span>
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-body">{o.does}</p>
            <p className="mt-1 t-small text-secondary">
              {o.time} · {o.forWhat}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
