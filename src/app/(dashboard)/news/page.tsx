import { getDb } from "@/db";
import { newsItems } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">
        News Feed
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No news items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="transition-colors duration-200 hover:border-sage-200/30">
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-sage-200 transition-colors hover:text-sage-100"
                  >
                    {item.headline}
                  </a>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {item.company && <span>{item.company}</span>}
                    {item.source && <span>via {item.source}</span>}
                  </div>
                  {item.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
                  <span className="text-xs text-muted-foreground">
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
