import Link from "next/link";
import { logoutAction } from "@/app/(site)/auth-actions";

export function AccountSubnav() {
  return (
    <div className="border-b border-line bg-white">
      <div className="container-page flex min-h-14 items-center gap-5 overflow-x-auto text-[14px] font-semibold text-navy md:gap-7">
        <Link href="/account" className="whitespace-nowrap py-4 hover:text-blue">Overview</Link>
        <Link href="/account/orders" className="whitespace-nowrap py-4 hover:text-blue">My orders</Link>
        <Link href="/account/profile" className="whitespace-nowrap py-4 hover:text-blue">Profile</Link>
        <form action={logoutAction} className="ml-auto">
          <button className="min-h-11 whitespace-nowrap px-1 text-secondary hover:text-navy">Sign out</button>
        </form>
      </div>
    </div>
  );
}
