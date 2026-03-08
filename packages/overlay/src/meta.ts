export function ferretMetaTag(slug: string): string {
  return `<script defer src="/.ferret/overlay.js?slug=${encodeURIComponent(slug)}"></script>`;
}

export function ferretVitePlugin(slug: string) {
  return {
    name: "ferret-overlay",
    transformIndexHtml(html: string): string {
      const tag = `<script defer src="/.ferret/overlay.js?slug=${encodeURIComponent(slug)}"></script>`;
      return html.replace("</head>", `${tag}</head>`);
    },
  };
}
