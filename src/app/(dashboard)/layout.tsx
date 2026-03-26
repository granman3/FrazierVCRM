import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const headersList = headers();
  const pathname = headersList.get("x-next-pathname") ?? "/dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar currentPath={pathname} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h1 className="text-lg font-semibold text-gray-900">
            Frazier VC CRM
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {session.user?.name ?? session.user?.email}
            </span>
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt="Avatar"
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                {(session.user?.name ?? session.user?.email ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
