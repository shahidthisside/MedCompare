import type { Metadata } from 'next';
import { SearchResults } from '@/components/SearchResults';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `${q}: compare prices` : 'Search', robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  return <SearchResults query={q.slice(0, 80)} />;
}
