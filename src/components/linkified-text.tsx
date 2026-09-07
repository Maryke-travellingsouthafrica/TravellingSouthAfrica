"use client";

import { useLanguage } from '@/hooks/use-language';
import { useEffect, useMemo, useState } from 'react';

interface LinkifiedTextProps {
  text: string;
  as?: React.ElementType;
  className?: string;
}

export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

/**
 * Bare URLs as an admin would type them into a plain textarea: a full
 * http(s):// address, or a scheme-less one starting with "www.". Stops at
 * whitespace and at the characters that can never sit inside a URL typed in
 * prose, so surrounding markup or quotes are never swallowed.
 */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

/** Sentence punctuation that follows a URL rather than belonging to it. */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

const CLOSING_TO_OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function countOccurrences(value: string, char: string) {
  let count = 0;
  for (const c of value) if (c === char) count++;
  return count;
}

/**
 * Trims punctuation that trails a URL in prose — "see https://x.co.za." or
 * "(https://x.co.za)" — while keeping brackets that are genuinely part of the
 * address, which is why the closing ones are only dropped when unbalanced.
 */
function trimTrailingPunctuation(url: string) {
  let trimmed = url.replace(TRAILING_PUNCTUATION, '');

  while (trimmed.length > 0) {
    const lastChar = trimmed[trimmed.length - 1];
    const openingChar = CLOSING_TO_OPENING[lastChar];
    if (!openingChar) break;
    if (countOccurrences(trimmed, lastChar) <= countOccurrences(trimmed, openingChar)) break;
    trimmed = trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
  }

  return trimmed;
}

/**
 * Splits plain text into runs of text and the bare URLs found inside it.
 * Anything not matched comes back as text, so the original string is always
 * rendered in full — punctuation trimmed off a URL is handed back as text
 * rather than dropped.
 */
export function splitIntoTextAndLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Fresh regex per call: the shared literal is /g and carries lastIndex state.
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const rawUrl = trimTrailingPunctuation(match[0]);

    // A match that trims away to nothing usable is left as plain text.
    if (!rawUrl || rawUrl === 'www.') continue;

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    segments.push({
      type: 'link',
      value: rawUrl,
      // Scheme-less addresses need one for href; the pattern guarantees every
      // link here is http(s), so no javascript: URL can reach an anchor.
      href: rawUrl.toLowerCase().startsWith('www.') ? `https://${rawUrl}` : rawUrl,
    });

    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Translatable text whose bare URLs render as clickable links, for admin-entered
 * copy typed into a plain textarea — no markdown or other syntax required.
 *
 * Mirrors <Translatable>'s translation lifecycle exactly, and linkifies the
 * translated string rather than the source, so links survive a language switch.
 * The parent keeps control of typography: this renders a span by default, so it
 * can sit inside an existing <p> the way <Translatable> does.
 */
export function LinkifiedText({ text, as: Component = 'span', className }: LinkifiedTextProps) {
  const { language, translate } = useLanguage();
  const [translatedText, setTranslatedText] = useState(text);

  useEffect(() => {
    let isMounted = true;
    const doTranslate = async () => {
      const newText = language === 'en' ? text : await translate(text);
      if (isMounted) {
        setTranslatedText(newText);
      }
    };
    doTranslate();
    return () => {
      isMounted = false;
    };
  }, [language, text, translate]);

  const segments = useMemo(() => splitIntoTextAndLinks(translatedText), [translatedText]);

  return (
    <Component className={className}>
      {segments.map((segment, index) =>
        segment.type === 'link' ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-words"
          >
            {segment.value}
          </a>
        ) : (
          <span key={index}>{segment.value}</span>
        )
      )}
    </Component>
  );
}
