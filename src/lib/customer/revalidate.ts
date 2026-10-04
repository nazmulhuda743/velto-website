import "server-only";
import { revalidatePath } from "next/cache";

/** A customer change shows on both surfaces: the website's account and the installed app (/app/*). */
export function revalidateCustomer() {
  revalidatePath("/account", "layout");
  revalidatePath("/app", "layout");
}
