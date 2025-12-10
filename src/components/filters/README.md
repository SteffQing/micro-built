# Filter System Documentation

A modular, schema-driven filter system built with React, TypeScript, and Tailwind CSS.

## 📁 Directory Structure

```
/src/components/filters
  ├── /fields               # Individual input components
  │   ├── FilterText.tsx    # Simple Search Input
  │   ├── FilterSelect.tsx  # Dropdown (Status, Type)
  │   ├── FilterDate.tsx    # Date Range Picker with Presets
  │   ├── FilterRange.tsx   # Dual Slider or Min/Max Inputs
  │   ├── FilterAsync.tsx   # Async Select (fetches on mount/search)
  │   └── FilterCheck.tsx   # Boolean/Checkbox
  ├── FilterContainer.tsx   # Collapsible Drawer wrapper
  ├── FilterBuilder.tsx     # Schema-to-fields mapping engine
  ├── useFilters.ts         # State management hook
  ├── index.ts              # Exports
  ├── example-usage.tsx     # Usage examples
  └── README.md             # This file
```

## 🚀 Quick Start

### 1. Basic Usage

```tsx
import { FilterBuilder, useFilters } from "@/components/filters";

const MyPage = () => {
  const { filters, setFilter, clearFilters, queryDto } = useFilters();

  const config = [
    {
      key: "status",
      type: "select",
      label: "Status",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
      ],
    },
  ];

  return (
    <FilterBuilder
      config={config}
      state={filters}
      onChange={setFilter}
      onClear={clearFilters}
    />
  );
};
```

### 2. With API Integration

```tsx
const { filters, queryDto } = useFilters({
  onFilterChange: (newFilters) => {
    // Triggered after debounce (500ms)
    console.log("Filters changed:", newFilters);
  },
});

// Use with React Query
const { data } = useQuery({
  queryKey: ["items", queryDto],
  queryFn: () => api.items.getAll(queryDto),
});
```

## 🔧 Filter Field Types

### Text Input

```tsx
{
  key: 'search',
  type: 'text',
  label: 'Search',
  placeholder: 'Search...',
  showSearchIcon: true,
}
```

### Select Dropdown

```tsx
{
  key: 'status',
  type: 'select',
  label: 'Status',
  options: [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Active', value: 'ACTIVE' },
  ],
}
```

### Date Range Picker

```tsx
{
  key: 'createdAt',
  type: 'date',
  label: 'Date Created',
  showPresets: true, // Shows Today, Yesterday, Last 7 Days, etc.
}
```

**Date Presets Available:**

- Today
- Yesterday
- Last 7 Days
- This Month
- Last Month
- Last Financial Year

### Range Slider

```tsx
{
  key: 'principal',
  type: 'range',
  label: 'Principal Amount',
  min: 0,
  max: 10000000,
  step: 10000,
  format: 'currency', // 'currency' | 'percentage' | 'number'
}
```

### Async Select

```tsx
{
  key: 'accountOfficer',
  type: 'async-select',
  label: 'Account Officer',
  fetcher: async (searchQuery) => {
    const data = await api.users.getAdmins(searchQuery);
    return data.map(user => ({
      label: user.name,
      value: user.id,
    }));
  },
  searchable: true,
}
```

### Checkbox

```tsx
{
  key: 'isAssetLoan',
  type: 'checkbox',
  label: 'Asset Loan',
  description: 'Filter asset-backed loans',
}
```

## 🎯 Advanced Features

### Custom Value Formatters

Transform filter values before sending to API:

```tsx
{
  key: 'repaymentPeriod',
  type: 'date',
  label: 'Repayment Period',
  valueFormatter: (value) => {
    // Convert Date object to "MMMM YYYY" string
    if (value.start) {
      return format(value.start, 'MMMM yyyy').toUpperCase();
    }
    return value;
  },
}
```

### Debouncing

Text inputs and sliders are automatically debounced (500ms by default):

