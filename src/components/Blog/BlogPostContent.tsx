'use client';

import DOMPurify from 'isomorphic-dompurify';

// Posts written with the rich text editor are stored as HTML; older posts are plain text.
const isHtmlContent = (content: string | undefined) => !!content && /<\/?[a-z][\s\S]*>/i.test(content);

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

/** The body of a blog post — sanitised rich-text HTML, or linkified plain text for older posts. */
export function BlogPostContent({ content }: { content: string }) {
  if (isHtmlContent(content)) {
    return (
      <div
        className="text-lg leading-loose text-foreground [&_p]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2 [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(content, { ADD_ATTR: ['target', 'rel', 'style'] }),
        }}
      />
    );
  }

  return (
    <div className="text-lg leading-loose text-foreground">
      <p className="whitespace-pre-wrap">{renderContentWithLinks(content)}</p>
    </div>
  );
}
