import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import QRCode from 'qr-code-styling';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {
  blankContact,
  buildVCard,
  escapeText,
  foldLine,
} from '../lib/vcard.ts';
import { qrByteString, qrMargin } from '../lib/qr.ts';
const sample = {
  ...blankContact,
  first: 'Zoë',
  last: 'Mehta',
  company: 'Design; Research, Inc.',
  note: 'First line\nSecond line',
  phones: [
    { id: 'p1', type: 'CELL', value: '+15551234567', preferred: true },
    { id: 'p2', type: 'WORK', value: '+442079460000', preferred: false },
  ],
  emails: [
    { id: 'e1', type: 'WORK', value: 'zoe@example.com', preferred: true },
  ],
  addresses: [
    {
      id: 'a1',
      type: 'WORK',
      preferred: false,
      box: '',
      extended: 'Suite 2',
      street: '10 Main Street',
      city: 'London',
      region: '',
      postal: 'SW1A 1AA',
      country: 'UK',
    },
    {
      id: 'a2',
      type: 'HOME',
      preferred: false,
      box: '',
      extended: '',
      street: '42 Park Road',
      city: 'Mumbai',
      region: 'MH',
      postal: '400001',
      country: 'India',
    },
  ],
};
test('repeat fields, escaping, boundaries and CRLF', () => {
  const card = buildVCard(sample);
  assert.equal(card.match(/^TEL;/gm).length, 2);
  assert.equal(card.match(/^ADR;/gm).length, 2);
  assert.ok(card.includes('ORG:Design\\; Research\\, Inc.\r\n'));
  assert.ok(card.includes('NOTE:First line\\nSecond line\r\n'));
  assert.ok(card.includes('TYPE=CELL,PREF'));
  assert.ok(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
  assert.ok(card.endsWith('END:VCARD\r\n'));
  assert.equal(escapeText('x\nEND:VCARD'), 'x\\nEND:VCARD');
});
test('long Unicode lines fold at 75 bytes and round trip', () => {
  const line = 'NOTE:' + 'नमस्ते 🌿 '.repeat(30);
  const folded = foldLine(line);
  for (const part of folded.split('\r\n'))
    assert.ok(Buffer.byteLength(part) <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), line);
});
test('advanced properties reject card boundary injection', () => {
  assert.throws(() => buildVCard({ ...sample, extra: 'END:VCARD' }));
  assert.throws(() => buildVCard({ ...sample, extra: 'item1.BEGIN:VCARD' }));
  assert.throws(() => buildVCard({ ...sample, extra: 'broken field' }));
  assert.ok(
    buildVCard({ ...sample, extra: 'X-CUSTOM:hello' }).includes(
      'X-CUSTOM:hello',
    ),
  );
});
for (const dots of [
  'square',
  'rounded',
  'dots',
  'classy',
  'classy-rounded',
  'extra-rounded',
])
  test(`QR ${dots} decodes exact international multi-address contact`, async () => {
    const data = buildVCard({
      ...sample,
      note: 'English · हिन्दी · 日本語 · 🌿',
    });
    const qr = new QRCode({
      jsdom: JSDOM,
      type: 'svg',
      width: 1024,
      height: 1024,
      margin: qrMargin(1024),
      data: qrByteString(data),
      qrOptions: { mode: 'Byte', errorCorrectionLevel: 'M' },
      dotsOptions: { type: dots, color: '#172c50' },
      cornersSquareOptions: { type: 'extra-rounded', color: '#172c50' },
      cornersDotOptions: { type: 'square', color: '#172c50' },
      backgroundOptions: { color: '#ffffff' },
    });
    const svg = await qr.getRawData('svg');
    const { data: pixels, info } = await sharp(svg)
      .resize(512, 512)
      .blur(0.4)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(
      new Uint8ClampedArray(pixels),
      info.width,
      info.height,
    );
    assert.ok(decoded, 'QR must decode');
    assert.equal(decoded.data, data);
  });
