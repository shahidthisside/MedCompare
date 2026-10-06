import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { Icon, type IconName, PharmacyLogo } from '@/components/ui';
import { SOURCES } from '@/lib/sources/meta';

// Search shortcuts only. Every price on the site is fetched live when you search.
const CONDITIONS: { t: string; q: string; icon: IconName; tint: string }[] = [
  { t: 'Fever & Pain', q: 'paracetamol', icon: 'thermometer', tint: 'bg-[#fef3f2] text-[#d92d20] dark:bg-white/[0.06]' },
  { t: 'Diabetes', q: 'metformin', icon: 'droplet', tint: 'bg-[#eff8ff] text-[#1570ef] dark:bg-white/[0.06]' },
  { t: 'Blood Pressure', q: 'telmisartan', icon: 'pulse', tint: 'bg-[#fdf2fa] text-[#c11574] dark:bg-white/[0.06]' },
  { t: 'Heart & Cholesterol', q: 'atorvastatin', icon: 'heart', tint: 'bg-[#fff1f3] text-[#e31b54] dark:bg-white/[0.06]' },
  { t: 'Acidity & Digestion', q: 'pantoprazole', icon: 'stomach', tint: 'bg-[#fef6ee] text-[#e04f16] dark:bg-white/[0.06]' },
  { t: 'Allergy', q: 'cetirizine', icon: 'flower', tint: 'bg-[#f4f3ff] text-[#6938ef] dark:bg-white/[0.06]' },
  { t: 'Cough & Respiratory', q: 'montelukast', icon: 'lungs', tint: 'bg-[#ecfdf3] text-[#079455] dark:bg-white/[0.06]' },
  { t: 'Antibiotics', q: 'azithromycin', icon: 'pill', tint: 'bg-[#f0f9ff] text-[#0086c9] dark:bg-white/[0.06]' },
  { t: 'Thyroid', q: 'thyroxine', icon: 'shield', tint: 'bg-[#fefbe8] text-[#ca8504] dark:bg-white/[0.06]' },
  { t: 'Vitamins & Supplements', q: 'vitamin d3', icon: 'sun2', tint: 'bg-[#fffaeb] text-[#dc6803] dark:bg-white/[0.06]' },
];

const POPULAR = ['Dolo 650', 'Pan 40', 'Telma 40', 'Azithral 500', 'Thyronorm 50', 'Glycomet 500', 'Montair LC', 'Shelcal 500'];

const FAQ: [string, string][] = [
  ['Are the prices live?', 'Yes. Every search asks each pharmacy at that moment. A pharmacy’s answer is reused for up to 10 minutes for the same search and location, and you can refresh at any time.'],
  ['Why do prices change with my PIN code?', 'Some pharmacies, including Tata 1mg and Apollo, price and deliver differently by city or PIN code. MedCompare sends your location with each search so you see the price you would actually pay.'],
  ['What does “price per tablet” mean?', 'The pack price divided by the number of tablets, capsules or ml in it. It lets you compare a strip of 10 with a strip of 15 fairly.'],
  ['Are the cheaper alternatives safe to switch to?', 'Alternatives have the same salt composition, strength and dosage form. Whether to switch is a decision for you and your doctor or pharmacist.'],
  ['Does MedCompare sell medicines?', 'No. MedCompare only compares prices. When you click Buy, you order directly on the pharmacy’s own website.'],
];

export default function Home() {
  return (
    <>
      {/* Search hero */}
      <section className="border-b border-line bg-gradient-to-b from-brand-soft to-bg dark:from-surface dark:to-bg">
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-12 text-center sm:px-6 sm:pt-16">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-[44px] sm:leading-[1.15]">
            Compare medicine prices across {SOURCES.length} online pharmacies
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-ink-3 sm:text-lg">
            Live prices for your PIN code, compared per tablet, with cheaper brands of the same salt. Free, with no sign-up.
          </p>
          <div className="mx-auto mt-8 max-w-3xl text-left">
            <Suspense><SearchBox size="lg" autoFocus /></Suspense>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-ink-3">Popular searches:</span>
            {POPULAR.map((p) => (
              <Link key={p} prefetch={false} href={`/search?q=${encodeURIComponent(p)}`} className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium text-ink-2 transition hover:border-brand hover:text-brand">
                {p}
              </Link>
            ))}
          </div>
          <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 text-left sm:grid-cols-4">
            {[
              ['bolt', 'Live prices', 'Fetched when you search'],
              ['pin', 'PIN-code pricing', 'Your city, your price'],
              ['scale', 'Per-tablet comparison', 'Fair across pack sizes'],
              ['shield', 'Unbiased', 'We don’t sell medicines'],
            ].map(([icon, t, d]) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-brand shadow-card ring-1 ring-line"><Icon name={icon as IconName} className="size-[18px]" /></span>
                <span><span className="block text-[13.5px] font-semibold">{t}</span><span className="block text-xs text-ink-3">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pharmacies */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-ink-3">Prices compared from</p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {SOURCES.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <PharmacyLogo id={s.id} size={24} /> {s.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Conditions */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6" aria-labelledby="cond-h">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="cond-h" className="text-2xl font-bold tracking-tight">Browse by health condition</h2>
            <p className="mt-1 text-sm text-ink-3">Compare common medicines for each condition.</p>
          </div>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CONDITIONS.map((c) => (
            <li key={c.t}>
              <Link prefetch={false} href={`/search?q=${encodeURIComponent(c.q)}`} className="group flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-brand-line hover:shadow-pop">
                <span className={`grid size-11 shrink-0 place-items-center rounded-lg ${c.tint}`}><Icon name={c.icon} className="size-[22px]" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{c.t}</span>
                  <span className="mt-0.5 block truncate text-xs capitalize text-ink-3">{c.q}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it helps */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6" aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl font-bold tracking-tight">How MedCompare helps you save</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['search', 'Search once', `Type a brand or salt name. We check ${SOURCES.length} pharmacies at the same time and show results as they come in.`],
            ['scale', 'Compare fairly', 'Every offer shows the pack price, MRP, discount and price per tablet, so different pack sizes compare correctly.'],
            ['swap', 'Find cheaper alternatives', 'See brands with the identical composition, strength and form, sorted by price per tablet.'],
          ].map(([icon, t, d], i) => (
            <article key={t} className="rounded-xl border border-line bg-surface p-6 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand"><Icon name={icon as IconName} className="size-5" /></span>
                <span className="text-xs font-semibold text-ink-4">STEP {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Savings banner */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10 dark:border dark:border-brand-line dark:bg-brand-soft dark:text-ink">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/75 dark:text-brand">Same salt, lower price</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">Branded generics often cost far less for the same composition.</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80 dark:text-ink-3">Every search lists alternatives with the same salt, strength and form, cheapest per tablet first.</p>
          </div>
          <Link prefetch={false} href="/search?q=paracetamol%20650" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-brand-strong transition hover:bg-brand-soft dark:bg-brand dark:text-on-brand">
            See an example <Icon name="arrow" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pt-16 sm:px-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-center text-2xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                {q}
                <Icon name="chevron" className="size-5 text-ink-3 transition group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-3">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
