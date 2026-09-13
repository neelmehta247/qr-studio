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
  assert.ok(card.includes('ORG:Design\\; Research\\, Inc.;\r\n'));
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
