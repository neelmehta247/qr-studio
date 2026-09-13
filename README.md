# Contact QR Studio

A browser-only vCard 3.0 editor with multiple phones, emails, websites and postal addresses, advanced properties, styled QR previews, logo selection, and PNG/SVG/VCF downloads.

## Development

- `npm install`
- `npm run dev`
- `npm test`
- `npm run typecheck`
- `npm run build`

Contact details and selected logos remain in memory in the current browser tab. Reloading clears them. No contact data is sent to a backend. A contact photo URL is stored in the vCard, not fetched by the editor. Center logos are resized locally before embedding into QR exports.

vCard text uses CRLF, escaped text and UTF-8-aware line folding. QR encoding explicitly converts UTF-8 to a byte string because qr-code-styling 1.9.2 uses a byte encoder that otherwise truncates non-ASCII text. Keep the international-name decode tests when updating that dependency.

Tests cover serialization, repeated fields, advanced property boundaries, Unicode, overflow and QR decoding. Pattern tests simulate a camera raster at 512px with slight antialiasing; the jsQR detector can fail on pristine separated dots. Always scan-test custom designs and printed output. Dense cards or low contrast can be harder to scan. Contact imports and advanced property support vary by contacts app.

Optional WebMCP tools use the same visible state. This environment had no supported WebMCP invocation context, so their live contract was not verified.

Custom address labels use grouped `ADR` / `X-ABLabel` properties. Repeated standard types remain separate `ADR` entries; labels never serve as deduplication keys. Basic addresses without custom labels stay ungrouped for simpler QR readers. Empty department components are omitted from `ORG`.

Address fix validation: Apple's `CNContactVCardSerialization` parsed a synthetic VCF with two WORK addresses, distinct custom labels, comma-containing streets, and a company without a trailing semicolon. All assertions passed. This does not verify Pixel's QR contact-import flow. Pixel QR scanning was reported to show only one address and literal comma escapes; use the VCF download for full-fidelity import when a scanner simplifies the card. Grouped custom labels are not understood by every QR contact parser.

QR codes now default to standard address labels for basic scanner compatibility. The QR panel can switch to the grouped custom-label format used by iPhone. Full VCF downloads always preserve custom labels. See [Android QR compatibility investigation](docs/android-qr-compatibility.md) for source-level findings and remaining device limitations.
