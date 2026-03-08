export const NARROW_VIEWPORT_QUERY = "(max-width: 960px)";

function asElement(node: EventTarget | Node | null) {
  return node instanceof Element ? node : null;
}

export function isNarrowViewport(win: Window = window) {
  return typeof win.matchMedia === "function" && win.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}

export function isCopilotInteractionTarget(node: EventTarget | Node | null) {
  const element = asElement(node);
  return Boolean(element?.closest(".copilot-panel") || element?.closest(".copilot-trigger"));
}

export function shouldCollapseCopilotOnInteraction({
  open,
  narrowViewport,
  event,
}: {
  open: boolean;
  narrowViewport: boolean;
  event: Event;
}) {
  if (!open || !narrowViewport) return false;
  return !isCopilotInteractionTarget(event.target);
}
