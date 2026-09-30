"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

interface DateRangePickerProps {
	value?: DateRange;
	onChange?: (range: DateRange | undefined) => void;
}

export default function DateRangePicker1({
	value,
	onChange,
}: DateRangePickerProps) {
	const today = new Date();

	const getYesterday = () => {
		const date = new Date(today);
		date.setDate(date.getDate() - 1);
		return date;
	};

	const getDaysAgo = (days: number) => {
		const date = new Date(today);
		date.setDate(date.getDate() - days);
		return date;
	};

	const getStartOfMonth = () => {
		return new Date(today.getFullYear(), today.getMonth(), 1);
	};

	const getLastMonth = () => {
		const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
		const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
		return { from: lastMonth, to: endOfLastMonth };
	};

	const getStartOfYear = () => {
		return new Date(today.getFullYear(), 0, 1);
	};

	const yesterday = {
		from: getYesterday(),
		to: getYesterday(),
	};
	const last7Days = {
		from: getDaysAgo(6),
		to: today,
	};
	const last30Days = {
		from: getDaysAgo(29),
		to: today,
	};
	const monthToDate = {
		from: getStartOfMonth(),
		to: today,
	};
	const lastMonth = getLastMonth();
	const yearToDate = {
		from: getStartOfYear(),
		to: today,
	};

	const [month, setMonth] = useState(today);
	const [date, setDate] = useState<DateRange | undefined>(value || last7Days);

	const handleDateChange = (newDate: DateRange | undefined) => {
		setDate(newDate);
		onChange?.(newDate);
	};

	const handlePresetClick = (preset: DateRange) => {
		setDate(preset);
		setMonth(preset.to || today);
		onChange?.(preset);
	};

	return (
		<div>
			<div className="rounded-md border">
				<div className="flex max-sm:flex-col">
					<div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-32">
						<div className="h-full sm:border-e">
							<div className="flex flex-col px-2">
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() =>
										handlePresetClick({
											from: today,
											to: today,
										})
									}>
									Today
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(yesterday)}>
									Yesterday
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(last7Days)}>
									Last 7 days
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(last30Days)}>
									Last 30 days
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(monthToDate)}>
									Month to date
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(lastMonth)}>
									Last month
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-start"
									onClick={() => handlePresetClick(yearToDate)}>
									Year to date
								</Button>
							</div>
						</div>
					</div>
					<Calendar
						mode="range"
						selected={date}
						onSelect={handleDateChange}
						month={month}
						onMonthChange={setMonth}
						className="p-2"
						disabled={[{ after: today }]}
					/>
				</div>
			</div>
		</div>
	);
}
