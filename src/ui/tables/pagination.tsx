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
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  const getVisiblePages = () => {
    const totalPages = pageCount;
    const current = currentPage + 1;
    const pages: number[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (current > 4) {
        pages.push(-1);
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < totalPages - 3) {
        pages.push(-1);
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
		<div className="mx-auto flex w-full max-w-full flex-wrap items-center justify-center gap-3 rounded-3xl bg-muted px-3 py-2 sm:w-fit sm:px-4">
			<div className="flex items-center gap-1">
				<div
					onClick={() => {
						if (canPreviousPage) {
							table.previousPage();
						}
					}}
					className={`rounded-full p-2 text-white ${
						!canPreviousPage
							? "bg-[#CCCCCC] cursor-not-allowed pointer-events-none opacity-50"
							: "bg-primary cursor-pointer"
					}`}>
					<ChevronLeft className="w-4 h-4" />
				</div>
				<span
					className={`text-xs ${
						!canPreviousPage
							? "text-muted-foreground cursor-not-allowed"
							: "text-primary"
					}`}>
					Prev
				</span>
			</div>

			<div className="flex max-w-full items-center gap-2 overflow-x-auto px-1">
				{visiblePages.map((page, index) => {
					if (page === -1) {
						return (
							<span
								key={`ellipsis-${index}`}
								className="px-2 text-muted-foreground">
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
							}`}>
							<span>{page}</span>
						</div>
					);
				})}
			</div>

			<div className="flex items-center gap-1">
				<span
					className={`text-xs ${
						!canNextPage
							? "text-muted-foreground cursor-not-allowed"
							: "text-primary"
					}`}>
					Next
				</span>
				<div
					onClick={() => {
						if (canNextPage) {
							table.nextPage();
						}
					}}
					className={`rounded-full p-2 text-white ${
						!canNextPage
							? "bg-[#CCCCCC] cursor-not-allowed pointer-events-none opacity-50"
							: "bg-primary cursor-pointer"
					}`}>
					<ChevronRight className="w-4 h-4" />
				</div>
			</div>
		</div>
	);
}
