/** BDT minor units → "৳1,250" (decimals only when the amount has paisa). */
export const formatAmount = (minor: number) =>
  `৳${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: minor % 100 ? 2 : 0 })}`;
