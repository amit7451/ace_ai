/**
 * `robots-parser` ships no types and there's no @types package for it.
 * This declares only the surface this codebase actually uses.
 * https://www.npmjs.com/package/robots-parser
 */
declare module 'robots-parser' {
  interface RobotsParser {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    isDisallowed(url: string, userAgent?: string): boolean | undefined;
    getCrawlDelay(userAgent?: string): number | undefined;
    getSitemaps(): string[];
  }

  function robotsParser(url: string, contents: string): RobotsParser;
  export = robotsParser;
}
