export function resumePdfUrl(resumeId: number, updatedAt: string): string {
  return `/api/resumes/${resumeId}/pdf?v=${new Date(updatedAt).getTime()}`;
}

/** LaTeX/Overleaf export of the resume's structured content (.tex source, not a PDF). */
export function resumeLatexUrl(resumeId: number, updatedAt: string): string {
  return `/api/resumes/${resumeId}/latex?v=${new Date(updatedAt).getTime()}`;
}

export function variantPdfUrl(variantId: number, updatedAt: string): string {
  return `/api/resumes/variants/${variantId}/pdf?v=${new Date(updatedAt).getTime()}`;
}
