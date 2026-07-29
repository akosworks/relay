/**
 * The room the workspace sits in.
 *
 * Deliberately not the marketing backdrop: that one is a ruled grid with the
 * mark hung off the edge, which suits a page you read top to bottom. Here the
 * page is somewhere you stay, so the background is light rather than structure —
 * three enormous, almost invisible fields drifting past each other on cycles
 * that never fall into step, two motes crossing the screen over a minute and a
 * half, and a matte grain so the white has a surface.
 *
 * No JavaScript. All of it is CSS on elements that paint once, which means it
 * costs nothing while a conversation is streaming or a list is being dragged,
 * and it honours the reduced-motion rule in `globals.css` without a hook.
 */
export function AppBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="backdrop-field backdrop-field-a" />
      <div className="backdrop-field backdrop-field-b" />
      <div className="backdrop-field backdrop-field-c" />
      <div className="backdrop-mote backdrop-mote-a" />
      <div className="backdrop-mote backdrop-mote-b" />
      <div className="backdrop-grain" />
    </div>
  );
}
