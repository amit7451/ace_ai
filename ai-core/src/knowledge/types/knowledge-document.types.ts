export interface RawDocumentInput {
  /** Already-decoded text. Binary formats (PDF, DOCX) are expected to be pre-extracted to text upstream — see README. */
  content: string;
  mimeType?: string;
  fileName?: string;
  /** Passthrough for upstream metadata (e.g. a page number an upstream PDF extractor already knew) — not interpreted by this layer. */
  metadata?: Record<string, unknown>;
}

/** One markdown section: the content directly under a header, up to (not including) the next header of equal-or-higher level. */
export interface MarkdownSection {
  /** Breadcrumb of enclosing header titles, e.g. ['Getting Started', 'Installation']. Empty for content that precedes the first header. */
  headerPath: string[];
  /** 1-6 for an actual header (# through ######), 0 for the headerless intro section. */
  headingLevel: number;
  content: string;
}

export interface CsvRow {
  /** 0-based index among data rows (excludes the header row). */
  index: number;
  /** header -> cell value for this row. */
  record: Record<string, string>;
}

/**
 * Format-specific structural hints a parser can expose so a chunking
 * strategy can use real document structure instead of treating everything
 * as an undifferentiated blob of text.
 */
export interface DocumentStructureHint {
  markdownSections?: MarkdownSection[];
  csvRows?: CsvRow[];
}

export interface ParsedDocument {
  /** Flattened, cleaned plain text — always present, used by format-agnostic strategies (fixed-size, recursive). */
  text: string;
  structure?: DocumentStructureHint;
}
