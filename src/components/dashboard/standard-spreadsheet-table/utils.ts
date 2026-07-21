export const normalizeCertificates = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
  if (typeof value === 'string') return value.replace(/[\\"[\]]/g, '').split(',').map(v => v.trim()).filter(Boolean);
  return [];
};
