"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FilterCheckProps {
	label?: string;
	value?: boolean;
	onChange: (value: boolean) => void;
	description?: string;
	className?: string;
}

export const FilterCheck = React.forwardRef<
	HTMLButtonElement,
	FilterCheckProps
>(({ label, value, onChange, description, className }, ref) => {
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{label && <Label className="text-sm font-medium">{label}</Label>}
			<div className="flex items-center space-x-2 h-10">
				<Checkbox
					ref={ref}
					checked={value || false}
					onCheckedChange={(checked) => onChange(checked === true)}
					id={`filter-check-${label}`}
				/>
				{description && (
					<Label
						htmlFor={`filter-check-${label}`}
						className="text-sm font-normal text-muted-foreground cursor-pointer">
						{description}
					</Label>
				)}
			</div>
		</div>
	);
});

FilterCheck.displayName = "FilterCheck";
