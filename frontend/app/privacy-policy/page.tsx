import { notFound } from "next/navigation";
import { Metadata } from "next";
import EditorJsDescription from "@/app/Component/EditorJsDescription";
import { unstable_noStore } from "next/cache";

export const revalidate = 300;

async function getPage(slug: string) {
  try {
    const apiUrl = process.env.API_BASE_URL || "http://192.168.0.184:8080";
    const baseUrl = apiUrl.replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/v1/pages/${slug}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error(`Failed to fetch page ${slug}:`, error);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  unstable_noStore();
  const page = await getPage("privacy-policy");

  if (!page) {
    return {
      title: "Privacy Policy | ART KOLKATA",
      description: "Privacy Policy",
    };
  }

  return {
    title: page.resolved_meta_title,
    description: page.meta_description ?? undefined,
  };
}

export default async function PrivacyPolicy() {
  const page = await getPage("privacy-policy");

  if (!page) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto py-16 px-5 min-h-[70vh] bg-white">
      <h1 className="text-4xl font-bold mb-4 text-gray-700">{page.title}</h1>

      {page.updated_at_label && (
        <p className="text-sm text-gray-500 mb-8 font-medium">
          Last updated: {page.updated_at_label}
        </p>
      )}

      {!page.content_json ? (
        <div className="py-12 text-center text-gray-500">
          This policy is currently being updated.
        </div>
      ) : (
        <div className="mt-8 prose prose-gray max-w-none">
          <EditorJsDescription
            data={page.content_json}
            headingToDropdown={false}
          />
        </div>
      )}
    </main>
  );
}
