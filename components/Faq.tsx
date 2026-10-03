"use client";

import { useState } from "react";

type Item = { q: string; a: string };

export function Faq({ items }: { items: readonly Item[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="faq">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div className={`faq-item${isOpen ? " is-open" : ""}`} key={f.q}>
            <h3>
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                id={`faq-q-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                {f.q}
              </button>
            </h3>
            <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="faq-a">
              <div className="faq-a-inner">
                <p>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
