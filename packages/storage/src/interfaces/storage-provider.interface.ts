export interface IStorageProvider {
  /**
   * Uploads a file buffer to storage.
   * @param key The unique storage key/path.
   * @param buffer The file buffer to upload.
   * @param mimeType The MIME type of the file.
   * @returns The public URL or internal storage URI.
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Downloads a file from storage.
   * @param key The storage key/path.
   * @returns The file buffer.
   */
  download(key: string): Promise<Buffer>;

  /**
   * Deletes a file from storage.
   * @param key The storage key/path.
   */
  delete(key: string): Promise<void>;

  /**
   * Generates a pre-signed URL for direct download or access.
   * @param key The storage key/path.
   * @param expiresIn Expires in seconds.
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