test('gradient preset decodes at small export size', async () => {
  const data = buildVCard(sample);
  const qr = new QRCode({
    jsdom: JSDOM,
    type: 'svg',
    width: 512,
    height: 512,
    margin: qrMargin(512),
    data: qrByteString(data),
    qrOptions: { errorCorrectionLevel: 'H' },
    dotsOptions: {
      type: 'classy-rounded',
      gradient: {
        type: 'linear',
        rotation: Math.PI / 4,
        colorStops: [
          { offset: 0, color: '#14276b' },
          { offset: 1, color: '#7330a8' },
        ],
      },
    },
    cornersSquareOptions: { type: 'extra-rounded', color: '#14276b' },
    cornersDotOptions: { type: 'square', color: '#14276b' },
    backgroundOptions: { color: '#ffffff' },
  });
  const { data: pixels, info } = await sharp(await qr.getRawData('svg'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(
    jsQR(new Uint8ClampedArray(pixels), info.width, info.height)?.data,
    data,
  );
});
test('oversized card fails explicitly', () =>
  assert.throws(
    () =>
      new QRCode({
        jsdom: JSDOM,
        data: 'x'.repeat(10000),
        width: 512,
        height: 512,
      }),
  ));

// A label is not an address identity: equal types and equal custom labels
// must remain separate records, in their original order.
test('same-type addresses stay separate with distinct custom-label groups', () => {
  const addresses = sample.addresses.map((a) => ({
    ...a,
    type: 'WORK',
    label: 'Office, HQ',
  }));
  const card = buildVCard({
    ...sample,
    addresses,
    extra: 'item1.X-CUSTOM:reserved',
  }).replace(/\r\n /g, '');
  assert.ok(
    card.includes(
      'item2.ADR;TYPE=WORK:;Suite 2;10 Main Street;London;;SW1A 1AA;UK',
    ),
  );
  assert.ok(
    card.includes('item3.ADR;TYPE=WORK:;;42 Park Road;Mumbai;MH;400001;India'),
  );
  assert.ok(card.includes('item2.X-ABLabel:Office\\, HQ'));
  assert.ok(card.includes('item3.X-ABLabel:Office\\, HQ'));
  assert.equal(card.match(/(?:^|\n)(?:item\d+\.)?ADR;/g).length, 2);
});
test('same standard type emits both addresses without requiring custom labels', () => {
  const card = buildVCard({
    ...sample,
    addresses: sample.addresses.map((a) => ({ ...a, type: 'WORK' })),
  });
  assert.equal(card.match(/^ADR;TYPE=WORK:/gm).length, 2);
});
test('company has no empty department delimiter, but populated department is preserved', () => {
  assert.ok(
    buildVCard({ ...sample, company: 'Acme', department: '' }).includes(
      'ORG:Acme\r\n',
    ),
  );
  assert.ok(
    buildVCard({ ...sample, company: 'Acme', department: 'Research' }).includes(
      'ORG:Acme;Research\r\n',
    ),
  );
  assert.ok(
    buildVCard({ ...sample, company: '', department: 'Research' }).includes(
      'ORG:;Research\r\n',
    ),
  );
});

// ZXing VCardResultParser.matchVCardPrefixedField matches only a bare property
// name after a newline. This reproduces its address-name matching boundary, not
// the entire proprietary Pixel/Lens parser or Android contact-save UI.
// https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/client/result/VCardResultParser.java
const scannerAddressMatches = (text) =>
  Array.from(
    text.matchAll(/(?:^|\n)ADR(?:;([^:]*))?:([^\r\n]*)/gi),
    (match) => match[2],
  );
const customAddresses = sample.addresses.map((a, i) => ({
  ...a,
  type: 'WORK',
  label: i === 0 ? 'Head office' : 'Factory',
}));
test('standard QR labels restore addresses skipped by the grouped-property parser', () => {
  const contact = { ...sample, addresses: customAddresses };
  const fullCard = buildVCard(contact);
  const standardQR = buildVCard(contact, { addressLabels: 'standard' });
  assert.equal(
    scannerAddressMatches(fullCard).length,
    0,
    'reproduce original regression',
  );
  const matches = scannerAddressMatches(standardQR);
  assert.equal(matches.length, 2);
  assert.ok(matches[0].includes('10 Main Street'));
  assert.ok(matches[1].includes('42 Park Road'));
  assert.equal(standardQR.includes('X-ABLabel'), false);
  assert.equal(
    buildVCard(contact),
    fullCard,
    'QR compatibility must not mutate VCF data',
  );
  assert.ok(fullCard.includes('item1.X-ABLabel:Head office'));
  assert.ok(fullCard.includes('item2.X-ABLabel:Factory'));
});
test('explicit custom QR format retains the full iPhone-compatible vCard', () => {
  const contact = { ...sample, addresses: customAddresses };
  assert.equal(
    buildVCard(contact, { addressLabels: 'custom' }),
    buildVCard(contact),
  );
});
test('standard QR export retains escaped punctuation and repeated address types', () => {
  const contact = {
    ...sample,
    addresses: customAddresses.map((a) => ({
      ...a,
      street: a.street + ', Block A',
    })),
  };
  const text = buildVCard(contact, { addressLabels: 'standard' });
  assert.equal(scannerAddressMatches(text).length, 2);
  assert.ok(text.includes('Main Street\\, Block A'));
  assert.ok(text.includes('Park Road\\, Block A'));
});
