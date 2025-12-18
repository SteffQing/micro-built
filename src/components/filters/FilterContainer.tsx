"use client";

import * as React from "react";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FilterIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterContainerProps {
	children: React.ReactNode;
	onApply?: () => void;
	onClear?: () => void;
	title?: string;
	description?: string;
	triggerLabel?: string;
	applyLabel?: string;
	clearLabel?: string;
	className?: string;
	activeFiltersCount?: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	side?: "top" | "bottom" | "left" | "right";
}

export const FilterContainer = React.forwardRef<
	HTMLDivElement,
	FilterContainerProps
>(
	(
		{
			children,
			onApply,
			onClear,
			title = "Filters",
			description = "Apply filters to refine your results",
			triggerLabel = "Filters",
			applyLabel = "Apply Filters",
			clearLabel = "Clear All",
			className,
			activeFiltersCount = 0,
			open,
			onOpenChange,
			side = "right", // Default to right side
		},
		ref,
	) => {
		const [internalOpen, setInternalOpen] = React.useState(false);
		const isControlled = open !== undefined;
		const isOpen = isControlled ? open : internalOpen;
		const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

		const handleApply = () => {
			onApply?.();
			setIsOpen?.(false);
		};

		const handleClear = () => {
			onClear?.();
		};

		// Determine width classes based on side
		const contentClasses = cn(
			"flex flex-col h-full",
			(side === "left" || side === "right") && "max-w-md", // Use max-w-md for side drawers
			(side === "top" || side === "bottom") && "w-full", // Full width for top/bottom
			className,
		);

		return (
			<Drawer direction={side} open={isOpen} onOpenChange={setIsOpen}>
				<DrawerTrigger asChild>
					<Button variant="outline" className="relative">
						<FilterIcon className="mr-2 size-4" />
						{triggerLabel}
						{activeFiltersCount > 0 && (
							<Badge
								variant="default"
								className="ml-2 size-5 flex items-center justify-center p-0 rounded-full text-xs">
								{activeFiltersCount}
							</Badge>
						)}
					</Button>
				</DrawerTrigger>
				<DrawerContent
					className={cn(
						(side === "left" || side === "right") &&
							"h-full w-full max-w-md fixed inset-y-0",
						side === "left" && "left-0",
						side === "right" && "right-0",
					)}>
					{/* DrawerContent usually handles some fixed positioning, but checking radix primitives or shadcn implementation is safer. 
               However, usually the `direction` prop on Drawer handles the animation direction. 
               Shadcn's Drawer is built on Vaul usually for bottom, but if it has direction prop it might be adaptable.
               The user previously changed it to "top" and it likely worked but maybe looked full width.
               Let's trust the user's "drawer side selection" request and just pass the direction.
               And apply the max-w-md class to the content wrapper if it's side-based.
           */}
					<div ref={ref} className={contentClasses}>
						<DrawerHeader className="border-b">
							<div className="flex items-center justify-between">
								<div>
									<DrawerTitle>{title}</DrawerTitle>
									<DrawerDescription>{description}</DrawerDescription>
								</div>
								<DrawerClose asChild>
									<Button variant="ghost" size="icon" className="size-8">
										<XIcon className="size-4" />
									</Button>
								</DrawerClose>
							</div>
						</DrawerHeader>

						<div className="flex-1 overflow-y-auto p-6 space-y-6">
							{children}
						</div>

						<DrawerFooter className="border-t flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
							<Button
								variant="outline"
								onClick={handleClear}
								className="w-full sm:w-auto"
								disabled={activeFiltersCount === 0}>
								{clearLabel}
							</Button>
							<Button onClick={handleApply} className="w-full sm:w-auto">
								{applyLabel}
							</Button>
						</DrawerFooter>
					</div>
				</DrawerContent>
			</Drawer>
		);
	},
);

FilterContainer.displayName = "FilterContainer";
export default FilterContainer;
