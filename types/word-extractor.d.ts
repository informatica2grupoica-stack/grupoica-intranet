declare module 'word-extractor' {
  interface ExtractedDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(includeFooters?: boolean): string;
    getFooters(): string;
    getAnnotations(): string;
    getTextboxes(includeHeadersAndFooters?: boolean): string;
  }

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<ExtractedDocument>;
  }
}
