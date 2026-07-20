import { PaginationComp } from "@/components/PaginationComp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBlog } from "@/hooks/useBlog";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Loader, Pencil, Plus, Trash } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

export default function BlogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { isBlogFetching, blogData, blogError, totalPage, isMutating, mutateBlog, refetchBlog } =
    useBlog({
      page: currentPage,
      depandencyArray: [currentPage],
    });

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-2xl">Blog Posts</h2>
        <Link to="/blogs/new">
          <Button variant="own" className="flex items-center gap-1.5">
            <Plus />
            New Blog Post
          </Button>
        </Link>
      </div>

      <LoadingHandler
        loading={isBlogFetching}
        error={blogError}
        length={blogData.length}
        noDataMsg="No blog posts found"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-green-600 hover:!bg-green-600">
              <TableHead className="text-white">Title</TableHead>
              <TableHead className="text-white text-center">Status</TableHead>
              <TableHead className="text-white text-center">Created</TableHead>
              <TableHead className="text-right text-white">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blogData.map((blog) => (
              <TableRow key={blog.id}>
                <TableCell className="font-medium">
                  <div>
                    <p>{blog.title}</p>
                    <span className="text-xs text-gray-500 font-normal">/{blog.slug}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {blog.status === "published" ? (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white text-sm">
                      Published
                    </span>
                  ) : (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-yellow-500 text-white text-sm">
                      Draft
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-600">
                  {blog.created_at}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-5">
                    <Link to={`/blogs/${blog.id}`}>
                      <Pencil className="cursor-pointer" size={16} />
                    </Link>
                    {isMutating ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Trash
                        className="cursor-pointer"
                        size={16}
                        onClick={() => {
                          if (!confirm("Delete this blog post?")) return;
                          mutateBlog({
                            type: "delete",
                            id: blog.id,
                            onSuccess() { refetchBlog(); },
                          });
                        }}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <PaginationComp
          totalPage={totalPage}
          page={currentPage}
          totalItems={blogData.length}
          onPageChange={(page) => {
            setSearchParams((prev) => {
              prev.set("page", page.toString());
              return prev;
            });
          }}
        />
      </LoadingHandler>
    </main>
  );
}
