"use client";

import { useState, type JSX } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RepaymentStatus } from "@/config/enums";
import { getRepaymentInfo } from "@/lib/queries/admin/repayment";
import { RepaymentDetails } from "./details";
import { getUserRepaymentInfo } from "@/lib/queries/user/repayment";
import { ManualResolution } from "./manual-resolution-ui";

type Props = {
	id: string;
	trigger?: JSX.Element;
};

export function AdminRepaymentModal({ id, trigger }: Props) {
	const [isOpen, setisOpen] = useState(false);
	const handleOpen = (val: boolean) => {
		setisOpen(val);
	};

	const { data, isLoading, error } = useQuery({
		...getRepaymentInfo(id),
		enabled: isOpen,
	});

	const repayment = data?.data;

	const handleCloseMainModal = () => {
		handleOpen(false);
	};

	if (isLoading) {
		return (
			<Dialog open={isOpen} onOpenChange={handleOpen}>
				<DialogContent className="sm:max-w-[425px] rounded-lg">
					<DialogHeader>
						<DialogTitle>Loading Repayment Info...</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-gray-500" />
						<p className="mt-4 text-gray-600">Fetching repayment data...</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (error) {
		return (
			<Dialog open={isOpen} onOpenChange={handleOpen}>
				<DialogContent className="sm:max-w-[425px] rounded-lg">
					<DialogHeader>
						<DialogTitle>Error</DialogTitle>
					</DialogHeader>
					<div className="py-4 text-center text-red-600">
						<p>{error.message}</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	const commonProps = {
		repayment: repayment!,
		isOpen,
		onOpenChange: handleCloseMainModal,
	};

	const renderCurrentModal = (
		repayment: SingleRepaymentWithUserDto | null | undefined,
	) => {
		if (!repayment) return null;
		switch (repayment.status) {
			case RepaymentStatus.MANUAL_RESOLUTION:
				return <ManualResolution {...commonProps} />;
			case RepaymentStatus.AWAITING:
			case RepaymentStatus.FULFILLED:
				return <RepaymentDetails {...commonProps} />;
			default:
				return <RepaymentDetails {...commonProps} />;
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				{trigger ? (
					trigger
				) : (
					<Button variant="outline" size="sm" className="text-xs">
						<Eye className="h-3 w-3 mr-1" />
						View
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>{renderCurrentModal(repayment)}</DialogContent>
		</Dialog>
	);
}

export function UserRepaymentModal({ id }: Props) {
	const [isOpen, setisOpen] = useState(false);
	const handleOpen = (val: boolean) => {
		setisOpen(val);
	};
	const { data, isLoading, error } = useQuery({
		...getUserRepaymentInfo(id),
		enabled: isOpen,
	});

	const repayment = data?.data;

	const handleCloseMainModal = () => {
		handleOpen(false);
	};

	if (isLoading) {
		return (
			<Dialog open={isOpen} onOpenChange={handleOpen}>
				<DialogContent className="sm:max-w-[425px] rounded-lg">
					<DialogHeader>
						<DialogTitle>Loading Repayment Details...</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-gray-500" />
						<p className="mt-4 text-gray-600">Fetching repayment data...</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	if (error) {
		return (
			<Dialog open={isOpen} onOpenChange={handleOpen}>
				<DialogContent className="sm:max-w-[425px] rounded-lg">
					<DialogHeader>
						<DialogTitle>Error</DialogTitle>
					</DialogHeader>
					<div className="py-4 text-center text-red-600">
						<p>{error.message}</p>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	const commonProps = {
		repayment: repayment!,
		isOpen: isOpen,
		onOpenChange: handleCloseMainModal,
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="text-xs">
					<Eye className="h-3 w-3 mr-1" />
					View
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<RepaymentDetails {...commonProps} />
			</DialogContent>
		</Dialog>
	);
}
