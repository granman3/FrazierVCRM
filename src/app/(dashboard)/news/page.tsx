import { getDb } from "@/db";
import { newsItems } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function categoryVariant(category: string | null) {
  const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    funding: "success",
    hiring: "default",
    departure: "destructive",
    product: "warning",
    partnership: "secondary",
  };
  return map[category ?? ""] ?? "secondary";
}

export default async function NewsPage() {
  const db = getDb(process.env.DATABASE_URL!);

  const items = await db
    .select()
    .from(newsItems)
    .orderBy(desc(newsItems.fetchedAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">News Feed</h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No news items yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {item.headline}
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    {item.company && <span>{item.company}</span>}
                    {item.source && <span>via {item.source}</span>}
                  </div>
                  {item.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {item.snippet}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  {item.category && (
                    <Badge variant={categoryVariant(item.category)}>
                      {item.category}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">
                    {item.fetchedAt.toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
