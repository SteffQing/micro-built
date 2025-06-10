"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdvancedPaginationProps<TData> {
  table: Table<TData>;
}

export function TablePagination<TData>({
  table,
}: AdvancedPaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  // const pageSize = table.getState().pagination.pageSize;

  // Generate page numbers to display
  const getVisiblePages = () => {
    const totalPages = pageCount;
    const current = currentPage + 1; // Convert to 1-based
    const pages: number[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 4) {
        pages.push(-1); // Ellipsis
      }

      // Show pages around current page
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < totalPages - 3) {
        pages.push(-1); // Ellipsis
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex items-center justify-center gap-5 bg-[#f6f1f1] rounded-full px-2 py-1 w-fit  mx-auto">
      {/* Previous Button */}
      <div className="flex items-center gap-1">
        <div
          onClick={() => table.previousPage()}
          className={`rounded-full p-1 text-white ${
            !table.getCanPreviousPage()
              ? "bg-[#CCCCCC] cursor-not-allowed"
              : "bg-[#046307]"
          }`}
        >
          <ChevronLeft className="w-3 h-3" />
        </div>
        <span
          className={`text-xs ${
            !table.getCanPreviousPage()
              ? "text-muted-foreground cursor-not-allowed"
              : "text-primary"
          }`}
        >
          Prev
        </span>
      </div>

      {/* Page Numbers */}
      <div className="flex items-center mx-1 gap-2">
        {visiblePages.map((page, index) => {
          if (page === -1) {
            return (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                ...
              </span>
            );
          }

          const isCurrentPage = currentPage + 1 === page;

          return (
            <div
              key={page}
              onClick={() => table.setPageIndex(page - 1)}
              className={`flex items-center justify-center cursor-pointer text-xs ${
                isCurrentPage
                  ? "text-primary font-semibold "
                  : "text-muted-foreground"
              }`}
            >
              <span>{page}</span>
            </div>
          );
        })}
      </div>

      {/* Next Button */}
      <div className="flex items-center gap-1">
        <span
          className={`text-xs ${
            !table.getCanPreviousPage()
              ? "text-muted-foreground cursor-not-allowed"
              : "text-primary"
          }`}
        >
          Next
        </span>
        <div
          onClick={() => table.nextPage()}
          className={`rounded-full p-1 text-white ${
            !table.getCanNextPage()
              ? "bg-[#CCCCCC] cursor-not-allowed"
              : "bg-[#046307]"
          }`}
        >
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
