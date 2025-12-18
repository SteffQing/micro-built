"use client";

import * as React from "react";
import Container from "./FilterContainer";
import { FilterByOfficer } from "./fields/FilterByOfficer";
import { FilterText } from "./fields/FilterText";
import { FilterSelect, SelectOption } from "./fields/FilterSelect";
import { FilterDate, DateRange } from "./fields/FilterDate";
import { FilterRange, RangeValue } from "./fields/FilterRange";
import { FilterAsync, AsyncOption } from "./fields/FilterAsync";
import { FilterCheck } from "./fields/FilterCheck";
import { FilterMonthYear, MonthYearValue } from "./fields/FilterMonthYear";
import { FilterValue } from "./useFilters";

export type FilterFieldType =
	| "text"
	| "select"
	| "date"
	| "range"
	| "async-select"
	| "checkbox"
	| "month-year"
	| "account-officer";

export interface BaseFilterConfig {
	key: string;
	label?: string;
	type: FilterFieldType;
	placeholder?: string;
	className?: string;
}

export interface TextFilterConfig extends BaseFilterConfig {
	type: "text";
	showSearchIcon?: boolean;
}

export interface SelectFilterConfig extends BaseFilterConfig {
	type: "select";
	options: SelectOption[];
}

export interface DateFilterConfig extends BaseFilterConfig {
	type: "date";
	showPresets?: boolean;
	valueFormatter?: (value: DateRange) => DateRange | string;
}

export interface RangeFilterConfig extends BaseFilterConfig {
	type: "range";
	min?: number;
	max?: number;
	step?: number;
	format?: "currency" | "percentage" | "number";
}

export interface AsyncSelectFilterConfig extends BaseFilterConfig {
	type: "async-select";
	fetcher: (searchQuery?: string) => Promise<AsyncOption[]>;
	searchable?: boolean;
}

export interface CheckboxFilterConfig extends BaseFilterConfig {
	type: "checkbox";
	description?: string;
}

export interface MonthYearFilterConfig extends BaseFilterConfig {
	type: "month-year";
	minYear?: number;
	maxYear?: number;
}

export interface AccountOfficerFilterConfig extends BaseFilterConfig {
	type: "account-officer";
}

export type FilterConfig =
	| TextFilterConfig
	| SelectFilterConfig
	| DateFilterConfig
	| RangeFilterConfig
	| AsyncSelectFilterConfig
	| CheckboxFilterConfig
	| MonthYearFilterConfig
	| AccountOfficerFilterConfig;

export interface FilterBuilderProps {
	config: FilterConfig[];
	state: Record<string, FilterValue>;
	onChange: (key: string, value: FilterValue) => void;
	onClear: () => void;
	onApply?: () => void;
	containerTitle?: string;
	containerDescription?: string;
	triggerLabel?: string;
	className?: string;
	variant?: "drawer" | "popover"; // New prop for container variant
	align?: "start" | "center" | "end"; // For popover alignment
	side?: "top" | "right" | "bottom" | "left"; // For popover side
}

export const FilterBuilder = React.forwardRef<
	HTMLDivElement,
	FilterBuilderProps
>(
	(
		{
			config,
			state,
			onChange,
			onClear,
			onApply,
			containerTitle,
			containerDescription,
			triggerLabel,
			className,
			// variant = "drawer",
			// align,
			side,
		},
		ref,
	) => {
		const activeFiltersCount = React.useMemo(() => {
			return Object.values(state).filter((value) => {
				if (value === null || value === undefined || value === "") return false;
				if (Array.isArray(value) && value.length === 0) return false;
				if (typeof value === "object") {
					if ("start" in value || "end" in value) {
						return value.start !== undefined || value.end !== undefined;
					}
					if ("min" in value || "max" in value) {
						return value.min !== undefined || value.max !== undefined;
					}
					if ("month" in value || "year" in value) {
						return value.month !== undefined || value.year !== undefined;
					}
				}
				return true;
			}).length;
		}, [state]);

		const renderField = (fieldConfig: FilterConfig) => {
			const {
				key,
				type,
				label,
				placeholder,
				className: fieldClassName,
			} = fieldConfig;
			const value = state[key];

			switch (type) {
				case "text": {
					const config = fieldConfig as TextFilterConfig;
					return (
						<FilterText
							key={key}
							label={label}
							value={value as string}
							onChange={(val) => onChange(key, val)}
							placeholder={placeholder}
							className={fieldClassName}
							showSearchIcon={config.showSearchIcon}
						/>
					);
				}

				case "select": {
					const config = fieldConfig as SelectFilterConfig;
					return (
						<FilterSelect
							key={key}
							label={label}
							value={value as string}
							onChange={(val) => onChange(key, val)}
							options={config.options}
							placeholder={placeholder}
							className={fieldClassName}
						/>
					);
				}

				case "date": {
					const config = fieldConfig as DateFilterConfig;
					return (
						<FilterDate
							key={key}
							label={label}
							value={value as DateRange}
							onChange={(val) => {
								// Apply valueFormatter if provided
								const finalValue = config.valueFormatter
									? config.valueFormatter(val)
									: val;
								onChange(key, finalValue);
							}}
							placeholder={placeholder}
							className={fieldClassName}
							showPresets={config.showPresets}
						/>
					);
				}

				case "range": {
					const config = fieldConfig as RangeFilterConfig;
					return (
						<FilterRange
							key={key}
							label={label}
							value={value as RangeValue}
							onChange={(val) => onChange(key, val)}
							min={config.min}
							max={config.max}
							step={config.step}
							format={config.format}
							className={fieldClassName}
						/>
					);
				}

				case "async-select": {
					const config = fieldConfig as AsyncSelectFilterConfig;
					return (
						<FilterAsync
							key={key}
							label={label}
							value={value as string}
							onChange={(val) => onChange(key, val)}
							fetchOptions={config.fetcher}
							placeholder={placeholder}
							className={fieldClassName}
							searchable={config.searchable}
						/>
					);
				}

				case "checkbox": {
					const config = fieldConfig as CheckboxFilterConfig;
					return (
						<FilterCheck
							key={key}
							label={label}
							value={value as boolean}
							onChange={(val) => onChange(key, val)}
							description={config.description}
							className={fieldClassName}
						/>
					);
				}

				case "month-year": {
					const config = fieldConfig as MonthYearFilterConfig;
					return (
						<FilterMonthYear
							key={key}
							label={label}
							value={value as MonthYearValue}
							onChange={(val) => onChange(key, val)}
							placeholder={placeholder}
							className={fieldClassName}
							minYear={config.minYear}
							maxYear={config.maxYear}
						/>
					);
				}

				case "account-officer": {
					return (
						<FilterByOfficer
							key={key}
							label={label}
							value={value as string[]}
							onChange={(val) => onChange(key, val)}
							placeholder={placeholder}
							className={fieldClassName}
						/>
					);
				}

				default:
					return null;
			}
		};

		// Prepare layout classes based on side
		const isVertical = side === "left" || side === "right";
		const layoutClass = isVertical
			? "flex flex-col gap-6"
			: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start";

		return (
			<Container
				ref={ref}
				onApply={onApply}
				onClear={onClear}
				title={containerTitle}
				description={containerDescription}
				triggerLabel={triggerLabel}
				className={className}
				activeFiltersCount={activeFiltersCount}
				side={side}>
				<div className={layoutClass}>{config.map(renderField)}</div>
			</Container>
		);
	},
);

FilterBuilder.displayName = "FilterBuilder";
