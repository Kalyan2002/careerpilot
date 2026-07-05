export interface AtsCompensation {
  min: number;
  max: number;
  currency: string;
}

export interface AtsPosting {
  title: string;
  url: string;
  company: string;
  location: string;
  /** Unix epoch ms, when derivable from the source (omitted otherwise). */
  postedAt?: number;
  salary?: AtsCompensation | null;
}

/** Minimal shape a provider needs to resolve a company's ATS API endpoint. */
export interface AtsEntry {
  name: string;
  careersUrl?: string;
  /** Explicit API URL override (currently only meaningful for greenhouse). */
  api?: string;
}

export interface AtsProvider {
  id: string;
  /** True if this provider recognizes the entry's careers_url/api shape. */
  detect(entry: AtsEntry): boolean;
  fetch(entry: AtsEntry): Promise<AtsPosting[]>;
}
