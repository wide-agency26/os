/** Scroll a section anchor into view inside an overflow container (or window). */
export function scrollToSectionAnchor(
  anchorId: string,
  scrollRoot?: HTMLElement | null
) {
  const el = document.getElementById(anchorId);
  if (!el) return;

  const offset = 80;

  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - rootRect.top + scrollRoot.scrollTop - offset;
    scrollRoot.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
