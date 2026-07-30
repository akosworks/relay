"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { useState } from "react";
import { Logo } from "./Logo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth";
import { EASE } from "@/lib/motion";

const PROVIDERS = ["Google", "Microsoft", "Apple"];

const container: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: 0.15, staggerChildren: 0.075 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.95, ease: EASE.out } },
};

const FIELD =
  "h-[52px] w-full rounded-full border border-rule bg-paper px-6 text-[15px] tracking-[-0.01em] text-ink outline-none transition-colors duration-400 placeholder:text-ink-25 hover:border-ink-25 focus:border-blue";

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <motion.div variants={item}>
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] tracking-[-0.005em] text-ink-45"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </motion.div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();

  /**
   * One mock account, checked on the server. The credentials are printed below
   * the form on purpose: this is a demo, and a locked door with no key is not a
   * demonstration of anything.
   */
  const signIn = async () => {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not sign you in.");
        return;
      }

      const next = params.get("next");
      router.push(next?.startsWith("/") ? next : "/home");
      // The cookie the proxy reads was set by that response, and the proxy runs
      // on the server, so the new route has to be fetched rather than replayed
      // from the client cache.
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6 py-20">
      <motion.div
        variants={container}
        initial="hidden"
        animate="shown"
        className="w-full max-w-[368px]"
      >
        <motion.div variants={item} className="flex justify-center">
          <Link href="/" className="text-ink" aria-label="Relay, home">
            <Logo size={30} animateOnMount />
          </Link>
        </motion.div>

        <motion.h1
          variants={item}
          className="display mt-9 text-center text-[2rem] tracking-[-0.035em]"
        >
          Welcome back.
        </motion.h1>

        {/* Shown, not wired. Single sign-on is the one part of this door that
            cannot be faked convincingly, so it says so rather than letting
            anyone straight through and making the password beside it a lie. */}
        <div className="mt-12 flex flex-col gap-2.5">
          {PROVIDERS.map((name) => (
            <motion.button
              key={name}
              variants={item}
              type="button"
              disabled
              title="Single sign-on is not part of this build"
              className="h-[52px] w-full cursor-not-allowed rounded-full border border-rule text-[15px] font-medium tracking-[-0.01em] text-ink-25"
            >
              Continue with {name}
            </motion.button>
          ))}
        </div>

        <motion.div variants={item} className="my-9 h-px w-full bg-rule" />

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            signIn();
          }}
        >
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="-mt-1 text-[13.5px] leading-[1.5] tracking-[-0.01em] text-blue"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            variants={item}
            type="submit"
            disabled={pending}
            className="mt-3 h-[52px] w-full rounded-full bg-ink text-[15px] font-medium tracking-[-0.01em] text-paper transition-colors duration-500 hover:bg-blue disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign In"}
          </motion.button>
        </form>

        {/* The key, next to the lock. */}
        <motion.div
          variants={item}
          className="mt-8 rounded-2xl border border-dashed border-rule px-5 py-4"
        >
          <p className="text-[12px] uppercase tracking-[0.09em] text-ink-25">Demo account</p>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
              setError(null);
            }}
            className="mt-2 block w-full text-left text-[13.5px] leading-[1.6] tracking-[-0.01em] text-ink-45 transition-colors duration-300 hover:text-ink"
          >
            <span className="tabular-nums text-ink-70">{DEMO_EMAIL}</span>
            {" · "}
            <span className="tabular-nums text-ink-70">{DEMO_PASSWORD}</span>
            <span className="mt-1 block text-ink-25">Tap to fill</span>
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
