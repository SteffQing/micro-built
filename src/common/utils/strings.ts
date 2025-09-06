function enumToHumanReadable(str: string) {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateToReadable(dateInput: string | Date) {
  const date = new Date(dateInput);
  const options = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  return date.toLocaleDateString('en-GB', options).replace(/ /, ', ');
}

const formatCurrency = (value: number | string | undefined | null) => {
  const amount = value
    ? typeof value === 'string'
      ? Number(value)
      : value
    : 0;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export { enumToHumanReadable, formatDateToReadable, formatCurrency };
