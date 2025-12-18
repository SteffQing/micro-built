"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/axios";

interface AccountOfficer {
	id: string;
	name: string;
	email: string;
}

export interface FilterByOfficerProps {
	value?: string[];
	onChange: (value: string[]) => void;
	label?: string;
	placeholder?: string;
	className?: string;
}

export function FilterByOfficer({
	value = [],
	onChange,
	label,
	placeholder,
	className,
}: FilterByOfficerProps) {
	const [open, setOpen] = React.useState(false);
	const [officers, setOfficers] = React.useState<AccountOfficer[]>([]);
	const [loading, setLoading] = React.useState(false);

	React.useEffect(() => {
		const fetchOfficers = async () => {
			setLoading(true);
			try {
				const res = await api.get<ApiRes<AccountOfficer[]>>(
					"/admin/account-officer/",
				);
				setOfficers(res.data.data ?? []);
			} catch (error) {
				console.error(error);
			} finally {
				setLoading(false);
			}
		};
		fetchOfficers();
	}, []);

	const handleSelect = (currentValue: string) => {
		const isSelected = value.includes(currentValue);
		if (isSelected) {
			onChange(value.filter((val) => val !== currentValue));
		} else {
			onChange([...value, currentValue]);
		}
	};

	const selectedOfficers = officers.filter((officer) =>
		value.includes(officer.id),
	);

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{label && <label className="text-sm font-medium">{label}</label>}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between h-auto min-h-10">
						{value.length > 0 ? (
							<div className="flex gap-1 flex-wrap">
								{selectedOfficers.map((officer) => (
									<Badge
										variant="secondary"
										key={officer.id}
										className="mr-1 mb-1">
										{officer.name}
										<div
											className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
											onClick={(e) => {
												e.stopPropagation();
												handleSelect(officer.id);
											}}>
											<X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
										</div>
									</Badge>
								))}
							</div>
						) : (
							<span className="text-muted-foreground">
								{placeholder || "Select officers..."}
							</span>
						)}
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[300px] p-0" align="start">
					<Command>
						<CommandInput placeholder="Search officer..." />
						<CommandList>
							<CommandEmpty>No officer found.</CommandEmpty>
							<CommandGroup>
								{officers.map((officer) => (
									<CommandItem
										key={officer.id}
										value={officer.name}
										onSelect={() => handleSelect(officer.id)}>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												value.includes(officer.id)
													? "opacity-100"
													: "opacity-0",
											)}
										/>
										{officer.name}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
