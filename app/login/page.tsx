import type { Metadata } from "next";
import { Suspense } from "react";
import { Login } from "@/components/Login";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  // The form reads `?next=` to finish an interrupted journey, and reading search
  // params opts a route into dynamic rendering unless it sits behind a boundary.
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
