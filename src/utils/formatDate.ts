const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return isNaN(d.getTime()) ? '' : DATE_FMT.format(d)
}
