/** Emoji in titles come through garbled in prefilled WhatsApp/SMS/email text, so drop them from share text only. */
export function stripEmoji(title: string) {
  return title
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
