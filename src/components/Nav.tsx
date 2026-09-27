import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/opportunities", label: "Live Opportunities" },
  { href: "/icp", label: "ICP Generator" },
  { href: "/scrape", label: "Find Leads" },
  { href: "/leads", label: "Lead CRM" },
];

export function Nav({ pathname }: { pathname: string }) {
  const current = pathname?.replace(/\/$/, "") || "/";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(247,249,247,0.86)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="group flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Sales OS Logo"
            width={40}
            height={40}
            className="h-10 w-10 object-contain transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3"
            priority
          />
          <div>
            <div className="display text-lg font-bold leading-none transition-colors duration-300 group-hover:text-[var(--ink)]">
              Sales OS
            </div>
            <div className="text-xs text-[var(--muted)]">
              ICP · Find leads · Outreach CRM
            </div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const href = link.href.replace(/\/$/, "") || "/";
            const active = current === href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ease-out ${
                  active
                    ? "bg-[var(--ink)] !text-white"
                    : "text-[var(--muted)] hover:bg-white hover:text-[var(--ink)] hover:scale-105"
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
