"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { smoothScrollTo } from "@/lib/smooth-scroll";

export function Logo({ large = false }: { large?: boolean }) {
  const pathname = usePathname();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (pathname !== "/" || !plain) return;
    e.preventDefault();
    if (!smoothScrollTo(0)) window.scrollTo({ top: 0, behavior: "auto" });
  };
  return (
    <Link href="/" className={`logo${large ? " is-lg" : ""}`} aria-label="Forge home" onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a tiny mark */}
      <img className="logo-mark" src="/logo.png" alt="" width={32} height={32} />
      FORGE
    </Link>
  );
}
