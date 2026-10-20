export function formatArabicNumber(n: number | string): string {
  return new Intl.NumberFormat('ar-EG').format(Number(n));
}

export function triggerDownload(url: string, filename: string): void {
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch (err) {
    console.error('Download trigger failed', err);
    window.open(url, '_blank');
  }
}

export function triggerTextDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes grade strings to a canonical key ('3ث' | '2ث' | '1ث' | 'بكالوريا')
 */
export function getNormalizedGrade(g: string): '3ث' | '2ث' | '1ث' | 'بكالوريا' {
  if (!g) return '3ث';
  if (g.includes('3') || g.includes('ثالث') || g.includes('الثالث')) return '3ث';
  if (g.includes('2') || g.includes('ثان') || g.includes('الثاني')) return '2ث';
  if (g.includes('1') || g.includes('أول') || g.includes('الأول')) return '1ث';
  if (g.includes('بكالوريا') || g.includes('توجيهي')) return 'بكالوريا';
  return '3ث';
}

/**
 * Returns true if a lesson matches the student's registered grade
 */
export function isMatchingGrade(lessonGrade?: string, studentGrade?: string): boolean {
  if (!studentGrade || studentGrade === 'جميع الصفوف') return true;
  if (!lessonGrade) return true;
  return getNormalizedGrade(lessonGrade) === getNormalizedGrade(studentGrade);
}

/**
 * Detects if a URL is a YouTube video link and returns the embed URL
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11)
    ? `https://www.youtube-nocookie.com/embed/${match[2]}?autoplay=1&rel=0`
    : null;
}

/**
 * Exports data to CSV file with UTF-8 BOM so Arabic names & phones open properly in Microsoft Excel and Google Sheets
 */
export function exportToCsv(headers: string[], rows: (string | number)[][], filename: string): void {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(val => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    )
  ].join('\r\n');

  // \uFEFF is the UTF-8 Byte Order Mark for Microsoft Excel Arabic encoding
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
