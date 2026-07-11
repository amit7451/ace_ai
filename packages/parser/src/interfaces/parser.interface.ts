export interface Document {
  content: string;
  metadata?: Record<string, any>;
}

export interface IParser {
  /**
   * Parses a raw file buffer into a standard Document object.
   * @param buffer The binary file data.
   * @returns The extracted Document text and metadata.
   */
  parse(buffer: Buffer): Promise<Document>;
}
