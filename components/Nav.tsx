"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { LinkButton } from "./Buttons";
import { useForgeWallet } from "@/lib/useForgeWallet";

const NAV_LINKS = [
  { label: "Launch", href: "/launch" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
];

function scrollToHash(e: React.MouseEvent<HTMLAnchorElement>, href: string, onHome: boolean) {
  if (!onHome || !href.includes("#")) return;
  const target = document.getElementById(href.split("#")[1]);
  if (!target) return;
  e.preventDefault();
  const top = target.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top, behavior: "smooth" });
}

export function Nav() {
  const pathname = usePathname();
  const wallet = useForgeWallet();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Logo />
        <button
          type="button"
          className="burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
        </button>
        <nav id="nav-links" className={`nav-links${open ? " is-open" : ""}`} aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              onClick={(e) => {
                setOpen(false);
                scrollToHash(e, l.href, pathname === "/");
              }}
            >
              {l.label}
            </Link>
          ))}
          {wallet.connected ? (
            <button type="button" className="pill" onClick={wallet.logout}>
              {wallet.publicKey?.toBase58().slice(0, 4)}...{wallet.publicKey?.toBase58().slice(-4)}
            </button>
          ) : (
            <button type="button" className="pill" onClick={wallet.login}>
              Log in
            </button>
          )}
          <LinkButton href="/launch" variant="primary" small>
            Launch a token
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
