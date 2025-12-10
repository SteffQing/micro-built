# Filter System - Quick Reference

## 🎯 Usage

```tsx
<FilterBuilder
  config={yourConfig}
  state={filters}
  onChange={setFilter}
  onClear={clearFilters}
  // Optional customizations
  containerTitle="Filters"
  triggerLabel="Filters"
/>
```

---

## 📝 Field Types Quick Reference

### Text Search

```tsx
{ key: 'search', type: 'text', label: 'Search', showSearchIcon: true }
```

### Dropdown Select

```tsx
{
  key: 'status',
  type: 'select',
  label: 'Status',
  options: [{ label: 'Active', value: 'ACTIVE' }]
}
```

### Date Range (with presets)

```tsx
{ key: 'createdAt', type: 'date', label: 'Date Created', showPresets: true }
```

### Month/Year Picker

```tsx
{ key: 'period', type: 'month-year', label: 'Period', minYear: 2024 }
```

**Output:** `"MAY 2025"`

### Range Slider

```tsx
{
  key: 'amount',
  type: 'range',
  label: 'Amount',
  min: 0,
  max: 1000000,
  format: 'currency' // or 'percentage' or 'number'
}
```

### Async Select

```tsx
{
  key: 'officer',
  type: 'async-select',
  label: 'Officer',
  fetcher: api.users.getAll,
  searchable: true
}
```

### Checkbox

```tsx
{
  key: 'isActive',
  type: 'checkbox',
  label: 'Active Only',
  description: 'Show only active items'
}
```

---

## 🔌 Hook Usage

```tsx
const {
  filters, // Immediate state
  debouncedFilters, // Debounced state (500ms)
  setFilter, // Update single filter
  clearFilters, // Reset all
  isFiltered, // Boolean - any active?
  queryDto, // API-ready object
  queryString, // URL query string
} = useFilters({
  initialState: {},
  debounceMs: 500,
  onFilterChange: (filters) => console.log(filters),
});
```

---

## 📤 Query Output Examples

### Date Range

**Input:** `{ createdAt: { start: Date, end: Date } }`  
 **Output:** `{ createdAtStart: "2024-01-01T00:00:00.000Z", createdAtEnd: "2024-12-31T23:59:59.999Z" }`

### Range

**Input:** `{ principal: { min: 100000, max: 500000 } }`  
 **Output:** `{ principalMin: 100000, principalMax: 500000 }`

### Month/Year

**Input:** `{ period: { month: 4, year: 2025 } }`  
 **Output:** `{ period: "MAY 2025" }`

---

## 🎨 Customization

### Container Props

```tsx
<FilterBuilder
  containerTitle="Custom Title"
  containerDescription="Custom description"
  triggerLabel="Custom Button Text"
  className="custom-class"
/>
```

---

## 📁 Import Paths

```tsx
// Main components
import { FilterBuilder, useFilters } from "@/components/filters";

// Individual fields (if needed)
import { FilterText, FilterDate, FilterMonthYear } from "@/components/filters";

// Types
import type { FilterConfig, FilterState } from "@/components/filters";
```

---

## 🚀 Complete Example

```tsx
import { FilterBuilder, useFilters, type FilterConfig } from '@/components/filters';

const config: FilterConfig[] = [
  { key: 'search', type: 'text', label: 'Search' },
  { key: 'status', type: 'select', label: 'Status', options: [...] },
  { key: 'date', type: 'date', label: 'Date', showPresets: true },
  { key: 'period', type: 'month-year', label: 'Period', minYear: 2024 },
];

export function MyPage() {
  const { filters, setFilter, clearFilters, queryDto } = useFilters();

  return (
    <FilterBuilder
      config={config}
      state={filters}
      onChange={setFilter}
      onClear={clearFilters}
    />
  );
}
```

---

## 📚 Documentation Files

- **README.md** - Full documentation
- **IMPLEMENTATION.md** - Implementation details
- **UPDATES.md** - Latest changes
- **example-usage.tsx** - Real-world examples
- **test-page.tsx** - Interactive demo

---

**Need help?** Check the test page at `/test` to see all features in action!
