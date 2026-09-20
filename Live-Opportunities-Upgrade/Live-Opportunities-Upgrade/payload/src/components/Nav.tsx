import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/opportunities", label: "Live Opportunities" },
  { href: "/icp", label: "ICP Generator" },
  { href: "/scrape", label: "Find Leads" },
  { href: "/leads", label: "Lead CRM" },
];

export function Nav({ pathname }: { pathname: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(247,249,247,0.86)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent)] text-sm font-bold text-white shadow-[0_10px_30px_rgba(15,122,78,0.35)]">
            SO
          </span>
          <div>
            <div className="display text-lg font-bold leading-none">Sales OS</div>
            <div className="text-xs text-[var(--muted)]">
              ICP · Find leads · Outreach CRM
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
