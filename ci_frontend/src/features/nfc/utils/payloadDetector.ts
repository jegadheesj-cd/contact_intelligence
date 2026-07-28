export type PayloadType = 'VCARD' | 'URL' | 'TEXT' | 'UNKNOWN';

export interface DetectedPayload {
  type: PayloadType;
  data: string;
  originalPayload: any;
}

export function detectPayloadType(rawPayload: any): DetectedPayload {
  if (!rawPayload) return { type: 'UNKNOWN', data: '', originalPayload: rawPayload };

  // 1. Handle raw string (QR Code or Simulator)
  if (typeof rawPayload === 'string') {
    return parseStringPayload(rawPayload, rawPayload);
  }

  // 2. Handle NDEF records array (Real Web NFC)
  if (rawPayload.records && Array.isArray(rawPayload.records)) {
    // Check for explicit URL record
    const urlRecord = rawPayload.records.find(
      (r: any) => r.type === 'url' || r.recordType === 'url'
    );
    if (urlRecord && urlRecord.payload) {
      let urlStr = urlRecord.payload;
      
      // Handle NDEF URI prefix bytes if they were directly decoded by TextDecoder
      const firstChar = urlStr.charCodeAt(0);
      if (firstChar === 1) urlStr = 'http://www.' + urlStr.slice(1);
      else if (firstChar === 2) urlStr = 'https://www.' + urlStr.slice(1);
      else if (firstChar === 3) urlStr = 'http://' + urlStr.slice(1);
      else if (firstChar === 4) urlStr = 'https://' + urlStr.slice(1);
      
      // Strip any remaining control characters
      urlStr = urlStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

      // Fallback if missing protocol
      if (!/^https?:\/\//i.test(urlStr)) {
         urlStr = 'https://' + urlStr;
      }

      return { type: 'URL', data: urlStr, originalPayload: rawPayload };
    }

    // Iterate through other records to find a recognizable payload
    for (const record of rawPayload.records) {
      if (record.payload && typeof record.payload === 'string') {
        const parsed = parseStringPayload(record.payload, rawPayload);
        if (parsed.type !== 'UNKNOWN') {
          return parsed;
        }
      }
    }
  }

  // Fallback if it's JSON object (like flat JSON tag simulator)
  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload) && !rawPayload.records) {
     return { type: 'TEXT', data: JSON.stringify(rawPayload), originalPayload: rawPayload };
  }

  return { type: 'UNKNOWN', data: '', originalPayload: rawPayload };
}

function parseStringPayload(text: string, originalPayload: any): DetectedPayload {
  const trimmed = text.trim();
  
  if (trimmed.startsWith('BEGIN:VCARD')) {
    return { type: 'VCARD', data: trimmed, originalPayload };
  }

  // Check if it's an exact valid URL
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { type: 'URL', data: trimmed, originalPayload };
    }
  } catch {}

  // Fallback: Extract URL if it's embedded within NDEF text prefixes (e.g. \x02enhttps://...)
  const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    return { type: 'URL', data: urlMatch[1], originalPayload };
  }

  // Check if it's JSON
  try {
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      JSON.parse(trimmed);
      return { type: 'TEXT', data: trimmed, originalPayload };
    }
  } catch {}

  if (trimmed.length > 0) {
    return { type: 'TEXT', data: trimmed, originalPayload };
  }

  return { type: 'UNKNOWN', data: '', originalPayload };
}
