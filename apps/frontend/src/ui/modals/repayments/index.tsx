"use client";

import { useState, type JSX } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Icon, icons } from "@/components/icon";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
					<div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
						<Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
						<p className="mt-4 text-muted-foreground">Fetching repayment data...</p>
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
					<div className="px-4 pb-4 text-center break-words text-destructive sm:px-5 sm:pb-5">
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
		switch (repayment.state) {
			case "REVIEWING":
				return <ManualResolution {...commonProps} />;
			case "AWAITING":
			case "SETTLED":
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
						<Icon icon={icons.view} size={12} className="mr-1" />
						View
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-[460px] rounded-lg">
				{renderCurrentModal(repayment)}
			</DialogContent>
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
					<div className="flex flex-col items-center justify-center px-4 pb-8 sm:px-5">
						<Icon icon={icons.loaderCircle} size={32} className="animate-spin text-muted-foreground" />
						<p className="mt-4 text-muted-foreground">Fetching repayment data...</p>
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
					<div className="px-4 pb-4 text-center break-words text-destructive sm:px-5 sm:pb-5">
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
					<Icon icon={icons.view} size={12} className="mr-1" />
					View
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<RepaymentDetails {...commonProps} />
			</DialogContent>
		</Dialog>
	);
}
