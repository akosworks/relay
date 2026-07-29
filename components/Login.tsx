"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { useState } from "react";
import { Logo } from "./Logo";
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
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <motion.div variants={item}>
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] tracking-[-0.005em] text-ink-45"
      >
        {label}
      </label>
      <input id={id} name={id} type={type} autoComplete={autoComplete} className={FIELD} />
    </motion.div>
  );
}

export function Login() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  // No auth in this build: signing in is the door to the agent, nothing more.
  const enter = () => {
    setPending(true);
    router.push("/chat");
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

        <div className="mt-12 flex flex-col gap-2.5">
          {PROVIDERS.map((name) => (
            <motion.button
              key={name}
              variants={item}
              type="button"
              onClick={enter}
              className="h-[52px] w-full rounded-full border border-rule text-[15px] font-medium tracking-[-0.01em] text-ink transition-colors duration-500 hover:border-ink"
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
            enter();
          }}
        >
          <Field id="email" label="Email" type="email" autoComplete="email" />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />

          <motion.button
            variants={item}
            type="submit"
            disabled={pending}
            className="mt-3 h-[52px] w-full rounded-full bg-ink text-[15px] font-medium tracking-[-0.01em] text-paper transition-colors duration-500 hover:bg-blue disabled:opacity-60"
          >
            Sign In
          </motion.button>
        </form>
      </motion.div>
    </main>
  );
}
