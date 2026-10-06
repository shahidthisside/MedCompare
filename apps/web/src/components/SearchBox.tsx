'use client';
// Search input with live type-ahead (ARIA combobox), recent searches and "/" to focus.

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { cx, Icon } from './ui';

interface Suggestion { name: string; composition?: string }
type Option = { kind: 'suggest' | 'recent' | 'query'; text: string; sub?: string };

const RECENT_KEY = 'medcompare:recent';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; } };
const writeRecent = (list: string[]) => { try { if (list.length) localStorage.setItem(RECENT_KEY, JSON.stringify(list)); else localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } };
function pushRecent(q: string) {
  writeRecent([q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8));
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="font-semibold text-ink">{text.slice(i, i + query.length)}</span>{text.slice(i + query.length)}</>;
}

export function SearchBox({ size = 'lg', autoFocus = false }: { size?: 'lg' | 'sm'; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get('q') ?? '';
  const [value, setValue] = useState(current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => setValue(current), [current]);

  // "/" focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !/input|textarea/i.test((e.target as HTMLElement).tagName)) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced type-ahead.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === current) { setSuggestions([]); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<{ suggestions?: Suggestion[] }>)
        .then((j) => { setSuggestions(j.suggestions ?? []); setActive(-1); })
        .catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, current]);

  const typed = value.trim();
  const options: Option[] = typed.length >= 2
    ? [{ kind: 'query', text: typed }, ...suggestions.filter((s) => s.name.toLowerCase() !== typed.toLowerCase()).map((s) => ({ kind: 'suggest' as const, text: s.name, sub: s.composition }))]
    : recent.map((r) => ({ kind: 'recent' as const, text: r }));
  const show = open && options.length > 0;

  const go = (q: string) => {
    const t = q.trim();
    if (t.length < 2) return;
    pushRecent(t);
    setOpen(false);
    input.current?.blur();
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  const removeRecent = (q: string) => {
    const next = readRecent().filter((x) => x !== q);
    writeRecent(next);
    setRecent(next);
    setActive(-1);
    input.current?.focus();
  };
  const clearRecent = () => { writeRecent([]); setRecent([]); setActive(-1); input.current?.focus(); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift+Delete removes the highlighted recent search (same shortcut as browser address bars).
    if (e.key === 'Delete' && e.shiftKey && active >= 0 && options[active]?.kind === 'recent') { e.preventDefault(); removeRecent(options[active].text); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active >= 0 && options[active] ? options[active].text : value); }
  };

  const lg = size === 'lg';
  return (
    <div className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); go(value); }}
        className={cx(
          'flex items-center gap-2 border bg-surface transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15',
          lg ? 'h-14 rounded-xl border-line-2 pl-4 pr-1.5 shadow-card' : 'h-10 rounded-lg border-line-2 bg-surface-2 pl-3 pr-1 focus-within:bg-surface',
        )}
      >
        <Icon name="search" className={cx('text-ink-3', lg ? 'size-5' : 'size-[18px]')} />
        <label htmlFor={`${id}-q`} className="sr-only">Search medicines</label>
        <input
          ref={input}
          id={`${id}-q`}
          role="combobox"
          aria-expanded={show}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => { setRecent(readRecent()); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={lg ? 'Search medicine or salt, e.g. Dolo 650' : 'Search medicines and salts'}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className={cx('min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-4', lg ? 'text-base' : 'text-sm')}
        />
        {loading && <span aria-hidden className="mr-1 size-4 animate-spin rounded-full border-2 border-line-2 border-t-brand" />}
        {lg ? (
          <button type="submit" aria-label="Compare prices" className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-on-brand transition hover:bg-brand-strong sm:px-6"><Icon name="search" className="size-[18px] sm:hidden" /><span className="hidden sm:inline">Compare prices</span></button>
        ) : (
          <kbd className="mr-1.5 hidden rounded border border-line-2 bg-surface px-1.5 text-[11px] font-medium text-ink-4 lg:block">/</kbd>
        )}
      </form>

      {show && (
        <ul id={`${id}-list`} role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[60vh] overflow-auto rounded-xl border border-line bg-surface py-1.5 text-left shadow-pop">
          {options[0]?.kind === 'recent' && (
            <li role="presentation" className="flex items-center justify-between px-4 pb-1 pt-1.5">
              <span className="text-xs font-medium text-ink-3">Recent searches</span>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clearRecent} className="rounded px-1 text-xs font-semibold text-brand hover:text-brand-strong">Clear all</button>
            </li>
          )}
          {options.map((o, i) => (
            <li
              key={`${o.kind}-${o.text}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(o.text)}
              className={cx('flex cursor-pointer items-center gap-3 px-4 py-2', active === i && 'bg-surface-2')}
            >
              <Icon name={o.kind === 'recent' ? 'clock' : 'search'} className="size-4 text-ink-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink-2">
                  {o.kind === 'query' ? <>Search for <span className="font-semibold text-ink">“{o.text}”</span></> : <Highlight text={o.text} query={typed} />}
                </span>
                {o.sub && <span className="block truncate text-xs text-ink-3">{o.sub}</span>}
              </span>
              {o.kind === 'suggest' && <Icon name="chevronRight" className="size-4 text-ink-4" />}
              {o.kind === 'recent' && (
                <button
                  type="button"
                  aria-label={`Remove “${o.text}” from recent searches`}
                  title="Remove"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); removeRecent(o.text); }}
                  className="-mr-1.5 grid size-7 place-items-center rounded-md text-ink-4 transition hover:bg-line hover:text-ink"
                >
                  <Icon name="close" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
