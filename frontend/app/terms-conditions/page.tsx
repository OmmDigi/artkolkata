import { notFound } from "next/navigation";
import { Metadata } from "next";
import EditorJsDescription from "@/app/Component/EditorJsDescription";
import { unstable_noStore } from "next/cache";

export const revalidate = 300;

async function getPage(slug: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.0.184:8080";
    const baseUrl = apiUrl.replace(/\/$/, "");
    const res = await fetch(
      `${baseUrl}/api/v1/pages/${slug}`,
      {
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error(`Failed to fetch page ${slug}:`, error);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("terms-and-conditions");

  if (!page) {
    return {
      title: "Terms and Conditions | ART KOLKATA",
      description: "Terms and Conditions",
    };
  }

  return {
    title: page.resolved_meta_title,
    description: page.meta_description ?? undefined,
  };
}

export default async function TermsAndConditions() {
  unstable_noStore();
  
  const page = await getPage("terms-and-conditions");

  if (!page) {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto py-16 px-5 min-h-[70vh] bg-white">
      <h1 className="text-4xl font-bold mb-4 text-gray-700">
        {page.title}
      </h1>
      
      {page.updated_at_label && (
        <p className="text-sm text-gray-500 mb-8 font-medium">
          Last updated: {page.updated_at_label}
        </p>
      )}

      {!page.content_json ? (
        <div className="py-12 text-center text-gray-500">
          These terms are currently being updated.
        </div>
      ) : (
        <div className="mt-8 prose prose-gray max-w-none">
        {page.content_json ? (
          <EditorJsDescription data={page.content_json} />
        ) : (
          <p className="text-gray-500">No content available.</p>
        )}
      </div>
      )}
    </main>
  );
}
