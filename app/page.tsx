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
  CircleAlert,
  ArrowDown,
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
  luminance,
  normalizeHex,
  VCardError,
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
const dotStyles = [
  ['square', 'Square'],
  ['rounded', 'Rounded'],
  ['dots', 'Dots'],
  ['classy', 'Classy'],
  ['classy-rounded', 'Classy rounded'],
  ['extra-rounded', 'Extra rounded'],
] as const;
const cornerStyles = [
  ['square', 'Square'],
  ['dot', 'Circle'],
  ['extra-rounded', 'Rounded'],
] as const;
const eyeStyles = [
  ['square', 'Square'],
  ['dot', 'Circle'],
] as const;
const addressTypes = [
  ['WORK', 'Work'],
  ['HOME', 'Home'],
  ['POSTAL', 'Postal'],
] as const;
// Byte-mode capacity of the largest (version 40) QR code at each correction level.
const qrCapacity: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
};
const correctionNames: Record<ErrorCorrectionLevel, string> = {
  L: 'Low',
  M: 'Medium',
  Q: 'Quartile',
  H: 'High',
};
type Notice = {
  message: string;
  tone?: 'error';
  action?: { label: string; run: () => void };
};
type ListKey = 'phones' | 'emails' | 'urls' | 'addresses';
const hasContent = (item: Entry | Address) =>
  Object.entries(item).some(
    ([key, value]) =>
      key !== 'id' &&
      key !== 'type' &&
      typeof value === 'string' &&
      value.trim() !== '',
  );
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  wide = false,
  autoComplete,
  focusOnMount,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  wide?: boolean;
  autoComplete?: string;
  focusOnMount?: boolean;
  error?: string;
}) {
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Only ever true for a row the user just added, so focus follows the click.
  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      {label}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        ref={inputRef}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value.toUpperCase());
  const [synced, setSynced] = useState(value);
  // Follow external changes (picker, presets) without clobbering in-progress typing.
  if (value !== synced) {
    setSynced(value);
    if (normalizeHex(draft) !== value) setDraft(value.toUpperCase());
  }
  const invalid = !normalizeHex(draft);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={'color-field' + (invalid ? ' is-invalid' : '')}>
        <input
          aria-label={`${label} color picker`}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id}
          className="hex-input"
          value={draft}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            // Commit full hex codes immediately; short #rgb codes wait for blur.
            if (/^#?[0-9a-f]{6}$/i.test(e.target.value.trim()))
              onChange(normalizeHex(e.target.value)!);
          }}
          onBlur={() => {
            const hex = normalizeHex(draft);
            if (hex) onChange(hex);
            setDraft((hex ?? value).toUpperCase());
          }}
        />
      </div>
    </div>
  );
}
function Pick({
  label,
  value,
  onChange,
  items,
  srLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: readonly (string | readonly [string, string])[];
  srLabel?: string;
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
        <SelectTrigger
          aria-labelledby={srLabel ? undefined : id}
          aria-label={srLabel}
          className="pick"
        >
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
const rowCopy = {
  phone: {
    noun: 'Phone number',
    add: 'Add number',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: '+1 555 123 4567',
    empty: 'Add a mobile, work, or home number.',
  },
  email: {
    noun: 'Email',
    add: 'Add email',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'you@example.com',
    empty: 'Add a work or personal email address.',
  },
  url: {
    noun: 'Website',
    add: 'Add link',
    type: 'url',
    autoComplete: 'url',
    placeholder: 'https://example.com',
    empty: 'Add a website, portfolio, or social profile.',
  },
} as const;
function Rows({
  title,
  icon,
  rows,
  onChange,
  onRemove,
  kind,
}: {
  title: string;
  icon: ReactNode;
  rows: Entry[];
  onChange: (rows: Entry[]) => void;
  onRemove: (id: string) => void;
  kind: 'phone' | 'email' | 'url';
}) {
  const [added, setAdded] = useState<string | null>(null);
  const copy = rowCopy[kind];
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
            onClick={() => {
              const row = entry(kind === 'phone' ? 'CELL' : 'WORK');
              setAdded(row.id);
              onChange([...rows, row]);
            }}
          >
            {copy.add}
          </Add>
        }
      >
        {title}
      </Heading>
      {!rows.length && <p className="hint">{copy.empty}</p>}
      <div className="repeat-list">
        {rows.map((r, i) => (
          <div className="repeat-row" key={r.id}>
            <div className="repeat-main">
              <Pick
                label="Type"
                srLabel={`${copy.noun} ${i + 1} type`}
                value={r.type}
                onChange={(v) => update(r.id, { type: v })}
                items={types}
              />
              <Field
                label={`${copy.noun} ${i + 1}`}
                type={copy.type}
                placeholder={copy.placeholder}
                autoComplete={`section-${r.id} ${copy.autoComplete}`}
                focusOnMount={r.id === added}
                value={r.value}
                onChange={(v) => update(r.id, { value: v })}
              />
              <button
                className="remove"
                aria-label={`Remove ${copy.noun.toLowerCase()} ${i + 1}`}
                title="Remove"
                onClick={() => onRemove(r.id)}
              >
                <X size={16} />
              </button>
            </div>
            {rows.length > 1 && (
              <Preferred
                checked={r.preferred}
                onChange={(v) => update(r.id, { preferred: v })}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const [contact, setContact] = useState<Contact>(blankContact);
  const [design, setDesign] = useState<Design>(initialDesign);
  const [qrAddressLabels, setQrAddressLabels] = useState<'standard' | 'custom'>(
    'standard',
  );
  const [qrFailed, setQrFailed] = useState(false);
  // `ready`: the visible code matches the current inputs. `shown`: a code is
  // visible at all (possibly the previous one while the next renders).
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [working, setWorking] = useState<'' | 'png' | 'svg'>('');
  const [addedAddress, setAddedAddress] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const currentContact = useRef(contact);
  currentContact.current = contact;
  const name = displayName(contact);
  const result = useMemo(() => {
    try {
      return {
        text: buildVCard(contact),
        qrText: buildVCard(contact, { addressLabels: qrAddressLabels }),
        error: '',
        errorField: null,
      };
    } catch (e) {
      return {
        text: '',
        qrText: '',
        error: (e as Error).message,
        errorField: e instanceof VCardError ? e.field : null,
      };
    }
  }, [contact, qrAddressLabels]);
  const bytes = new TextEncoder().encode(result.qrText).length;
  const capacity = qrCapacity[design.correction];
  const qrError = !qrFailed
    ? ''
    : bytes > capacity
      ? `This card needs ${bytes.toLocaleString()} bytes, but a QR code with ${correctionNames[design.correction]} error correction holds at most ${capacity.toLocaleString()}. Shorten or remove some fields${design.correction === 'L' ? '' : ', or lower the error correction in QR design'}. You can still download the .vcf.`
      : 'The QR code could not be rendered. Try removing the logo or choosing another image. You can still download the .vcf.';
  const hasDetails = Object.values(contact).some((value) =>
    typeof value === 'string'
      ? value.trim() !== ''
      : (value as (Entry | Address)[]).some(hasContent),
  );
  const notify = (message: string, extra: Omit<Notice, 'message'> = {}) =>
    setNotice({ message, ...extra });
  const patch = (key: keyof Contact, value: Contact[keyof Contact]) =>
    setContact((c) => ({ ...c, [key]: value }));
  const style = (p: Partial<Design>) => setDesign((d) => ({ ...d, ...p }));
  const filename =
    (name || 'contact')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'contact';
  const payload = name && !result.error ? result.qrText : '';
  const inks = design.gradient ? [design.ink, design.end] : [design.ink];
  const badContrast =
    Math.min(...inks.map((ink) => contrast(ink, design.background))) < 4.5;
  // Light-on-dark (inverted) codes are unreadable by many scanners.
  const inverted = inks.some(
    (ink) => luminance(ink) > luminance(design.background),
  );
  const weakLogoCorrection =
    !!design.logo && (design.correction === 'L' || design.correction === 'M');
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setQrFailed(false);
    qrRef.current = null;
    // Keep the previous code on screen while the next one renders, so typing
    // doesn't make the preview blink. Only clear it when there's nothing to show.
    if (!payload) {
      mount.current?.replaceChildren();
      setShown(false);
      return;
    }
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
              errorCorrectionLevel: design.correction,
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
          setShown(true);
        } catch {
          if (!cancelled) {
            mount.current?.replaceChildren();
            setShown(false);
            setQrFailed(true);
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
    const t = setTimeout(() => setNotice(null), notice.action ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [notice]);
  // Contact details live only in memory, so warn before a reload or close
  // throws them away.
  useEffect(() => {
    if (!hasDetails) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDetails]);
  // On narrow screens the preview sits below the long form; track whether it's
  // on screen so a shortcut button can be offered.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setPreviewVisible(e.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
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
    setWorking(ext);
    try {
      const blob = await qrRef.current.getRawData(ext);
      if (!(blob instanceof Blob)) throw new Error();
      saveBlob(blob, filename + '-qr.' + ext);
      notify(`${ext.toUpperCase()} download started.`);
    } catch {
      notify('The QR download failed. Please try again.', { tone: 'error' });
    } finally {
      setWorking('');
    }
  }
  function downloadVCard() {
    if (!name || result.error) return;
    saveBlob(
      new Blob([result.text], { type: 'text/vcard;charset=utf-8' }),
      filename + '.vcf',
    );
    notify('Contact download started.');
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      notify('Choose a PNG, JPEG, or WebP image smaller than 2 MB.', {
        tone: 'error',
      });
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
      notify('That image could not be read. Try another image.', {
        tone: 'error',
      });
    }
  }
  function removeItem(key: ListKey, id: string, noun: string) {
    const list: (Entry | Address)[] = contact[key];
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return;
    const item = list[index];
    setContact((c) => ({
      ...c,
      [key]: (c[key] as (Entry | Address)[]).filter((x) => x.id !== id),
    }));
    if (hasContent(item))
      notify(`${noun} removed.`, {
        action: {
          label: 'Undo',
          run: () =>
            setContact((c) => {
              const next: (Entry | Address)[] = [...c[key]];
              next.splice(Math.min(index, next.length), 0, item);
              return { ...c, [key]: next };
            }),
        },
      });
  }
  const scrollToPreview = () =>
    previewRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
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
                    autoComplete="given-name"
                    placeholder="Alex"
                  />
                  <Field
                    label="Last name"
                    value={contact.last}
                    onChange={(v) => patch('last', v)}
                    autoComplete="family-name"
                    placeholder="Morgan"
                  />
                  <Field
                    label="Company"
                    value={contact.company}
                    onChange={(v) => patch('company', v)}
                    autoComplete="organization"
                    placeholder="Company or organization"
                  />
                  <Field
                    label="Job title"
                    value={contact.title}
                    onChange={(v) => patch('title', v)}
                    autoComplete="organization-title"
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
                        ['display', 'Display name', 'name'],
                        ['nickname', 'Nickname', 'nickname'],
                        ['prefix', 'Prefix', 'honorific-prefix'],
                        ['middle', 'Middle name', 'additional-name'],
                        ['suffix', 'Suffix', 'honorific-suffix'],
                        ['department', 'Department', 'off'],
                        ['role', 'Role', 'off'],
                      ] as const
                    ).map(([key, label, autoComplete]) => (
                      <Field
                        key={key}
                        label={label}
                        autoComplete={autoComplete}
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
                  onRemove={(id) => removeItem('phones', id, 'Phone number')}
                  kind="phone"
                />
                <Rows
                  title="Email addresses"
                  icon={<Mail size={18} />}
                  rows={contact.emails}
                  onChange={(r) => patch('emails', r)}
                  onRemove={(id) => removeItem('emails', id, 'Email')}
                  kind="email"
                />
                <Rows
                  title="Websites & social links"
                  icon={<Globe size={18} />}
                  rows={contact.urls}
                  onChange={(r) => patch('urls', r)}
                  onRemove={(id) => removeItem('urls', id, 'Website')}
                  kind="url"
                />
                <Heading
                  icon={<MapPin size={18} />}
                  action={
                    <Add
                      onClick={() => {
                        const next = address();
                        setAddedAddress(next.id);
                        patch('addresses', [...contact.addresses, next]);
                      }}
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
                        title="Remove address"
                        onClick={() => removeItem('addresses', a.id, 'Address')}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="fields">
                      <Pick
                        label="Address type"
                        value={a.type}
                        onChange={(v) => setAddress(a.id, { type: v })}
                        items={addressTypes}
                      />
                      <Field
                        label="Custom label (optional)"
                        placeholder="Head office, Factory, …"
                        value={a.label ?? ''}
                        onChange={(v) => setAddress(a.id, { label: v })}
                      />
                      <Field
                        label="Street address"
                        autoComplete={`section-${a.id} address-line1`}
                        focusOnMount={a.id === addedAddress}
                        value={a.street}
                        onChange={(v) => setAddress(a.id, { street: v })}
                      />
                      <Field
                        label="Apartment / suite"
                        autoComplete={`section-${a.id} address-line2`}
                        value={a.extended}
                        onChange={(v) => setAddress(a.id, { extended: v })}
                      />
                      <Field
                        label="City"
                        autoComplete={`section-${a.id} address-level2`}
                        value={a.city}
                        onChange={(v) => setAddress(a.id, { city: v })}
                      />
                      <Field
                        label="State / region"
                        autoComplete={`section-${a.id} address-level1`}
                        value={a.region}
                        onChange={(v) => setAddress(a.id, { region: v })}
                      />
                      <Field
                        label="Postal code"
                        autoComplete={`section-${a.id} postal-code`}
                        value={a.postal}
                        onChange={(v) => setAddress(a.id, { postal: v })}
                      />
                      <Field
                        label="Country"
                        autoComplete={`section-${a.id} country-name`}
                        value={a.country}
                        onChange={(v) => setAddress(a.id, { country: v })}
                      />
                      <Field
                        label="PO box"
                        value={a.box}
                        onChange={(v) => setAddress(a.id, { box: v })}
                      />
                    </div>
                    {contact.addresses.length > 1 && (
                      <Preferred
                        checked={a.preferred}
                        onChange={(v) => setAddress(a.id, { preferred: v })}
                      />
                    )}
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
                      autoComplete="bday"
                      value={contact.birthday}
                      onChange={(v) => patch('birthday', v)}
                    />
                    <Field
                      label="Contact photo URL"
                      type="url"
                      placeholder="https://…"
                      autoComplete="photo"
                      error={
                        result.errorField === 'photo' ? result.error : undefined
                      }
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
                        spellCheck={false}
                        value={contact.extra}
                        onChange={(e) => patch('extra', e.target.value)}
                        aria-invalid={
                          result.errorField === 'extra' ? true : undefined
                        }
                        aria-describedby={
                          result.errorField === 'extra'
                            ? 'extra-error'
                            : undefined
                        }
                        placeholder={
                          'CATEGORIES:Design,Technology\nX-SOCIALPROFILE;TYPE=linkedin:https://linkedin.com/in/…'
                        }
                      />
                      {result.errorField === 'extra' && (
                        <span className="field-error" id="extra-error">
                          {result.error}
                        </span>
                      )}
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
                    items={dotStyles}
                  />
                  <Pick
                    label="Corner frame"
                    value={design.corner}
                    onChange={(v) => style({ corner: v as CornerSquareType })}
                    items={cornerStyles}
                  />
                  <Pick
                    label="Corner center"
                    value={design.eye}
                    onChange={(v) => style({ eye: v as CornerDotType })}
                    items={eyeStyles}
                  />
                </div>
                <Heading>Colors</Heading>
                <div className="fields">
                  <ColorField
                    label="Foreground"
                    value={design.ink}
                    onChange={(ink) => style({ ink })}
                  />
                  <ColorField
                    label="Background"
                    value={design.background}
                    onChange={(background) => style({ background })}
                  />
                </div>
                <label className="switch-row">
                  <span>Use a gradient</span>
                  <Switch
                    checked={design.gradient}
                    onCheckedChange={(v) => style({ gradient: v })}
                  />
                </label>
                {design.gradient && (
                  <div className="fields">
                    <ColorField
                      label="Gradient end"
                      value={design.end}
                      onChange={(end) => style({ end })}
                    />
                  </div>
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
                      onClick={() => fileRef.current?.click()}
                    >
                      Replace
                    </button>
                    <button
                      className="text-button"
                      onClick={() => style({ logo: '' })}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    className={
                      'upload-button' + (dragging ? ' is-dragging' : '')
                    }
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      void uploadLogo(e.dataTransfer.files[0]);
                    }}
                  >
                    <ImagePlus size={21} />
                    <span>
                      {dragging ? 'Drop to add logo' : 'Add a logo'}
                      <small>
                        Click or drop an image · PNG, JPEG, or WebP up to 2 MB
                      </small>
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
                    value={design.correction}
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
                  A clear border is always included. Higher error correction
                  scans more reliably when damaged or covered by a logo, but
                  holds less data ({bytes.toLocaleString()} of{' '}
                  {capacity.toLocaleString()} bytes used).
                </p>
              </TabsContent>
            </Tabs>
          </section>
          <aside className="preview panel" ref={previewRef}>
            <div className="preview-heading">
              <h2>Your QR code</h2>
              <span className={'live' + (ready ? '' : ' is-idle')}>
                <i />
                {ready ? 'Live preview' : shown ? 'Updating…' : 'Waiting'}
              </span>
            </div>
            {contact.addresses.some((a) => a.label?.trim()) && (
              <div className="qr-label-settings">
                <Pick
                  label="Address labels in QR"
                  value={qrAddressLabels}
                  onChange={(value) =>
                    setQrAddressLabels(value as 'standard' | 'custom')
                  }
                  items={[
                    ['standard', 'Standard labels · broader support'],
                    ['custom', 'Custom labels · iPhone'],
                  ]}
                />
                <p className="hint">
                  {qrAddressLabels === 'standard'
                    ? 'Uses Work / Home labels so basic scanners can read the addresses. Your .vcf download keeps the custom labels.'
                    : 'Keeps your custom labels. Some Android QR scanners skip addresses in this format.'}
                </p>
              </div>
            )}
            <div className="qr-stage">
              <div
                ref={mount}
                className={'qr-output' + (ready ? '' : ' is-updating')}
                role="img"
                aria-label={`QR code with the contact card for ${name}`}
                aria-busy={!ready}
                style={{ display: shown ? 'block' : 'none' }}
              />
              {!shown && (
                <div className="qr-empty">
                  <QrCode size={78} strokeWidth={1} />
                  <p>
                    {result.error
                      ? 'Fix the highlighted field to update your code'
                      : qrError
                        ? bytes > capacity
                          ? 'Too much information for this code'
                          : 'This code could not be drawn'
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
            {inverted ? (
              <p className="warning">
                The foreground is lighter than the background. Many scanners
                can&apos;t read inverted codes — use a dark foreground on a
                light background.
              </p>
            ) : (
              badContrast && (
                <p className="warning">
                  These colors have low contrast. Use a darker foreground and
                  lighter background for easier scanning.
                </p>
              )
            )}
            {weakLogoCorrection && (
              <p className="warning">
                A logo covers part of the code.{' '}
                {correctionNames[design.correction]} error correction may not be
                enough for it to scan.{' '}
                <button
                  className="inline-action"
                  onClick={() => style({ correction: 'H' })}
                >
                  Use High (30%)
                </button>
              </p>
            )}
            {bytes > 1100 && bytes <= capacity && payload && !qrError && (
              <p className="hint">
                This is a detailed card. Use a larger printed code and test it
                on your phone.
              </p>
            )}
            {contact.addresses.filter((a) =>
              [
                a.box,
                a.extended,
                a.street,
                a.city,
                a.region,
                a.postal,
                a.country,
              ].some((value) => value.trim()),
            ).length > 1 && (
              <p className="hint">
                All addresses are encoded. Some Android scanners save only the
                first postal address; use the .vcf download to import the full
                card.
              </p>
            )}
            <div className="download-buttons">
              <button
                className="primary-button"
                disabled={!ready || !!working}
                onClick={() => void downloadQR('png')}
              >
                <Download size={17} />
                {working === 'png' ? 'Preparing…' : 'Download PNG'}
              </button>
              <button
                className="secondary-button"
                aria-label="Download SVG"
                disabled={!ready || !!working}
                onClick={() => void downloadQR('svg')}
              >
                {working === 'svg' ? '…' : 'SVG'}
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
                View QR contact data
                {payload && (
                  <span className="byte-count">
                    {bytes.toLocaleString()} / {capacity.toLocaleString()} bytes
                  </span>
                )}
                <ChevronDown size={14} />
              </summary>
              <pre>{result.qrText || result.error}</pre>
              <button
                className="text-button"
                disabled={!name || !!result.error}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.qrText);
                    notify('QR contact data copied.');
                  } catch {
                    notify(
                      'Copy was unavailable. Download the .vcf file instead.',
                      { tone: 'error' },
                    );
                  }
                }}
              >
                <Copy size={14} />
                Copy QR contact data
              </button>
            </details>
            <p className="tiny-note">
              *Linked photos and websites need internet. Edits require
              downloading a new QR code. Details stay in this tab only and are
              cleared when you reload or close it.
            </p>
          </aside>
        </div>
      </main>
      <footer>
        Built for a good first connection.
        <span>Private by design. Yours to share.</span>
      </footer>
      {!previewVisible && (
        <button className="jump-to-preview" onClick={scrollToPreview}>
          {ready ? <QrCode size={17} /> : <ArrowDown size={17} />}
          {ready ? 'View QR code' : 'Preview'}
        </button>
      )}
      <div className="notice-region" aria-live="polite">
        {notice && (
          <div
            className={'notice' + (notice.tone === 'error' ? ' is-error' : '')}
            role={notice.tone === 'error' ? 'alert' : undefined}
          >
            {notice.tone === 'error' ? (
              <CircleAlert size={17} />
            ) : (
              <Check size={17} />
            )}
            <span>{notice.message}</span>
            {notice.action && (
              <button
                className="notice-action"
                onClick={() => {
                  notice.action?.run();
                  setNotice(null);
                }}
              >
                {notice.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
