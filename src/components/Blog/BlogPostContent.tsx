// Server component. The body is sanitised with sanitize-html, a pure-JS parser —
// NOT DOMPurify/jsdom: jsdom pulls in ESM-only packages through require(), which
// throws ERR_REQUIRE_ESM in the Vercel serverless runtime and 500s the page.
// sanitize-html is pinned to 2.17.0 in package.json for the same reason: later
// releases depend on an ESM-only htmlparser2.

// Posts written with the rich text editor are stored as HTML; older posts are plain text.
const isHtmlContent = (content: string | undefined) => !!content && /<\/?[a-z][\s\S]*>/i.test(content);

// Inline styles the rich text editor can produce (font size, colour) plus basic typography.
const ANY_VALUE = [/^[^;{}<>]*$/];
const ALLOWED_STYLES = {
  '*': {
    color: ANY_VALUE,
    'background-color': ANY_VALUE,
    'font-size': ANY_VALUE,
    'font-family': ANY_VALUE,
    'font-weight': ANY_VALUE,
    'font-style': ANY_VALUE,
    'text-align': ANY_VALUE,
    'text-decoration': ANY_VALUE,
  },
};

async function sanitizeContent(html: string): Promise<string> {
  // Imported lazily so that even a failure to load the sanitiser is caught by
  // the caller and falls back to plain text, instead of failing the whole page.
  const { default: sanitizeHtml } = await import('sanitize-html');
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 's', 'del']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['style'],
    },
    allowedStyles: ALLOWED_STYLES,
  });
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Last-resort rendering of an HTML body: tags stripped, paragraph breaks kept. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => HTML_ENTITIES[entity])
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim();
}

// Renders plain text as React nodes, turning Markdown-style [label](url) links
// and bare https:// URLs into clickable <a> tags. Avoids dangerouslySetInnerHTML.
function renderContentWithLinks(text: string | undefined): React.ReactNode {
  if (!text) return null;

  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    let matchEnd = match.index + match[0].length;
    let url = match[2];
    let label = match[1];

    if (!url && match[3]) {
      // Bare URL — trim trailing punctuation that's likely part of the sentence, not the link.
      const trimmed = match[3].replace(/[.,!?;:'")\]]+$/, '');
      matchEnd = match.index + trimmed.length;
      url = trimmed;
      label = trimmed;
    }

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      <a
        key={`link-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {label}
      </a>
    );

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function PlainTextContent({ text }: { text: string }) {
  return (
    <div className="text-lg leading-loose text-foreground">
      <p className="whitespace-pre-wrap">{renderContentWithLinks(text)}</p>
    </div>
  );
}

/** The body of a blog post — sanitised rich-text HTML, or linkified plain text for older posts. */
export async function BlogPostContent({ content, postId }: { content: string; postId?: string }) {
  if (!isHtmlContent(content)) {
    return <PlainTextContent text={content} />;
  }

  let safeHtml: string;
  try {
    safeHtml = await sanitizeContent(content);
  } catch (error) {
    // A body that can't be sanitised must not take the page (and its share tags) down with it.
    console.error(`Error rendering blog post body${postId ? ` (${postId})` : ''}; showing plain text:`, error);
    return <PlainTextContent text={htmlToPlainText(content)} />;
  }

  return (
    <div
      className="text-lg leading-loose text-foreground [&_p]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
