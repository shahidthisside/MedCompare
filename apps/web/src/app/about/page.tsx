import type { Metadata } from 'next';
import { Icon, type IconName, PharmacyLogo } from '@/components/ui';
import { SOURCES } from '@/lib/sources/meta';

export const metadata: Metadata = { title: 'How it works' };

const STEPS: [IconName, string, string][] = [
  ['bolt', 'Live prices', `Your search goes to ${SOURCES.length} pharmacies at the same moment. Results appear as each pharmacy responds; nothing is pre-loaded.`],
  ['pin', 'Location-aware', 'Tata 1mg prices by city and Apollo by PIN code, so your location is sent with each search. It is stored only in your browser.'],
  ['pill', 'Exact product matching', 'Listings are grouped only when brand, strength and dosage form match. Sustained-release versions are kept separate.'],
  ['scale', 'Price per tablet', 'Pack price divided by the number of tablets or ml, so different pack sizes can be compared fairly.'],
  ['swap', 'Same-salt alternatives', 'Brands with identical composition, strength and form, sorted by price per tablet.'],
  ['refresh', 'Fresh results', 'A pharmacy’s response is reused for up to 10 minutes per location to avoid overloading it. Use Refresh to check again.'],
];

export default function About() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">How MedCompare works</h1>
      <p className="mt-2 max-w-2xl text-ink-3">MedCompare is an independent price comparison service for medicines sold by Indian online pharmacies.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(([icon, t, d]) => (
          <li key={t} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Icon name={icon} className="size-5" /></span>
            <h2 className="mt-4 font-semibold">{t}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-3">{d}</p>
          </li>
        ))}
      </ul>
      <section className="mt-10 rounded-xl border border-line bg-surface p-6 shadow-card">
        <h2 className="font-semibold">Pharmacies compared</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SOURCES.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm text-ink-2"><PharmacyLogo id={s.id} size={22} />{s.name}</li>
          ))}
        </ul>
      </section>
      <section id="disclaimer" className="mt-6 scroll-mt-36 rounded-xl border border-warn/30 bg-warn-soft p-6">
        <h2 className="flex items-center gap-2 font-semibold text-warn"><Icon name="info" className="size-5" /> Medical disclaimer</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">MedCompare compares prices and does not provide medical advice. Consult your doctor or pharmacist before switching to another brand. Prices are as listed by each pharmacy for a logged-out visitor and may change at checkout. MedCompare does not sell medicines and is not affiliated with the pharmacies listed.</p>
      </section>
    </div>
  );
}
