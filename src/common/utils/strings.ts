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

export { enumToHumanReadable, formatDateToReadable };
