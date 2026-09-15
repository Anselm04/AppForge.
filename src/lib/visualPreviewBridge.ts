const VISUAL_BRIDGE = String.raw`<script data-appforge-visual-bridge>
(() => {
  if (window.parent === window) return;
  const outline = '2px solid #2563eb';
  let selected = null;
  function clear() {
    if (!selected) return;
    selected.style.outline = selected.dataset.appforgeOldOutline || '';
    selected.style.outlineOffset = selected.dataset.appforgeOldOutlineOffset || '';
    delete selected.dataset.appforgeOldOutline;
    delete selected.dataset.appforgeOldOutlineOffset;
    selected = null;
  }
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('[data-appforge-visual-bridge]')) return;
    event.preventDefault();
    event.stopPropagation();
    clear();
    selected = target;
    selected.dataset.appforgeOldOutline = selected.style.outline || '';
    selected.dataset.appforgeOldOutlineOffset = selected.style.outlineOffset || '';
    selected.style.outline = outline;
    selected.style.outlineOffset = '2px';
    const computed = window.getComputedStyle(selected);
    window.parent.postMessage({
      type: 'appforge:visual-select',
      id: selected.id || null,
      tag: selected.tagName.toLowerCase(),
      text: selected.children.length === 0 ? (selected.textContent || '').trim().slice(0, 2000) : null,
      hasNestedMarkup: selected.children.length > 0,
      styles: {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        textAlign: computed.textAlign,
        padding: computed.padding,
        margin: computed.margin,
        borderRadius: computed.borderRadius,
        width: computed.width,
        height: computed.height
      }
    }, '*');
  }, true);
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    if (!event.data || event.data.type !== 'appforge:visual-clear') return;
    clear();
  });
  window.parent.postMessage({ type: 'appforge:visual-ready' }, '*');
})();
</script>`;

export function injectVisualPreviewBridge(html: string): string {
  if (html.includes("data-appforge-visual-bridge")) return html;
  const closingBody = html.search(/<\/body\s*>/i);
  if (closingBody >= 0) {
    return `${html.slice(0, closingBody)}${VISUAL_BRIDGE}${html.slice(closingBody)}`;
  }
  return `${html}${VISUAL_BRIDGE}`;
}
