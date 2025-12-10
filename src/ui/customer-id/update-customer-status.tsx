"use client";

import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/axios";
import { getUserStatusColor, getUserStatusText } from "@/config/status";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UpdateCustomerStatusProps {
	customerId: string;
	currentStatus: UserStatus;
}

interface UpdateStatusPayload {
	status: UserStatus;
	reason: string;
}

interface UpdateStatusResponse {
	message: string;
	data: null;
}

const USER_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "FLAGGED"];

async function updateCustomerStatus(
	customerId: string,
	payload: UpdateStatusPayload,
): Promise<UpdateStatusResponse> {
	const response = await api.patch<UpdateStatusResponse>(
		`/admin/customer/${customerId}/status`,
		payload,
	);
	return response.data;
}

export function UpdateCustomerStatus({
	customerId,
	currentStatus,
}: UpdateCustomerStatusProps) {
	const [open, setOpen] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<UserStatus | null>(null);
	const [reason, setReason] = useState("");
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (payload: UpdateStatusPayload) =>
			updateCustomerStatus(customerId, payload),
		onSuccess: (data) => {
			toast.success("Status Updated", {
				description: data.message,
			});
			queryClient.invalidateQueries({
				queryKey: ["/admin/customer/", customerId],
			});
			queryClient.invalidateQueries({ queryKey: ["/admin/customer"] });
			setOpen(false);
			setSelectedStatus(null);
			setReason("");
		},
		onError: (
			error: Error & { response?: { data?: { message?: string } } },
		) => {
			toast.error("Failed to update status", {
				description:
					error.response?.data?.message || "An unexpected error occurred",
			});
		},
	});

	const handleStatusSelect = (status: UserStatus) => {
		if (status === currentStatus) return;
		setSelectedStatus(status);
	};

	const handleSubmit = () => {
		if (!selectedStatus) {
			toast.error("Please select a status");
			return;
		}
		if (!reason.trim()) {
			toast.error("Please provide a reason");
			return;
		}
		mutation.mutate({ status: selectedStatus, reason: reason.trim() });
	};

	const handleCancel = () => {
		setSelectedStatus(null);
		setReason("");
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					<Edit2 />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-64" align="end">
				<div className="space-y-3">
					<p className="text-sm font-medium">Update Status</p>

					{/* Status buttons */}
					<div className="flex flex-wrap gap-2">
						{USER_STATUSES.map((status) => (
							<Button
								key={status}
								variant="outline"
								size="sm"
								disabled={status === currentStatus || mutation.isPending}
								onClick={() => handleStatusSelect(status)}
								className={cn(
									"text-xs",
									selectedStatus === status && "ring-2 ring-primary",
									status === currentStatus && "opacity-50 cursor-not-allowed",
									getUserStatusColor(status),
								)}>
								{getUserStatusText(status)}
							</Button>
						))}
					</div>

					{/* Reason input - only show when a status is selected */}
					{selectedStatus && (
						<div className="space-y-2">
							<Label htmlFor="reason" className="text-sm">
								Reason
							</Label>
							<Input
								id="reason"
								placeholder="Enter reason for status change..."
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								disabled={mutation.isPending}
								className="text-sm"
							/>
						</div>
					)}

					{/* Action buttons */}
					{selectedStatus && (
						<div className="flex gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancel}
								disabled={mutation.isPending}
								className="flex-1">
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleSubmit}
								disabled={mutation.isPending || !reason.trim()}
								className="flex-1">
								{mutation.isPending ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Updating...
									</>
								) : (
									"Confirm"
								)}
							</Button>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
