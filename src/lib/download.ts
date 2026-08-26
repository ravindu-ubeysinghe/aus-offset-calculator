/**
 * Hand a generated text file to the user.
 *
 * Inside an iOS WebView an `<a download>` is inert, so the share sheet is the
 * path that actually works there; everywhere else a blob download is the less
 * intrusive option, so it is the fallback rather than the other way round.
 */
export async function saveTextFile(
  filename: string,
  text: string,
  mime = 'text/csv',
): Promise<void> {
  const file = new File([text], filename, { type: mime });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch {
      // Share sheet dismissed or unavailable — fall through to a download.
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Turn a profile name into a safe, readable filename stem. */
export function slugify(name: string | undefined, fallback: string): string {
  const slug = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}
