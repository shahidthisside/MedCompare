import Link from 'next/link';
import { SOURCES } from '@/lib/sources/meta';
import { Logo } from './Header';
import { Icon, PharmacyLogo } from './ui';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-3">
            Compare live medicine prices across India’s leading online pharmacies for your PIN code, and find cheaper brands with the same composition.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-ink-2">
            <li className="flex items-center gap-2"><Icon name="shield" className="size-4 text-ok" /> We never sell medicines or collect payments</li>
            <li className="flex items-center gap-2"><Icon name="bolt" className="size-4 text-brand" /> Prices fetched live from each pharmacy</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Pharmacies compared</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {SOURCES.map((s) => (
              <li key={s.id}>
                <a href={s.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-ink-3 hover:text-ink">
                  <PharmacyLogo id={s.id} size={16} /> {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">MedCompare</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-3">
            <li><Link href="/" className="hover:text-ink">Compare prices</Link></li>
            <li><Link href="/cart" className="hover:text-ink">Cart</Link></li>
            <li><Link href="/about" className="hover:text-ink">How it works</Link></li>
            <li><Link href="/about#disclaimer" className="hover:text-ink">Medical disclaimer</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs leading-relaxed text-ink-4 sm:px-6">
          MedCompare is a price comparison service and does not provide medical advice. Consult your doctor or pharmacist before changing any medicine. Prices are shown as listed by each pharmacy for a logged-out visitor and may change at checkout. Pharmacy names and logos belong to their respective owners; MedCompare is not affiliated with them.
        </p>
      </div>
    </footer>
  );
}
