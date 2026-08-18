import axios from "axios";

export async function fetchAllBlogSlugs(): Promise<string[]> {
  const WP_API_BASE = `${process.env.WORDPRESS_HOST}/wp-json/custom/v1/posts?categories=ArtKolkata`;
  const PER_PAGE = 100;

  const slugs: string[] = [];
  let page = 1;
  let totalPages = 1;

  try {
    // Initial request to get total number of pages
    const initialResponse = await axios.get(WP_API_BASE, {
      params: {
        per_page: PER_PAGE,
        page,
        _fields: "slug",
        status: "publish",
      },
    });

    totalPages = parseInt(initialResponse.headers["x-wp-totalpages"], 10) || 1;
    slugs.push(...initialResponse.data.map((post: any) => post.slug));

    // Fetch remaining pages if needed
    const fetches = [];
    for (let i = 2; i <= totalPages; i++) {
      fetches.push(
        axios.get(WP_API_BASE, {
          params: {
            per_page: PER_PAGE,
            page: i,
            _fields: "slug",
            status: "publish",
          },
        })
      );
    }

    const responses = await Promise.all(fetches);
    for (const res of responses) {
      slugs.push(...res.data.map((post: any) => post.slug));
    }

    return slugs;
  } catch (error: any) {
    console.error("Error fetching slugs:", error.message || error);
    return [];
  }
}
