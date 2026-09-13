'use client';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import type QRCodeStyling from 'qr-code-styling';
import type {
  DotType,
  CornerSquareType,
  CornerDotType,
  ErrorCorrectionLevel,
  Options,
} from 'qr-code-styling';
import {
  QrCode,
  LockKeyhole,
  Download,
  Palette,
  UserRound,
  Plus,
  X,
  Phone,
  Mail,
  MapPin,
  Globe,
  ChevronDown,
  ImagePlus,
  Check,
  Copy,
  Code2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { qrByteString, qrMargin } from '@/lib/qr';
import {
  blankContact,
  displayName,
  entry,
  address,
  buildVCard,
  saveBlob,
  contrast,
  type Contact,
  type Entry,
  type Address,
} from '@/lib/vcard';

type Design = {
  dots: DotType;
  corner: CornerSquareType;
  eye: CornerDotType;
  ink: string;
  background: string;
  gradient: boolean;
  end: string;
  correction: ErrorCorrectionLevel;
  size: number;
  logo: string;
};
const initialDesign: Design = {
  dots: 'square',
  corner: 'square',
  eye: 'square',
  ink: '#172c50',
  background: '#ffffff',
  gradient: false,
  end: '#245cdd',
  correction: 'M',
  size: 1024,
  logo: '',
};
const presets = [
  {
    name: 'Classic',
    dots: 'square',
    corner: 'square',
    ink: '#172c50',
    end: '#245cdd',
    gradient: false,
  },
  {
    name: 'Soft',
    dots: 'rounded',
    corner: 'extra-rounded',
    ink: '#204fbb',
    end: '#204fbb',
    gradient: false,
  },
  {
    name: 'Dotted',
    dots: 'dots',
    corner: 'dot',
    ink: '#126452',
    end: '#126452',
    gradient: false,
  },
  {
    name: 'Gradient',
    dots: 'classy-rounded',
    corner: 'extra-rounded',
    ink: '#14276b',
    end: '#7330a8',
    gradient: true,
  },
] as const;
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      {label}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
function Pick({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: readonly (string | readonly [string, string])[];
}) {
  const id = useId();
  const options = items.map((i) =>
    typeof i === 'string'
      ? { value: i, label: i }
      : { value: i[0], label: i[1] },
  );
  return (
    <div className="field">
      <label id={id}>{label}</label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
        items={options}
      >
        <SelectTrigger aria-labelledby={id} className="pick">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Preferred({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="preferred">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      Preferred
    </label>
  );
}
function Heading({
  children,
  icon,
  action,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      {icon}
      <h2>{children}</h2>
      {action}
    </div>
  );
}
function Add({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      <Plus size={15} />
      {children}
    </button>
  );
}
function Rows({
  title,
  icon,
  rows,
  onChange,
  kind,
}: {
  title: string;
  icon: ReactNode;
  rows: Entry[];
  onChange: (rows: Entry[]) => void;
  kind: 'phone' | 'email' | 'url';
}) {
  const update = (id: string, patch: Partial<Entry>) =>
    onChange(
      rows.map((r) =>
        r.id === id
          ? { ...r, ...patch }
          : patch.preferred
            ? { ...r, preferred: false }
            : r,
      ),
    );
  const types: [string, string][] =
    kind === 'phone'
      ? [
          ['CELL', 'Mobile'],
          ['WORK', 'Work'],
          ['HOME', 'Home'],
          ['WORK,VOICE', 'Work voice'],
          ['FAX', 'Fax'],
          ['PAGER', 'Pager'],
          ['TEXT', 'Text'],
          ['VOICE', 'Other'],
        ]
      : [
          ['WORK', 'Work'],
          ['HOME', 'Home'],
          ['INTERNET', 'Other'],
        ];
  return (
    <>
      <Heading
        icon={icon}
        action={
          <Add
            onClick={() =>
              onChange([...rows, entry(kind === 'phone' ? 'CELL' : 'WORK')])
            }
          >
            Add{' '}
            {kind === 'phone' ? 'number' : kind === 'email' ? 'email' : 'link'}
          </Add>
        }
      >
        {title}
      </Heading>
      <div className="repeat-list">
        {rows.map((r, i) => (
          <div className="repeat-row" key={r.id}>
            <div className="repeat-main">
              <Pick
                label={`Type`}
                value={r.type}
                onChange={(v) => update(r.id, { type: v })}
                items={types}
              />
              <Field
                label={`${kind === 'phone' ? 'Phone number' : kind === 'email' ? 'Email' : 'Website'} ${i + 1}`}
                type={
                  kind === 'phone' ? 'tel' : kind === 'email' ? 'email' : 'url'
                }
                placeholder={
                  kind === 'phone'
                    ? '+1 555 123 4567'
                    : kind === 'email'
                      ? 'you@example.com'
                      : 'https://example.com'
                }
                value={r.value}
                onChange={(v) => update(r.id, { value: v })}
              />
              <button
                className="remove"
                aria-label={`Remove ${kind} ${i + 1}`}
                onClick={() => onChange(rows.filter((v) => v.id !== r.id))}
              >
                <X size={16} />
              </button>
            </div>
            <Preferred
              checked={r.preferred}
              onChange={(v) => update(r.id, { preferred: v })}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const [contact, setContact] = useState<Contact>(blankContact);
  const [design, setDesign] = useState<Design>(initialDesign);
  const [qrError, setQrError] = useState('');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentContact = useRef(contact);
  currentContact.current = contact;
  const name = displayName(contact);
  const result = useMemo(() => {
    try {
      return { text: buildVCard(contact), error: '' };
    } catch (e) {
      return { text: '', error: (e as Error).message };
    }
  }, [contact]);
  const bytes = new TextEncoder().encode(result.text).length;
  const patch = (key: keyof Contact, value: Contact[keyof Contact]) =>
    setContact((c) => ({ ...c, [key]: value }));
  const style = (p: Partial<Design>) => setDesign((d) => ({ ...d, ...p }));
  const filename =
    (name || 'contact')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'contact';
  const payload = name && !result.error ? result.text : '';
  const badContrast =
    Math.min(
      contrast(design.ink, design.background),
      design.gradient ? contrast(design.end, design.background) : 21,
    ) < 4.5;
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setQrError('');
    qrRef.current = null;
    mount.current?.replaceChildren();
    if (!payload) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { default: QRCode } = await import('qr-code-styling');
          const options: Options = {
            width: design.size,
            height: design.size,
            type: 'svg',
            data: qrByteString(payload),
            margin: qrMargin(design.size),
            qrOptions: {
              errorCorrectionLevel: design.logo ? 'H' : design.correction,
              mode: 'Byte',
            },
            dotsOptions: {
              type: design.dots,
              color: design.ink,
              ...(design.gradient
                ? {
                    gradient: {
                      type: 'linear',
                      rotation: Math.PI / 4,
                      colorStops: [
                        { offset: 0, color: design.ink },
                        { offset: 1, color: design.end },
                      ],
                    },
                  }
                : {}),
            },
            cornersSquareOptions: { type: design.corner, color: design.ink },
            cornersDotOptions: { type: design.eye, color: design.ink },
            backgroundOptions: { color: design.background },
            image: design.logo || undefined,
            imageOptions: {
              imageSize: 0.22,
              margin: Math.round(design.size * 0.012),
              hideBackgroundDots: true,
              saveAsBlob: true,
            },
          };
          const qr = new QRCode(options);
          await qr.getRawData('svg');
          if (cancelled) return;
          qrRef.current = qr;
          mount.current?.replaceChildren();
          if (mount.current) qr.append(mount.current);
          setReady(true);
        } catch {
          if (!cancelled) {
            setQrError(
              'This card is too large for a QR code, or its image could not be rendered. Shorten long fields or remove the logo. You can still download the vCard.',
            );
            setReady(false);
          }
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payload, design]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (t: Tool, o: { signal: AbortSignal }) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const tools: Tool[] = [
      {
        name: 'get_contact_vcard',
        description:
          'Read the current contact as vCard text, including validation errors.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          name: displayName(currentContact.current),
          vcard: buildVCard(currentContact.current),
        }),
      },
      {
        name: 'configure_contact_name',
        description:
          'Set first and last name in the visible contact editor. Does not download or publish.',
        inputSchema: {
          type: 'object',
          properties: { first: { type: 'string' }, last: { type: 'string' } },
          required: ['first', 'last'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const data = input as { first?: unknown; last?: unknown };
          if (
            !data ||
            typeof data.first !== 'string' ||
            typeof data.last !== 'string' ||
            Object.keys(data).some((k) => !['first', 'last'].includes(k))
          )
            throw new Error('Provide first and last as strings.');
          const first = data.first,
            last = data.last;
          flushSync(() =>
            setContact((c) => ({ ...c, first, last, display: '' })),
          );
          return { name: displayName(currentContact.current) };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => controller.abort();
  }, []);
  async function downloadQR(ext: 'png' | 'svg') {
    if (!ready || !qrRef.current) return;
    setWorking(true);
    try {
      const blob = await qrRef.current.getRawData(ext);
      if (!(blob instanceof Blob)) throw new Error();
      saveBlob(blob, filename + '-qr.' + ext);
      setNotice(`${ext.toUpperCase()} download started.`);
    } catch {
      setNotice('The QR download failed. Please try again.');
    } finally {
      setWorking(false);
    }
  }
  function downloadVCard() {
    if (!name || result.error) return;
    saveBlob(
      new Blob([result.text], { type: 'text/vcard;charset=utf-8' }),
      filename + '.vcf',
    );
    setNotice('Contact download started.');
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setNotice('Choose a PNG, JPEG, or WebP image smaller than 2 MB.');
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = data;
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 512 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      style({ logo: canvas.toDataURL('image/png') });
    } catch {
      setNotice('That image could not be read. Try another image.');
    }
  }
  const setAddress = (id: string, p: Partial<Address>) =>
    patch(
      'addresses',
      contact.addresses.map((a) =>
        a.id === id
          ? { ...a, ...p }
          : p.preferred
            ? { ...a, preferred: false }
            : a,
      ),
    );
  return (
    <div className="studio">
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <QrCode size={23} />
          </span>
          contact<span className="brand-light">/</span>qr
        </a>
        <span className="privacy">
          <LockKeyhole size={14} /> Made in your browser
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">CONTACT QR STUDIO</p>
            <h1>A little code. All your details.</h1>
            <p>
              Create a contact card, make it yours, and share it with a scan.
            </p>
          </div>
          <span className="edition">VCARD / QR</span>
        </div>
        <div className="workspace">
          <section className="editor panel">
            <Tabs defaultValue="contact">
              <TabsList className="editor-tabs">
                <TabsTrigger value="contact">
                  <UserRound />
                  Contact details
                </TabsTrigger>
                <TabsTrigger value="design">
                  <Palette />
                  QR design
                </TabsTrigger>
              </TabsList>
              <TabsContent value="contact">
                <Heading>Your contact card</Heading>
                <div className="fields">
                  <Field
                    label="First name"
                    value={contact.first}
                    onChange={(v) => patch('first', v)}
                    placeholder="Alex"
                  />
                  <Field
                    label="Last name"
                    value={contact.last}
                    onChange={(v) => patch('last', v)}
                    placeholder="Morgan"
                  />
                  <Field
                    label="Company"
                    value={contact.company}
                    onChange={(v) => patch('company', v)}
                    placeholder="Company or organization"
                  />
                  <Field
                    label="Job title"
                    value={contact.title}
                    onChange={(v) => patch('title', v)}
                    placeholder="What you do"
                  />
                </div>
                <details className="disclosure">
                  <summary>
                    More name & work details
                    <ChevronDown size={15} />
                  </summary>
                  <div className="fields">
                    {(
                      [
                        ['display', 'Display name'],
                        ['nickname', 'Nickname'],
                        ['prefix', 'Prefix'],
                        ['middle', 'Middle name'],
                        ['suffix', 'Suffix'],
                        ['department', 'Department'],
                        ['role', 'Role'],
                      ] as const
                    ).map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        value={contact[key]}
                        onChange={(v) => patch(key, v)}
                      />
                    ))}
                  </div>
                </details>
                <Rows
                  title="Phone numbers"
                  icon={<Phone size={18} />}
                  rows={contact.phones}
                  onChange={(r) => patch('phones', r)}
                  kind="phone"
                />
                <Rows
                  title="Email addresses"
                  icon={<Mail size={18} />}
                  rows={contact.emails}
                  onChange={(r) => patch('emails', r)}
                  kind="email"
                />
                <Rows
                  title="Websites & social links"
                  icon={<Globe size={18} />}
                  rows={contact.urls}
                  onChange={(r) => patch('urls', r)}
                  kind="url"
                />
                <Heading
                  icon={<MapPin size={18} />}
                  action={
                    <Add
                      onClick={() =>
                        patch('addresses', [...contact.addresses, address()])
                      }
                    >
                      Add address
                    </Add>
                  }
                >
                  Addresses
                </Heading>
                {!contact.addresses.length && (
                  <p className="hint">
                    Add a home, work, or other postal address.
                  </p>
                )}
                {contact.addresses.map((a, i) => (
                  <div className="address-box" key={a.id}>
                    <div className="address-heading">
                      <h3>Address {i + 1}</h3>
                      <button
                        className="remove"
                        aria-label={`Remove address ${i + 1}`}
                        onClick={() =>
                          patch(
                            'addresses',
                            contact.addresses.filter((v) => v.id !== a.id),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="fields">
                      <Pick
                        label="Address type"
                        value={a.type}
                        onChange={(v) => setAddress(a.id, { type: v })}
                        items={['WORK', 'HOME', 'POSTAL']}
                      />
                      <Field
                        label="Custom label (optional)"
                        placeholder="Head office, Factory, …"
                        value={a.label ?? ''}
                        onChange={(v) => setAddress(a.id, { label: v })}
                      />
                      <Field
                        label="Street address"
                        value={a.street}
                        onChange={(v) => setAddress(a.id, { street: v })}
                      />
                      <Field
                        label="Apartment / suite"
                        value={a.extended}
                        onChange={(v) => setAddress(a.id, { extended: v })}
                      />
                      <Field
                        label="City"
                        value={a.city}
                        onChange={(v) => setAddress(a.id, { city: v })}
                      />
                      <Field
                        label="State / region"
                        value={a.region}
                        onChange={(v) => setAddress(a.id, { region: v })}
                      />
                      <Field
                        label="Postal code"
                        value={a.postal}
                        onChange={(v) => setAddress(a.id, { postal: v })}
                      />
                      <Field
                        label="Country"
                        value={a.country}
                        onChange={(v) => setAddress(a.id, { country: v })}
                      />
                      <Field
                        label="PO box"
                        value={a.box}
                        onChange={(v) => setAddress(a.id, { box: v })}
                      />
                    </div>
                    <Preferred
                      checked={a.preferred}
                      onChange={(v) => setAddress(a.id, { preferred: v })}
                    />
                  </div>
                ))}
                {contact.addresses.length > 0 && (
                  <p className="hint">
                    Custom labels appear in compatible contacts apps. If a QR
                    scanner drops an address or displays punctuation
                    incorrectly, import the downloaded .vcf file instead.
                  </p>
                )}
                <details className="disclosure advanced">
                  <summary>
                    Personal details & extra properties
                    <ChevronDown size={15} />
                  </summary>
                  <div className="fields">
                    <Field
                      label="Birthday"
                      type="date"
                      value={contact.birthday}
                      onChange={(v) => patch('birthday', v)}
                    />
                    <Field
                      label="Contact photo URL"
                      type="url"
                      placeholder="https://…"
                      value={contact.photo}
                      onChange={(v) => patch('photo', v)}
                    />
                    <label className="field wide">
                      Notes
                      <Textarea
                        value={contact.note}
                        onChange={(e) => patch('note', e.target.value)}
                        placeholder="Anything else to keep with this contact"
                      />
                    </label>
                    <label className="field wide">
                      Extra vCard properties
                      <Textarea
                        className="code-input"
                        value={contact.extra}
                        onChange={(e) => patch('extra', e.target.value)}
                        placeholder={
                          'CATEGORIES:Design,Technology\nX-SOCIALPROFILE;TYPE=linkedin:https://linkedin.com/in/…'
                        }
                      />
                    </label>
                  </div>
                  <p className="hint">
                    For advanced fields: one vCard 3.0 property per line,
                    including any parameters and escaped values. Names and card
                    boundaries are added automatically. Support for extra fields
                    varies by contacts app.
                  </p>
                </details>
              </TabsContent>
              <TabsContent value="design">
                <Heading>Start with a style</Heading>
                <RadioGroup
                  className="presets"
                  value={
                    presets.find(
                      (p) =>
                        p.dots === design.dots &&
                        p.corner === design.corner &&
                        p.ink === design.ink &&
                        p.gradient === design.gradient,
                    )?.name || ''
                  }
                  onValueChange={(v) => {
                    const p = presets.find((p) => p.name === v);
                    if (p)
                      style({
                        dots: p.dots,
                        corner: p.corner,
                        eye: p.corner === 'dot' ? 'dot' : 'square',
                        ink: p.ink,
                        end: p.end,
                        gradient: p.gradient,
                        background: '#ffffff',
                      });
                  }}
                >
                  {presets.map((p) => (
                    <label className="preset" key={p.name}>
                      <span
                        className={'pattern pattern-' + p.name.toLowerCase()}
                        style={{ color: p.ink }}
                      >
                        {Array.from({ length: 16 }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <span>{p.name}</span>
                      <RadioGroupItem value={p.name} aria-label={p.name} />
                    </label>
                  ))}
                </RadioGroup>
                <Heading>Patterns & corners</Heading>
                <div className="fields">
                  <Pick
                    label="Dot pattern"
                    value={design.dots}
                    onChange={(v) => style({ dots: v as DotType })}
                    items={[
                      'square',
                      'rounded',
                      'dots',
                      'classy',
                      'classy-rounded',
                      'extra-rounded',
                    ]}
                  />
                  <Pick
                    label="Corner frame"
                    value={design.corner}
                    onChange={(v) => style({ corner: v as CornerSquareType })}
                    items={['square', 'dot', 'extra-rounded']}
                  />
                  <Pick
                    label="Corner center"
                    value={design.eye}
                    onChange={(v) => style({ eye: v as CornerDotType })}
                    items={['square', 'dot']}
                  />
                </div>
                <Heading>Colors</Heading>
                <div className="fields">
                  <label className="field">
                    Foreground
                    <div className="color-field">
                      <input
                        aria-label="Foreground color"
                        type="color"
                        value={design.ink}
                        onChange={(e) => style({ ink: e.target.value })}
                      />
                      <span>{design.ink.toUpperCase()}</span>
                    </div>
                  </label>
                  <label className="field">
                    Background
                    <div className="color-field">
                      <input
                        aria-label="Background color"
                        type="color"
                        value={design.background}
                        onChange={(e) => style({ background: e.target.value })}
                      />
                      <span>{design.background.toUpperCase()}</span>
                    </div>
                  </label>
                </div>
                <label className="switch-row">
                  <span>Use a gradient</span>
                  <Switch
                    checked={design.gradient}
                    onCheckedChange={(v) => style({ gradient: v })}
                  />
                </label>
                {design.gradient && (
                  <label className="field">
                    Gradient end
                    <div className="color-field">
                      <input
                        aria-label="Gradient end color"
                        type="color"
                        value={design.end}
                        onChange={(e) => style({ end: e.target.value })}
                      />
                      <span>{design.end.toUpperCase()}</span>
                    </div>
                  </label>
                )}
                <Heading>Center logo</Heading>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    void uploadLogo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                {design.logo ? (
                  <div className="logo-row">
                    <img src={design.logo} alt="Selected QR logo" />
                    <span>Logo added</span>
                    <button
                      className="text-button"
                      onClick={() => style({ logo: '' })}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    className="upload-button"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={21} />
                    <span>
                      Add a logo<small>PNG, JPEG, or WebP · up to 2 MB</small>
                    </span>
                    <Plus size={18} />
                  </button>
                )}
                <p className="hint">
                  This appears in the QR code, separate from the contact photo.
                </p>
                <Heading>Export settings</Heading>
                <div className="fields">
                  <Pick
                    label="Image size"
                    value={String(design.size)}
                    onChange={(v) => style({ size: Number(v) })}
                    items={[
                      ['512', '512 × 512 px'],
                      ['1024', '1024 × 1024 px'],
                      ['2048', '2048 × 2048 px'],
                    ]}
                  />
                  <Pick
                    label="Error correction"
                    value={design.logo ? 'H' : design.correction}
                    onChange={(v) =>
                      style({ correction: v as ErrorCorrectionLevel })
                    }
                    items={[
                      ['L', 'Low (7%)'],
                      ['M', 'Medium (15%)'],
                      ['Q', 'Quartile (25%)'],
                      ['H', 'High (30%)'],
                    ]}
                  />
                </div>
                <p className="hint">
                  A clear border is always included. Logos automatically use
                  high error correction.
                </p>
              </TabsContent>
            </Tabs>
          </section>
          <aside className="preview panel">
            <div className="preview-heading">
              <h2>Your QR code</h2>
              <span className="live">
                <i />
                Live preview
              </span>
            </div>
            <div className="qr-stage">
              <div
                ref={mount}
                className="qr-output"
                role="img"
                aria-label="Generated contact QR code"
                style={{ display: ready ? 'block' : 'none' }}
              />
              {!ready && (
                <div className="qr-empty">
                  <QrCode size={78} strokeWidth={1} />
                  <p>
                    {result.error
                      ? 'Check your extra properties'
                      : qrError
                        ? 'Too much information for this code'
                        : name
                          ? 'Generating your code…'
                          : 'Add your name or company to get started'}
                  </p>
                </div>
              )}
            </div>
            <div className="contact-caption">
              <strong>{name || 'Your name here'}</strong>
              <span>
                {contact.title && contact.company
                  ? `${contact.title} · ${contact.company}`
                  : contact.title || contact.company || 'Scan to save contact'}
              </span>
            </div>
            {(result.error || qrError) && (
              <p className="warning" role="alert">
                {result.error || qrError}
              </p>
            )}
            {badContrast && (
              <p className="warning">
                These colors have low contrast. Use a darker foreground and
                lighter background for easier scanning.
              </p>
            )}
            {bytes > 1100 && payload && !qrError && (
              <p className="hint">
                This is a detailed card. Use a larger printed code and test it
                on your phone.
              </p>
            )}
            <div className="download-buttons">
              <button
                className="primary-button"
                disabled={!ready || working}
                onClick={() => void downloadQR('png')}
              >
                <Download size={17} />
                Download PNG
              </button>
              <button
                className="secondary-button"
                disabled={!ready || working}
                onClick={() => void downloadQR('svg')}
              >
                SVG
              </button>
            </div>
            <button
              className="secondary-button"
              disabled={!name || !!result.error}
              onClick={downloadVCard}
            >
              <UserRound size={16} />
              Download contact (.vcf)
            </button>
            <p className="preview-note">
              Scan-test your final design before printing.
              <br />
              The contact is in the code and works offline.*
            </p>
            <details className="source">
              <summary>
                <Code2 size={15} />
                View vCard
                <ChevronDown size={14} />
              </summary>
              <pre>{result.text || result.error}</pre>
              <button
                className="text-button"
                disabled={!name || !!result.error}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.text);
                    setNotice('vCard copied.');
                  } catch {
                    setNotice(
                      'Copy was unavailable. Download the .vcf file instead.',
                    );
                  }
                }}
              >
                <Copy size={14} />
                Copy vCard
              </button>
            </details>
            <p className="tiny-note">
              *Linked photos and websites need internet. Edits require
              downloading a new QR code. Details stay in this tab and clear when
              you reload.
            </p>
          </aside>
        </div>
      </main>
      <footer>
        Built for a good first connection.
        <span>Private by design. Yours to share.</span>
      </footer>
      {notice && (
        <div className="notice" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
