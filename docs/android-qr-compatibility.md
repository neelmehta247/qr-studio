# Android QR contact compatibility

Investigated on 2026-09-13 after the user reported Pixel QR scanning imported one address before custom labels and no addresses after enabling labels; iPhone scanning worked.

## Confirmed implementation differences

The full export uses `item1.ADR` with a paired `item1.X-ABLabel`. The group associates a custom label with one specific postal address. Apple's native Contacts VCF parser preserves two Work addresses, distinct labels, and comma-containing street values in the synthetic fixture.

[ZXing's VCardResultParser](https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/client/result/VCardResultParser.java) looks for the requested property immediately after a line boundary. For addresses it requests `ADR`; `item1.ADR` therefore fails its match. The regression tests reproduce that matching boundary: grouped labeled addresses produce zero matches, and standard ungrouped addresses produce two.

Separately, [ZXing's Android AddressBookResultHandler](https://github.com/zxing/zxing/blob/master/android/src/com/google/zxing/client/android/result/AddressBookResultHandler.java) selects the first parsed address and passes only that one to its add-contact action. This is a scanner-to-Contacts transfer limitation, not address-label deduplication in the export.

[Google ML Kit ContactInfo](https://developers.google.com/android/reference/com/google/mlkit/vision/barcode/common/Barcode.ContactInfo) exposes a list of addresses. [Barcode.Address](https://developers.google.com/android/reference/com/google/mlkit/vision/barcode/common/Barcode.Address) exposes address lines and an address type, without an arbitrary custom-label accessor. Android can store multiple addresses; scanner parsing and the subsequent save action are separate steps.

The proprietary Pixel/Lens implementation was not inspected or executed. Its reported behavior is consistent with the above limitations, but this is not proof that it uses this exact ZXing source. ZXing's unescape code also handles comma escapes; it does not reproduce the Pixel report of visible backslashes, which remains unverified.

## Application behavior

- QR codes default to standard labels: repeated ungrouped `ADR;TYPE=WORK` entries remain available to basic parsers. No address is dropped, combined, or duplicated.
- The QR panel offers custom labels for iPhone-compatible readers. It retains the original grouped format.
- VCF downloads always retain custom labels and all addresses, independently of QR mode.
- QR text display/copy and byte-size feedback reflect the actual chosen QR payload.
- Commas stay properly escaped; deleting escape characters would damage the canonical vCard to accommodate a scanner defect.

This update addresses the grouped-property regression. It does not claim to overcome a scanner that forwards only one address to Contacts. Full VCF import, or a future QR linking to a VCF download page, bypasses that simplified QR contact-save action.

## Validation

17 Node tests cover serialization and scan decoding, plus grouped-property recognition regressions. The recognition test reproduces the upstream property-name matcher, not a complete Android parser. Apple's native Contacts parser validated the custom-label VCF fixture. Pixel on-device scanning and save behavior still require device verification.
