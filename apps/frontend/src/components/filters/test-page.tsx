/**
 * FILTER SYSTEM TEST PAGE
 *
 * This is a standalone demo page to test the filter system.
 * You can navigate to this page to see all filter types in action.
 */

"use client";

import {
  FilterBuilder,
  useFilters,
  type FilterConfig,
} from "@/components/filters";

import { queryOptions } from "@tanstack/react-query";

// Mock Query Options for async select
const mockUsersQuery = queryOptions({
  queryKey: ["mock-users"],
  queryFn: async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      { label: "John Doe", value: "1" },
      { label: "Jane Smith", value: "2" },
      { label: "Bob Johnson", value: "3" },
      { label: "Alice Williams", value: "4" },
      { label: "Charlie Brown", value: "5" },
      { label: "Diana Prince", value: "6" },
    ];
  },
});

// Comprehensive filter configuration showcasing all field types
const testFiltersConfig: FilterConfig[] = [
  // Text Input
  {
    key: "searchQuery",
    type: "text",
    label: "Search",
    placeholder: "Search by name, ID, etc...",
    showSearchIcon: true,
  },

  // Select Dropdown
  {
    key: "status",
    type: "select",
    label: "Status",
    placeholder: "Select status",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Active", value: "ACTIVE" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },

  // Another Select
  {
    key: "type",
    type: "select",
    label: "Type",
    placeholder: "Select type",
    options: [
      { label: "Personal", value: "PERSONAL" },
      { label: "Business", value: "BUSINESS" },
      { label: "Asset", value: "ASSET" },
    ],
  },

  // Date Range with Presets
  {
    key: "createdAt",
    type: "date",
    label: "Date Created",
    showPresets: true,
  },

  // Date Range with Presets (UPDATED)
  {
    key: "disbursementDate",
    type: "date",
    label: "Disbursement Date",
    showPresets: true, // Now has presets!
  },

  // Month/Year Picker (UPDATED - Replaces date with custom formatter)
  {
    key: "repaymentPeriod",
    type: "month-year",
    label: "Repayment Period",
    minYear: 2024,
    // maxYear defaults to current year
  },

  // Range Slider - Currency
  {
    key: "principal",
    type: "range",
    label: "Principal Amount",
    min: 0,
    max: 10000000,
    step: 100000,
    format: "currency",
  },

  // Range Slider - Percentage
  {
    key: "repaymentRate",
    type: "range",
    label: "Repayment Rate",
    min: 0,
    max: 100,
    step: 5,
    format: "percentage",
  },

  // Range Slider - Number
  {
    key: "duration",
    type: "range",
    label: "Duration (Months)",
    min: 1,
    max: 60,
    step: 1,
    format: "number",
  },

  // Async Select
  {
    key: "accountOfficer",
    type: "async-select",
    label: "Account Officer",
    placeholder: "Select account officer",
    query: mockUsersQuery,
    labelKey: "label",
    valueKey: "value",
    searchable: true,
  },

  // Checkboxes
  {
    key: "isAssetLoan",
    type: "checkbox",
    label: "Asset/Commodity Loan",
    description: "Filter loans that are asset or commodity-backed",
  },
  {
    key: "hasLiquidationRequest",
    type: "checkbox",
    label: "Has Liquidation Request",
    description: "Show only items with liquidation requests",
  },
  {
    key: "isActive",
    type: "checkbox",
    label: "Active Only",
  },
];

export default function FilterTestPage() {
  const {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    qDto,
    qString,
    isFiltered,
  } = useFilters({
    initialState: {},
    debounceMs: 500,
    onFilterChange: (newFilters) => {
      console.log("🔄 Filters changed (debounced):", newFilters);
    },
  });

  const handleApplyFilters = () => {
    console.log("✅ Apply Filters clicked");
    console.log("Query DTO:", qDto);
    console.log("Query String:", qString);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between relative">
          <div>
            <h1 className="text-3xl font-bold">Filter System Test Page</h1>
            <p className="text-muted-foreground mt-2">
              Test all filter field types and configurations
            </p>
          </div>

          {/* Filter Buttons - Both Variants */}
          <div className="flex gap-3">
            {/* Popover Variant (Dropdown Below) */}
            <FilterBuilder
              config={testFiltersConfig}
              state={filters}
              onChange={setFilter}
              onClear={clearFilters}
              onApply={handleApplyFilters}
              containerTitle="Filters (Popover)"
              containerDescription="Dropdown below variant"
              triggerLabel="Popover Filters"
              variant="popover"
              side="bottom"
              align="end"
            />

            {/* Drawer Variant (Sidebar) */}
            <FilterBuilder
              config={testFiltersConfig}
              state={filters}
              onChange={setFilter}
              onClear={clearFilters}
              onApply={handleApplyFilters}
              containerTitle="Filters (Drawer)"
              containerDescription="Sidebar variant"
              triggerLabel="Drawer Filters"
              variant="drawer"
            />
          </div>
        </div>

        {/* Current State Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Immediate State */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Immediate State</h2>
              <span className="text-xs text-muted-foreground">
                Updates instantly
              </span>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(filters, null, 2)}
            </pre>
          </div>

          {/* Debounced State */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Debounced State</h2>
              <span className="text-xs text-muted-foreground">
                Updates after 500ms
              </span>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(debouncedFilters, null, 2)}
            </pre>
          </div>
        </div>

        {/* Query DTO */}
        <div className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Query DTO (API Ready)</h2>
            <span
              className={`text-xs px-2 py-1 rounded ${
                isFiltered
                  ? "bg-green-500/10 text-green-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isFiltered ? "Filters Active" : "No Filters"}
            </span>
          </div>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">
            {JSON.stringify(qDto, null, 2)}
          </pre>
        </div>

        {/* Query String */}
        <div className="border rounded-lg p-4 space-y-2">
          <h2 className="text-lg font-semibold">Query String</h2>
          <div className="text-xs bg-muted p-3 rounded overflow-auto font-mono">
            {qString || "(empty)"}
          </div>
        </div>

        {/* Instructions */}
        <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            📋 Testing Instructions
          </h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">1.</span>
              <span>
                Try both filter variants:{" "}
                <strong>Popover (dropdown below)</strong> and{" "}
                <strong>Drawer (sidebar)</strong>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">2.</span>
              <span>Test each filter type and observe the state updates</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">3.</span>
              <span>
                Notice the debounce delay on text inputs and range sliders
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">4.</span>
              <span>
                Test the date presets on both Date Created and Disbursement Date
                (Today, Yesterday, Last 7 Days, etc.)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">5.</span>
              <span>
                Try the new <strong>Month/Year picker</strong> for Repayment
                Period (months limited to current month for current year)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">6.</span>
              <span>Try the async select and search functionality</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">7.</span>
              <span>Check the browser console for filter change logs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">8.</span>
              <span>
                Click &quot;Apply Filters&quot; to see the final query DTO in
                console
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">9.</span>
              <span>Use &quot;Clear All&quot; to reset all filters</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
