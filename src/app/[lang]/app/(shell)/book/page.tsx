import { BookingSection } from "@/components/forms/BookingSection";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Book from the app: the same form as the website's /book, signed in, links staying in the app. */
export default async function AppBook({ searchParams }: { searchParams: SearchParams }) {
  return <BookingSection params={await searchParams} base="/app" />;
}
