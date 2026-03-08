export function stoatMetaTag(slug: string): string {
  return `<script defer src="/.stoat/overlay.js?slug=${encodeURIComponent(slug)}"></script>`;
}

export function stoatVitePlugin(slug: string) {
  return {
    name: "stoat-overlay",
    transformIndexHtml(html: string): string {
      const tag = `<script defer src="/.stoat/overlay.js?slug=${encodeURIComponent(slug)}"></script>`;
      return html.replace("</head>", `${tag}</head>`);
    },
  };
}