```tsx
const { filters } = useFilters({
  debounceMs: 1000, // Custom debounce duration
});
```

### Query Serialization

The hook automatically converts filter state to API-ready format:

```tsx
const { queryDto, queryString } = useFilters();

// queryDto example:
{
  status: 'ACTIVE',
  principalMin: 100000,
  principalMax: 500000,
  createdAtStart: '2024-01-01T00:00:00.000Z',
  createdAtEnd: '2024-12-31T23:59:59.999Z',
}

// queryString example:
"?status=ACTIVE&principalMin=100000&principalMax=500000&..."
```

### Active Filter Count

```tsx
const { isFiltered } = useFilters();

// isFiltered is true when any filter has a value
```

## 🎨 Customization

### Custom Container Props

```tsx
<FilterBuilder
  config={config}
  state={filters}
  onChange={setFilter}
  onClear={clearFilters}
  containerTitle="Custom Title"
  containerDescription="Custom description"
  triggerLabel="Apply Filters"
/>
```

### Styling Individual Fields

```tsx
{
  key: 'status',
  type: 'select',
  label: 'Status',
  className: 'col-span-2', // Custom Tailwind classes
  options: [...],
}
```

## 📊 Domain-Specific Examples

### Loan Filters

```tsx
const loanFilters = [
  {
    key: "status",
    type: "select",
    label: "Loan Status",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Disbursed", value: "DISBURSED" },
    ],
  },
  {
    key: "principal",
    type: "range",
    label: "Principal Amount",
    min: 0,
    max: 10000000,
    format: "currency",
  },
  {
    key: "repaymentRate",
    type: "range",
    label: "Repayment Rate",
    min: 0,
    max: 100,
    format: "percentage",
  },
  {
    key: "accountOfficer",
    type: "async-select",
    label: "Account Officer",
    fetcher: api.users.getAdmins,
  },
];
```

## 🔍 Hook API Reference

### `useFilters(options)`

**Options:**

- `initialState?: FilterState` - Initial filter values
- `debounceMs?: number` - Debounce duration (default: 500ms)
- `onFilterChange?: (filters: FilterState) => void` - Callback on filter change

**Returns:**

- `filters: FilterState` - Current filter state (immediate)
- `debouncedFilters: FilterState` - Debounced filter state
- `setFilter: (key: string, value: FilterValue) => void` - Update single filter
- `clearFilters: () => void` - Reset all filters
- `isFiltered: boolean` - Whether any filters are active
- `queryDto: Record<string, any>` - API-ready query object
- `queryString: string` - URL query string

## 🎯 Best Practices

1. **Define configs outside components** to prevent re-renders
2. **Use queryDto with React Query** for automatic refetching
3. **Leverage valueFormatter** for domain-specific transformations
4. **Use async-select** for large datasets (users, customers, etc.)
5. **Enable presets** for date filters to improve UX

## 🐛 Troubleshooting

### Filters not updating

- Check that you're passing `state={filters}` to FilterBuilder
- Ensure `onChange={setFilter}` is correctly wired

### Debounce not working

- Text and range inputs are debounced by default
- Select, date, and checkbox changes are immediate

### Async select not loading

- Verify your fetcher function returns `Promise<{label: string, value: string}[]>`
- Check browser console for errors

## 📝 TypeScript Support

All components are fully typed. Import types as needed:

```tsx
import type {
  FilterConfig,
  FilterState,
  DateRange,
  RangeValue,
} from "@/components/filters";
```

## 🤝 Contributing

To add a new filter type:

1. Create component in `/fields/FilterYourType.tsx`
2. Add type to `FilterFieldType` in `FilterBuilder.tsx`
3. Create config interface extending `BaseFilterConfig`
4. Add case in `renderField()` method
5. Export from `index.ts`

---

**Built with:** React 19, TypeScript, Tailwind CSS, Radix UI, date-fns
