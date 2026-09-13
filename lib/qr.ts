// qr-code-styling 1.9.2's bundled byte encoder truncates UTF-16 code units.
// Supply a byte string so accented names, non-Latin text and emoji encode as UTF-8.
export function qrByteString(text: string): string {
  return Array.from(new TextEncoder().encode(text), (byte) =>
    String.fromCharCode(byte),
  ).join('');
}
export const qrMargin = (size: number) => Math.ceil(size * 0.14);
