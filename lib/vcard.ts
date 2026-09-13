export type Entry = {
  id: string;
  type: string;
  value: string;
  preferred: boolean;
};
export type Address = {
  id: string;
  type: string;
  label?: string;
  preferred: boolean;
  box: string;
  extended: string;
  street: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};
export type Contact = {
  first: string;
  last: string;
  middle: string;
  prefix: string;
  suffix: string;
  display: string;
  nickname: string;
  company: string;
  department: string;
  title: string;
  role: string;
  birthday: string;
  note: string;
  photo: string;
  phones: Entry[];
  emails: Entry[];
  urls: Entry[];
  addresses: Address[];
  extra: string;
};
export const entry = (type = 'WORK'): Entry => ({
  id: crypto.randomUUID(),
  type,
  value: '',
  preferred: false,
});
export const address = (): Address => ({
  id: crypto.randomUUID(),
  type: 'WORK',
  label: '',
  preferred: false,
  box: '',
  extended: '',
  street: '',
  city: '',
  region: '',
  postal: '',
  country: '',
});
export const blankContact: Contact = {
  first: '',
  last: '',
  middle: '',
  prefix: '',
  suffix: '',
  display: '',
  nickname: '',
  company: '',
  department: '',
  title: '',
  role: '',
  birthday: '',
  note: '',
  photo: '',
  phones: [{ id: 'phone-1', type: 'CELL', value: '', preferred: false }],
  emails: [{ id: 'email-1', type: 'WORK', value: '', preferred: false }],
  urls: [],
  addresses: [],
  extra: '',
};
export const displayName = (c: Contact) =>
  c.display.trim() ||
  [c.prefix, c.first, c.middle, c.last, c.suffix]
    .filter((s) => s.trim())
    .join(' ')
    .trim() ||
  c.company.trim();
export const escapeText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
export function foldLine(line: string) {
  let out = '',
    bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 75) {
      out += '\r\n ';
      bytes = 1;
    }
    out += ch;
    bytes += n;
  }
  return out;
}
export type VCardOptions = { addressLabels?: 'custom' | 'standard' };

export function buildVCard(c: Contact, options: VCardOptions = {}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:' +
      [c.last, c.first, c.middle, c.prefix, c.suffix].map(escapeText).join(';'),
    'FN:' + escapeText(displayName(c)),
  ];
  const add = (key: string, val: string) => {
    if (val.trim()) lines.push(key + ':' + escapeText(val.trim()));
  };
  add('NICKNAME', c.nickname);
  if (c.company.trim() || c.department.trim()) {
    const organization = [c.company.trim()];
    if (c.department.trim()) organization.push(c.department.trim());
    lines.push('ORG:' + organization.map(escapeText).join(';'));
  }
  add('TITLE', c.title);
  add('ROLE', c.role);
  add('BDAY', c.birthday);
  add('NOTE', c.note);
  for (const [kind, rows] of [
    ['TEL', c.phones],
    ['EMAIL', c.emails],
    ['URL', c.urls],
  ] as const) {
    for (const row of rows) {
      if (row.value.trim())
        lines.push(
          kind +
            ';TYPE=' +
            row.type +
            (row.preferred ? ',PREF' : '') +
            ':' +
            (kind === 'URL'
              ? row.value.trim().replace(/[\r\n]/g, '')
              : escapeText(row.value.trim())),
        );
    }
  }
  // Property groups associate a custom label with exactly one address.
  // Reserve existing user-authored groups so extra properties cannot collide.
  const groups = new Set(
    Array.from(c.extra.matchAll(/^(\w[\w-]*)\./gm), (m) => m[1].toLowerCase()),
  );
  let addressNumber = 0;
  for (const a of c.addresses) {
    const parts = [
      a.box,
      a.extended,
      a.street,
      a.city,
      a.region,
      a.postal,
      a.country,
    ];
    if (parts.some((s) => s.trim())) {
      // Basic QR contact readers (including ZXing) do not recognize grouped
      // property names. Keep QR addresses ungrouped in standard-label mode;
      // full VCF exports retain the iPhone-compatible custom label extension.
      const label = options.addressLabels === 'standard' ? '' : a.label?.trim();
      let group = '';
      if (label) {
        do {
          group = `item${++addressNumber}`;
        } while (groups.has(group));
        groups.add(group);
        group += '.';
      }
      lines.push(
        group +
          'ADR;TYPE=' +
          a.type +
          (a.preferred ? ',PREF' : '') +
          ':' +
          parts.map(escapeText).join(';'),
      );
      if (label) lines.push(group + 'X-ABLabel:' + escapeText(label));
    }
  }
  if (c.photo.trim()) {
    if (!/^https?:\/\/\S+$/i.test(c.photo.trim()))
      throw new Error('Use a complete http:// or https:// photo URL.');
    lines.push('PHOTO;VALUE=URI:' + c.photo.trim());
  }
  // Advanced properties are intentionally raw vCard 3.0 content lines, not text values.
  for (const line of c.extra
    .replace(/\r\n|\r/g, '\n')
    .split('\n')
    .filter((s) => s.trim())) {
    if (!/^(?:[a-z0-9-]+\.)?[a-z0-9-]+(?:;[^:\r\n]+)?:[^\r\n]*$/i.test(line))
      throw new Error(
        'Each extra property needs a property name, a colon, and a value.',
      );
    const key = line.split(/[;:]/)[0].split('.').pop()!.toUpperCase();
    if (['BEGIN', 'END', 'VERSION', 'FN', 'N'].includes(key))
      throw new Error(
        'Set names above; BEGIN, END, and VERSION are added automatically.',
      );
    lines.push(line);
  }
  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function contrast(a: string, b: string) {
  const l = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  return (Math.max(l(a), l(b)) + 0.05) / (Math.min(l(a), l(b)) + 0.05);
}
