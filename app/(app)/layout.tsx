import { AppShell } from "@/components/app/AppShell";
import { AskProvider } from "@/components/app/Ask";
import { PageTransition } from "@/components/app/PageTransition";
import { WorkspaceProvider } from "@/components/app/WorkspaceProvider";

/**
 * Everything past the front door.
 *
 * The two providers sit above the shell rather than inside a page, which is what
 * makes the workspace one application instead of four: state survives
 * navigation, so the header can show a count the tasks page owns, and Ask can be
 * opened from anywhere without the screen behind it going away.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AskProvider>
        <AppShell>
          <PageTransition>{children}</PageTransition>
        </AppShell>
      </AskProvider>
    </WorkspaceProvider>
  );
}
