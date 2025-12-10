/**
 * EXAMPLE USAGE: Loans Page Filter Implementation
 *
 * This file demonstrates how to use the Filter System in your pages.
 * Copy and adapt this code to your actual page components.
 */

"use client";

import {
  FilterBuilder,
  useFilters,
  type FilterConfig,
} from "@/components/filters";
import { format } from "date-fns";

// Example: Mock API function for fetching account officers
const mockFetchAccountOfficers = async (searchQuery?: string) => {
  // Replace this with your actual API call
  // Example: return api.users.getAdmins(searchQuery);

  await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay

  const allOfficers = [
    { label: "John Doe", value: "1" },
    { label: "Jane Smith", value: "2" },
    { label: "Bob Johnson", value: "3" },
    { label: "Alice Williams", value: "4" },
  ];

  if (searchQuery) {
    return allOfficers.filter((officer) =>
      officer.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  return allOfficers;
};

// Define the filter configuration for Loans Page
const loanFiltersConfig: FilterConfig[] = [
  {
    key: "status",
    type: "select",
    label: "Loan Status",
    placeholder: "Select status",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Active", value: "DISBURSED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
  {
    key: "principal",
    type: "range",
    label: "Principal Amount",
    min: 0,
    max: 10000000,
    step: 10000,
    format: "currency",
  },
  {
    key: "repaymentRate",
    type: "range",
    label: "Repayment Rate",
    min: 0,
    max: 100,
    step: 1,
    format: "percentage",
  },
  {
    key: "createdAt",
    type: "date",
    label: "Date Created",
    showPresets: true,
  },
  {
    key: "disbursementDate",
    type: "date",
    label: "Disbursement Date",
    showPresets: true,
  },
  {
    key: "repaymentPeriod",
    type: "date",
    label: "Repayment Period",
    showPresets: false,
    // Custom formatter to convert Date -> "MMMM YYYY" string
    valueFormatter: (value) => {
      if (value.start) {
        return format(value.start, "MMMM yyyy").toUpperCase();
      }
      return value;
    },
  },
  {
    key: "requestedById",
    type: "async-select",
    label: "Account Officer",
    placeholder: "Select account officer",
    fetcher: mockFetchAccountOfficers,
    searchable: true,
  },
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
    description: "Show only loans with liquidation requests",
  },
  {
    key: "searchQuery",
    type: "text",
    label: "Search",
    placeholder: "Search by customer name, loan ID...",
    showSearchIcon: true,
  },
];

// Example Page Component
export const LoansPageExample = () => {
  // Initialize the filter hook
  const {
    filters,
    setFilter,
    clearFilters,
    queryDto,
    queryString,
    isFiltered,
  } = useFilters({
    initialState: {},
    onFilterChange: (newFilters) => {
      console.log("Filters changed:", newFilters);
      // You can trigger API calls here or use the queryDto in your useQuery
    },
  });

  // Example: Using queryDto with React Query
  // const { data, isLoading } = useQuery({
  //   queryKey: ['loans', queryDto],
  //   queryFn: () => api.loans.getAll(queryDto),
  // });

  const handleApplyFilters = () => {
    console.log("Applying filters:", queryDto);
    console.log("Query string:", queryString);
    // Trigger your API call or refetch here
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Loans</h1>

        {/* The Filter System */}
        <FilterBuilder
          config={loanFiltersConfig}
          state={filters}
          onChange={setFilter}
          onClear={clearFilters}
          onApply={handleApplyFilters}
          containerTitle="Filter Loans"
          containerDescription="Apply filters to refine your loan results"
          triggerLabel="Filters"
        />
      </div>

      {/* Display active filters */}
      {isFiltered && (
        <div className="mb-4 p-3 bg-muted rounded-md">
          <p className="text-sm font-medium">Active Filters:</p>
          <pre className="text-xs mt-2 overflow-auto">
            {JSON.stringify(queryDto, null, 2)}
          </pre>
        </div>
      )}

      {/* Your table/content here */}
      <div className="border rounded-md p-4">
        <p className="text-muted-foreground">Your loan table goes here...</p>
      </div>
    </div>
  );
};

/**
 * USAGE NOTES:
 *
 * 1. Import the components:
 *    import { FilterBuilder, useFilters } from '@/components/filters';
 *
 * 2. Define your filter configuration array with the fields you need
 *
 * 3. Use the useFilters hook to manage state:
 *    const { filters, setFilter, clearFilters, queryDto } = useFilters();
 *
 * 4. Render the FilterBuilder with your config:
 *    <FilterBuilder
 *      config={yourConfig}
 *      state={filters}
 *      onChange={setFilter}
 *      onClear={clearFilters}
 *    />
 *
 * 5. Use queryDto or queryString in your API calls
 *
 * HANDLING SPECIFIC DOMAIN LOGIC:
 *
 * - Repayment Period: Use the valueFormatter prop to transform Date -> "MMMM YYYY"
 * - Repayment Rate: Use type: 'range' with format: 'percentage', min: 0, max: 100
 * - Account Officer: Use type: 'async-select' with your API fetcher function
 * - The fetcher receives the user's ID but displays their name
 */
