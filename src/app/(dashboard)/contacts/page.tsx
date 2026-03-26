import Link from "next/link";
import { getDb } from "@/db";
import { contacts, vips } from "@/db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ContactsPageProps {
  readonly searchParams: { q?: string; page?: string };
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const db = getDb(process.env.DATABASE_URL!);
  const search = searchParams.q ?? "";
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  const baseQuery = db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      company: contacts.company,
      title: contacts.title,
      email: contacts.email,
      isVip: sql<boolean>`EXISTS (
        SELECT 1 FROM vips WHERE vips.contact_id = contacts.id AND vips.active = true
      )`,
    })
    .from(contacts);

  const rows = search
    ? await baseQuery
        .where(
          or(
            ilike(contacts.fullName, `%${search}%`),
            ilike(contacts.company, `%${search}%`),
            ilike(contacts.email, `%${search}%`)
          )
        )
        .orderBy(desc(contacts.updatedAt))
        .limit(limit)
        .offset(offset)
    : await baseQuery
        .orderBy(desc(contacts.updatedAt))
        .limit(limit)
        .offset(offset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          type="text"
          placeholder="Search contacts..."
          defaultValue={search}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-sm font-medium text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">VIP</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                rows.map((contact) => (
                  <tr key={contact.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {contact.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.company ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.title ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.email ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {contact.isVip ? (
                        <Badge variant="success">VIP</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link
            href={`/contacts?q=${encodeURIComponent(search)}&page=${page - 1}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Previous
          </Link>
        )}
        <span className="text-sm text-gray-500">Page {page}</span>
        {rows.length === limit && (
          <Link
            href={`/contacts?q=${encodeURIComponent(search)}&page=${page + 1}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
