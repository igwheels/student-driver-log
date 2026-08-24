/**
 * Builds a download filename that is safe everywhere it might end up.
 *
 * Names are free text, so they carry apostrophes, accents and spaces —
 * D'Angelo, Muñoz, van der Berg. Those survive a local download but can be
 * rejected or mangled by DMV upload portals, email attachments and Windows
 * filesystems, which is exactly where these files are headed.
 */
export function downloadFileName(parts, extension) {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents, keep the base letter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'student'}.${extension}`;
}
