"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { Button, TextLink } from "./Button";
import { Words, Rise } from "./Reveal";

export function Close() {
  return (
    <>
      <section className="mx-auto max-w-[1240px] px-6 pb-[clamp(140px,20vh,240px)] text-center sm:px-10">
        <Words
          text="One workspace that remembers everything."
          as="h2"
          className="display mx-auto max-w-[16ch] text-[clamp(2.15rem,6vw,5rem)]"
          step={0.045}
        />
        <Rise delay={0.25} className="mt-14 flex justify-center sm:mt-16">
          <Button href="/login" variant="solid">
            Get Started
          </Button>
        </Rise>
      </section>

      <footer className="mx-auto max-w-[1240px] px-6 sm:px-10">
        <div className="flex items-center justify-between border-t border-rule py-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-ink"
            aria-label="Relay, home"
          >
            <Logo size={22} />
            <span className="text-[15px] font-medium tracking-[-0.025em]">Relay</span>
          </Link>
          <TextLink href="/login">Login</TextLink>
        </div>
      </footer>
    </>
  );
}
