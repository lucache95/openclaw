/**
 * Agent handoff animation utilities.
 *
 * Pure utility module (no Lit dependency) that animates work transfers
 * between agent session cards using the Web Animations API.
 * Targets elements via `[data-session]` attribute rendered by
 * `<agent-session-card>`.
 */

// Dedup guard: tracks in-flight handoff pairs so the same parent->child
// animation is never triggered twice within a 5 s window.
const _activeHandoffs = new Set<string>();

/**
 * Prevent duplicate animations for the same handoff pair.
 *
 * @returns `true` if this is a new handoff that should be animated,
 *          `false` if it is already in progress.
 */
export function trackHandoff(
  fromSessionKey: string,
  toSessionKey: string,
): boolean {
  const key = `${fromSessionKey}->${toSessionKey}`;
  if (_activeHandoffs.has(key)) return false;
  _activeHandoffs.add(key);
  setTimeout(() => _activeHandoffs.delete(key), 5000);
  return true;
}

/**
 * Animate a parent-to-child agent handoff.
 *
 * The parent card receives a subtle scale pulse while the child card
 * slides in from above.  Both animations use the browser-native Web
 * Animations API (zero external dependencies).
 *
 * No-ops silently when:
 * - The user prefers reduced motion (`prefers-reduced-motion: reduce`)
 * - Either session card element cannot be found in the DOM
 */
export async function animateHandoff(
  fromSessionKey: string,
  toSessionKey: string,
  container?: HTMLElement,
): Promise<void> {
  // Respect OS-level reduced-motion preference.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root: ParentNode = container ?? document;
  const fromCard = root.querySelector<HTMLElement>(
    `[data-session="${fromSessionKey}"]`,
  );
  const toCard = root.querySelector<HTMLElement>(
    `[data-session="${toSessionKey}"]`,
  );

  if (!fromCard || !toCard) return;

  // Parent card: subtle pulse to draw the eye.
  fromCard.animate(
    [
      { transform: "scale(1)", opacity: 1 },
      { transform: "scale(1.03)", opacity: 0.7 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 400, easing: "ease-in-out" },
  );

  // Child card: slide down into view.
  const childAnim = toCard.animate(
    [
      { transform: "translateY(-10px)", opacity: 0 },
      { transform: "translateY(0)", opacity: 1 },
    ],
    { duration: 500, easing: "cubic-bezier(0.4, 0.0, 0.2, 1)", fill: "both" },
  );

  await childAnim.finished;
}

/**
 * Draw a temporary dashed SVG line between two elements.
 *
 * The line animates in via `strokeDashoffset` and auto-removes itself
 * after 3 s.  Callers must provide a positioned `<svg>` overlay that
 * covers the shared coordinate space of both elements.
 */
export function drawConnectionLine(
  from: HTMLElement,
  to: HTMLElement,
  svgContainer: SVGSVGElement,
): void {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();
  const svgRect = svgContainer.getBoundingClientRect();

  // Coordinates relative to the SVG container.
  const x1 = fromRect.right - svgRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - svgRect.top;
  const x2 = toRect.left - svgRect.left;
  const y2 = toRect.top + toRect.height / 2 - svgRect.top;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} L ${x2} ${y2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--color-primary, #3b82f6)");
  path.setAttribute("stroke-width", "2");

  const length = path.getTotalLength();
  path.setAttribute("stroke-dasharray", String(length));
  path.setAttribute("stroke-dashoffset", String(length));

  svgContainer.appendChild(path);

  const anim = path.animate(
    [{ strokeDashoffset: String(length) }, { strokeDashoffset: "0" }],
    { duration: 600, easing: "ease-out", fill: "forwards" },
  );

  anim.finished.then(() => {
    setTimeout(() => path.remove(), 3000);
  });
}
