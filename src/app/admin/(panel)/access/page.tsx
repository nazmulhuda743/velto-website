import { AdminHeader, Badge, DataNotice, Notice, one, type SearchParams } from "@/components/admin/ui";
import { getPeople, type Person } from "@/lib/admin/activity";
import { requestDate } from "@/lib/admin/request-details";
import { can, ROLE_INFO, ROLES, SECTIONS, type Section } from "@/lib/admin/permissions";
import { requireSection } from "@/lib/admin/session";
import { addMemberAction, updateMemberAction } from "../../access-actions";

const SAVED: Record<string, string> = {
  created: "Login created and role given. Share the email and temporary password with them privately; they can change it with “Forgot password”.",
  added: "Role given. They can sign in at /admin/login with their existing password.",
  role: "Role changed. It applies from their next click.",
  deactivate: "Access removed. They're signed out from their next click.",
  reactivate: "Access restored.",
  password: "New temporary password set. Share it with them privately.",
};

const SECTION_LABEL: Record<Section, string> = {
  overview: "Overview",
  funnel: "Funnel",
  visitors: "Visitors",
  marketing: "Marketing",
  revenue: "Revenue",
  consent: "Consent",
  requests: "Bookings & quotes",
  retention: "Bring customers back",
  accounts: "Customer accounts",
  health: "Website health",
  seo: "SEO",
  images: "Images",
  copy: "Text & copy",
  reviews: "Reviews",
  settings: "Site settings",
  prices: "Prices",
  notifications: "Notifications",
  activity: "Activity",
  approvals: "Approvals",
  access: "Access",
};

function PersonRow({ p, self }: { p: Person; self: boolean }) {
  const opsAdmin = p.origin === "ops_admin";
  return (
    <li className="admin-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            {p.name} {self ? <span className="font-normal text-secondary">(you)</span> : null}
          </p>
          <p className="t-small text-secondary [overflow-wrap:anywhere]">{p.email}</p>
          <p className="mt-1 t-caption text-secondary">
            {opsAdmin
              ? "Owner because they are a Velto Ops admin (managed in Ops)"
              : `${p.origin === "website" ? "Login created here" : "Existing login"}${p.createdBy ? ` · added by ${p.createdBy}` : ""}${p.createdAt ? ` on ${requestDate(p.createdAt)}` : ""}`}
            {" · "}
            {p.lastSeen ? `last active ${requestDate(p.lastSeen)}` : "no activity yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={p.role === "owner" ? "blue" : "neutral"}>{ROLE_INFO[p.role].label}</Badge>
          {p.active ? <Badge tone="green">Active</Badge> : <Badge tone="amber">No access</Badge>}
        </div>
      </div>

      {!opsAdmin && !self ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <form action={updateMemberAction} className="flex items-end gap-2">
            <input type="hidden" name="userId" value={p.userId} />
            <input type="hidden" name="op" value="role" />
            <label className="block t-small font-semibold text-navy">
              Role
              <select name="role" defaultValue={p.role} className="admin-input mt-1 w-44">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_INFO[r].label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="admin-btn-secondary">
              Change role
            </button>
          </form>
          <form action={updateMemberAction}>
            <input type="hidden" name="userId" value={p.userId} />
            <input type="hidden" name="op" value={p.active ? "deactivate" : "reactivate"} />
            <button type="submit" className={p.active ? "admin-btn-danger" : "admin-btn-secondary"}>
              {p.active ? "Remove access" : "Restore access"}
            </button>
          </form>
          {p.origin === "website" ? (
            <details className="w-full sm:w-auto">
              <summary className="cursor-pointer t-small font-semibold text-blue">Set a new password</summary>
              <form action={updateMemberAction} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="userId" value={p.userId} />
                <input type="hidden" name="op" value="password" />
                <label className="block t-small font-semibold text-navy">
                  Temporary password
                  <input type="text" name="password" minLength={12} maxLength={72} autoComplete="off" required className="admin-input mt-1 w-60" />
                </label>
                <button type="submit" className="admin-btn-secondary">
                  Set password
                </button>
              </form>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default async function AccessPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireSection("access");
  const params = await searchParams;
  const people = await getPeople();
  const saved = one(params.saved);

  return (
    <>
      <AdminHeader
        title="Access"
        intro="Who can use this dashboard, and what each person can open. Every page and every save checks the role on the server. People added here get no access to Velto Ops data."
      />
      <Notice error={one(params.error)} />
      {saved && SAVED[saved] && !one(params.error) ? (
        <p role="status" className="mt-6 rounded-md border border-success/30 bg-success-soft px-4 py-3 t-small font-medium text-success">
          {SAVED[saved]}
        </p>
      ) : null}

      <section aria-labelledby="add-title" className="admin-card mt-6 p-5 md:p-6">
        <h2 id="add-title" className="text-[17px] font-semibold text-navy">
          Add a person
        </h2>
        <p className="mt-1 t-small text-secondary">
          If the email already has a login (for example Velto Ops staff), they keep their password. Otherwise a new login is created with the temporary password you set.
        </p>
        <form action={addMemberAction} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <label className="block t-small font-semibold text-navy">
            Name
            <input name="name" required maxLength={80} className="admin-input mt-1" />
          </label>
          <label className="block t-small font-semibold text-navy">
            Email
            <input name="email" type="email" required maxLength={254} autoComplete="off" className="admin-input mt-1" />
          </label>
          <label className="block t-small font-semibold text-navy">
            Role
            <select name="role" defaultValue="designer" className="admin-input mt-1">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_INFO[r].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block t-small font-semibold text-navy">
            Temporary password <span className="font-normal text-secondary">(new logins only)</span>
            <input name="password" type="text" minLength={12} maxLength={72} autoComplete="off" className="admin-input mt-1" />
          </label>
          <div className="md:col-span-2 xl:col-span-4">
            <button type="submit" className="admin-btn">
              Give access
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="people-title" className="mt-8">
        <h2 id="people-title" className="text-[20px] font-semibold text-navy">
          People with access
        </h2>
        {people.state === "error" ? <DataNotice state="error" message={people.message} /> : null}
        {people.state === "not_configured" ? <DataNotice state="not_configured" /> : null}
        {people.state === "ok" ? (
          <ul className="mt-3 space-y-3">
            {people.data.map((p) => (
              <PersonRow key={p.userId} p={p} self={p.userId === admin.id} />
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="roles-title" className="admin-card mt-8 overflow-x-auto p-5 md:p-6">
        <h2 id="roles-title" className="text-[17px] font-semibold text-navy">
          What each role can open
        </h2>
        <table className="mt-4 w-full min-w-[640px] t-small">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-3 font-semibold text-secondary">
                Page
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-2 py-2 text-center font-semibold text-navy">
                  {ROLE_INFO[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((s) => (
              <tr key={s} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium text-navy">
                  {SECTION_LABEL[s]}
                </th>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {can(r, s) ? <span aria-label="Yes" className="font-bold text-success">✓</span> : <span aria-label="No" className="text-line-strong">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-4 space-y-1 t-small text-secondary">
          {ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold text-navy">{ROLE_INFO[r].label}:</span> {ROLE_INFO[r].summary}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
