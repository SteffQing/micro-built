"use client";

import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { CheckCircle, XCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DateRangePicker1 from "@/components/ui/range-calender-1";
// import OriginDateRangePicker from "@/components/origin-date-range-picker";

const isValidEmail = (email: string) => {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const formatDate = (date: Date) => {
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

const submitReportMutation = async ({
	email,
	dateRange,
}: {
	email: string;
	dateRange: DateRange;
}) => {
	await new Promise((resolve) => setTimeout(resolve, 1500));

	if (Math.random() > 0.2) {
		return {
			success: true,
			message: `Report generated for ${email} from ${formatDate(
				dateRange.from!,
			)} to ${formatDate(dateRange.to!)}`,
		};
	} else {
		throw new Error("Failed to generate report. Please try again.");
	}
};

export function RequestRepaymentSchedule() {
	const [selectedDateRange, setSelectedDateRange] = useState<
		DateRange | undefined
	>();
	const [email, setEmail] = useState("");
	const [open, setOpen] = useState(false);
	const [emailError, setEmailError] = useState("");

	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: submitReportMutation,
		onSuccess: (data) => {
			toast.success("Report generated successfully!");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to generate report",
			);
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		setEmailError("");

		if (!email) {
			setEmailError("Email is required");
			return;
		}

		if (!isValidEmail(email)) {
			setEmailError("Please enter a valid email address");
			return;
		}

		if (!selectedDateRange?.from || !selectedDateRange?.to) {
			toast.error("Please select a date range");
			return;
		}

		mutation.mutate({ email, dateRange: selectedDateRange });
	};

	const handleClose = () => {
		setEmail("");
		setSelectedDateRange(undefined);
		setEmailError("");
		mutation.reset();
		setOpen(false);
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen) {
			// Reset everything when opening
			setEmail("");
			setSelectedDateRange(undefined);
			setEmailError("");
			mutation.reset();
		}
		setOpen(newOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button size="sm" className="btn-gradient">
					Repayment Schedule
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl max-h-[80dvh] overflow-y-auto py-3 px-4">
				<DialogHeader>
					<DialogTitle className="">Generate Date Range Report</DialogTitle>
					<DialogDescription className="text-xs text-center">
						Select a date range and enter your email to receive the report
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-2">
						<Label className="text-sm font-medium">Select Date Range</Label>
						<p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
							💡 Tip: Double-click on dates to quickly select a range
						</p>
						<DateRangePicker1
							value={selectedDateRange}
							onChange={setSelectedDateRange}
						/>
						{selectedDateRange?.from && selectedDateRange?.to && (
							<p className="text-sm text-muted-foreground">
								Selected: {formatDate(selectedDateRange.from)} -{" "}
								{formatDate(selectedDateRange.to)}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="email">Email Address</Label>
						<Input
							id="email"
							type="email"
							placeholder="Enter your email address"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={emailError ? "border-red-500" : ""}
						/>
						{emailError && <p className="text-sm text-red-500">{emailError}</p>}
					</div>

					{(mutation.isSuccess || mutation.isError) && (
						<Alert
							variant={mutation.isError ? "destructive" : "default"}
							className={
								mutation.isSuccess
									? "border-green-200 bg-green-50 text-green-800"
									: ""
							}>
							{mutation.isSuccess ? (
								<CheckCircle className="h-4 w-4 text-green-600" />
							) : (
								<XCircle className="h-4 w-4" />
							)}
							<AlertDescription>
								{mutation.isSuccess
									? mutation.data?.message
									: mutation.error?.message}
							</AlertDescription>
						</Alert>
					)}

					{mutation.isSuccess ? (
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="w-full bg-transparent"
							onClick={handleClose}>
							Close
						</Button>
					) : (
						<Button
							type="submit"
							size="sm"
							className="w-full"
							disabled={mutation.isPending}>
							{mutation.isPending ? "Generating Report..." : "Generate Report"}
						</Button>
					)}
				</form>
			</DialogContent>
		</Dialog>
	);
}
