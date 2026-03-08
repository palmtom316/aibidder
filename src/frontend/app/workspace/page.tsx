import { redirect } from "next/navigation";

export default async function WorkspaceIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;

  if (projectId) {
    redirect(`/?projectId=${encodeURIComponent(projectId)}`);
  }

  redirect("/");
}
