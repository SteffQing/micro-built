"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface DetailsProps {
	repayment: SingleRepaymentWithUserDto | SingleUserRepaymentDto;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}
export function ManualResolution({
	repayment,
	isOpen,
	onOpenChange,
}: DetailsProps) {
	console.log(repayment);
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px] rounded-lg">
				<DialogHeader>
					<DialogTitle>Repayment Details</DialogTitle>
				</DialogHeader>

				<Separator className="bg-[#F0F0F0]" />

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm">
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
