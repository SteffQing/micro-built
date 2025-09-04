"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { liquidationRequest } from "@/lib/mutations/admin/customer";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base } from "@/lib/queries/admin/customer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const liquidationSchema = z.object({
	amount: z.coerce.number().positive("Amount must be a valid positive number"),
});

type LiquidationForm = z.infer<typeof liquidationSchema>;

type Props = {
	userId: string;
	name: string;
	amountOwed: number;
};

export default function LiquidationRequestModal({
	userId,
	name,
	amountOwed,
}: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const queryClient = useQueryClient();

	const { isPending, mutateAsync, isSuccess, isError, error, reset } =
		useMutation({
			...liquidationRequest(userId),
			onSuccess: () => {
				toast.success("Liquidation successful!");
				queryClient.invalidateQueries({
					queryKey: [base, userId, "liquidation-request"],
					exact: false,
				});
			},
		});

	const form = useForm<LiquidationForm>({
		resolver: zodResolver(liquidationSchema),
		defaultValues: {
			amount: 0,
		},
	});

	const handleOpen = (val: boolean) => {
		setIsOpen(val);
		reset();
		if (!val) {
			form.reset();
		}
	};

	async function onSubmit(data: LiquidationForm) {
		await mutateAsync(data);
	}

	return (
		<Dialog open={isOpen} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" className="w-full">
					Liquidate
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-[450px] rounded-lg space-y-3">
				<DialogHeader className="space-y-3">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-red-50 rounded-full">
							<AlertTriangle className="h-5 w-5 text-red-600" />
						</div>
						<DialogTitle className="text-lg font-semibold">
							Liquidate Loan
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground">
						Liquidate loan for{" "}
						<span className="font-medium text-foreground">{name}</span>
					</p>
				</DialogHeader>

				<Separator />

				<Form {...form}>
					<ScrollArea className="max-h-[70vh]">
						<section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
							<div className="bg-slate-50 rounded-lg p-4 space-y-2">
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<span>Total Outstanding</span>
								</div>
								<p className="text-2xl font-bold text-slate-900">
									{formatCurrency(amountOwed)}
								</p>
							</div>

							<FormField
								control={form.control}
								name="amount"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Liquidation Amount
										</FormLabel>
										<FormControl>
											<div className="relative">
												<Input
													type="number"
													step="0.01"
													min="0"
													placeholder="0.00"
													className="text-lg font-medium"
													{...field}
													onChange={(e) => field.onChange(e.target.value)}
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</section>{" "}
					</ScrollArea>
				</Form>
				{isError && (
					<Alert className="border-red-200 bg-red-50">
						<XCircle className="h-4 w-4 text-red-600" />
						<AlertDescription className="text-red-800">
							{error.message}
						</AlertDescription>
					</Alert>
				)}
				{isSuccess && (
					<Alert className="border-green-200 bg-green-50">
						<CheckCircle className="h-4 w-4 text-green-600" />
						<AlertDescription className="text-green-800">
							Liquidation request submitted successfully!
						</AlertDescription>
					</Alert>
				)}
				<DialogFooter>
					{isSuccess ? (
						<Button
							variant="outline"
							onClick={() => handleOpen(false)}
							className="w-full ">
							Close
						</Button>
					) : error ? (
						<>
							<Button
								variant="outline"
								onClick={() => handleOpen(false)}
								className="flex-1">
								Close
							</Button>
							<Button
								onClick={() => reset()}
								className="flex-1 bg-red-600 hover:bg-red-700 text-white">
								Retry
							</Button>
						</>
					) : (
						<div className="grid grid-cols-2 w-full gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpen(false)}
								disabled={isPending}
								className="w-full">
								Cancel
							</Button>
							<Button
								onClick={form.handleSubmit(onSubmit)}
								disabled={isPending}
								className="btn-gradient w-full">
								{isPending ? "Processing..." : "Request Liquidation"}
								{isPending && <Loader2 className="animate-spin w-3 h-3" />}
							</Button>
						</div>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
