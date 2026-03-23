import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  if (!session.user.setupComplete) {
    redirect("/setup");
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>{children}</main>
    </div>
  );
}
