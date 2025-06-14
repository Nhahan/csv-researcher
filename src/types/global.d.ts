declare module 'iconv-lite' {
  export function decode(buffer: Buffer, encoding: string): string;
  export function encode(str: string, encoding: string): Buffer;
}

declare module 'jschardet' {
  export interface DetectionResult {
    encoding: string | null;
    confidence: number;
  }
  
  export function detect(buffer: Buffer): DetectionResult;
} 