/**
 * Parses raw vCard string payloads into structured contact objects.
 * Handles base fields (FN, N, ORG, TITLE, EMAIL, TEL, URL, ADR) and parameters.
 */
import { generateTextWithFallback } from './aiClient';

export function parseVCard(vcard: string): {
  name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
} {
  const data: any = {};
  const lines = vcard.split(/\r?\n/);
  
  for (const line of lines) {
    const lineClean = line.trim();
    if (!lineClean) continue;
    
    const colonIndex = lineClean.indexOf(':');
    if (colonIndex === -1) continue;
    
    const fieldPart = lineClean.substring(0, colonIndex).toUpperCase();
    const value = lineClean.substring(colonIndex + 1).trim();
    
    // Split key from parameters, e.g., TEL;TYPE=CELL -> TEL
    const baseField = fieldPart.split(';')[0];
    
    switch (baseField) {
      case 'FN':
        data.name = value;
        break;
      case 'N':
        if (!data.name) {
          const parts = value.split(';').map((p) => p.trim()).filter(Boolean);
          const family = parts[0] || '';
          const given = parts[1] || '';
          data.name = `${given} ${family}`.trim();
        }
        break;
      case 'ORG':
        data.company = value.split(';')[0].trim();
        break;
      case 'TITLE':
      case 'ROLE':
        data.designation = value;
        break;
      case 'EMAIL':
        data.email = value;
        break;
      case 'TEL':
        data.phone = value;
        break;
      case 'URL':
        data.website = value;
        break;
      case 'ADR':
        data.address = value
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean)
          .join(', ')
          .trim();
        break;
    }
  }
  
  
  return data;
}

/**
 * Parses raw MeCard string payloads into structured contact objects.
 */
export function parseMeCard(mecard: string): {
  name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
} {
  const data: any = {};
  let content = mecard.replace(/^MECARD:/i, '');
  if (content.endsWith(';;')) content = content.slice(0, -2);
  else if (content.endsWith(';')) content = content.slice(0, -1);

  const parts = content.split(/(?<!\\);/);
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    const key = part.substring(0, colonIndex).toUpperCase();
    const val = part.substring(colonIndex + 1).trim().replace(/\\;/g, ';').replace(/\\:/g, ':');

    switch (key) {
      case 'N': {
        if (val.includes(',')) {
          const sub = val.split(',');
          data.name = `${sub[1] || ''} ${sub[0] || ''}`.trim();
        } else {
          data.name = val;
        }
        break;
      }
      case 'TEL':
        data.phone = val;
        break;
      case 'EMAIL':
        data.email = val;
        break;
      case 'URL':
        data.website = val;
        break;
      case 'ADR':
        data.address = val.replace(/,/g, ', ').trim();
        break;
      case 'ORG':
        data.company = val;
        break;
      case 'TIL':
      case 'TITLE':
        data.designation = val;
        break;
    }
  }
  return data;
}

/**
 * Parses email MATMSG payloads.
 */
export function parseMatMsg(payload: string): { email?: string } {
  let content = payload.replace(/^MATMSG:/i, '');
  if (content.endsWith(';;')) content = content.slice(0, -2);
  else if (content.endsWith(';')) content = content.slice(0, -1);

  const parts = content.split(/(?<!\\);/);
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    const key = part.substring(0, colonIndex).toUpperCase();
    const val = part.substring(colonIndex + 1).trim();
    if (key === 'TO') {
      return { email: val };
    }
  }
  return {};
}

/**
 * Extracts phone from WhatsApp URLs.
 */
export function parseWhatsAppUrl(url: string): { phone?: string; website?: string } {
  const clean = url.trim();
  const phoneMatch = clean.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)(\+?[0-9\s\-()]+)/i);
  if (phoneMatch && phoneMatch[1]) {
    const phone = decodeURIComponent(phoneMatch[1]).replace(/[\s\-()]/g, '');
    return { phone, website: clean };
  }
  return { website: clean };
}

/**
 * Unified contact parser wrapper for vCard, MeCard, WhatsApp, MATMSG, mailto, URL, email, and plain text.
 */
export async function parseContactString(payload: string): Promise<{
  name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  linkedin_url?: string;
}> {
  const trimmed = payload.trim();
  if (trimmed.toUpperCase().includes('BEGIN:VCARD')) {
    return parseVCard(trimmed);
  }
  if (trimmed.toUpperCase().startsWith('MECARD:')) {
    return parseMeCard(trimmed);
  }
  if (trimmed.toUpperCase().startsWith('MATMSG:')) {
    return parseMatMsg(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    return { email: trimmed.substring(7).trim() };
  }
  if (trimmed.toLowerCase().includes('wa.me') || trimmed.toLowerCase().includes('whatsapp.com')) {
    return parseWhatsAppUrl(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('http') || trimmed.toLowerCase().includes('linkedin.com/in/')) {
    const url = trimmed.toLowerCase().startsWith('http') ? trimmed : `https://${trimmed}`;
    if (trimmed.toLowerCase().includes('linkedin.com/in/')) {
      return { linkedin_url: url, website: url };
    }
    return { website: url };
  }
  if (trimmed.includes('@') && !trimmed.includes(' ')) {
    return { email: trimmed };
  }
  
  try {
    const prompt = `You are a contact data extractor. The following text was scanned from a QR code.
Extract the person's name, company, designation, email, phone, website, address, and linkedin_url if present.
Text:
${trimmed}

Respond strictly in JSON format matching this structure:
{
  "name": "",
  "company": "",
  "designation": "",
  "email": "",
  "phone": "",
  "website": "",
  "address": "",
  "linkedin_url": ""
}
Only output valid JSON without markdown wrapping. Leave fields empty string if not found.`;

    const response = await generateTextWithFallback(prompt, 'gemini-1.5-flash', 'QR Text Parsing');
    const jsonStr = response.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    const result: any = {};
    if (parsed.name) result.name = parsed.name;
    if (parsed.company) result.company = parsed.company;
    if (parsed.designation) result.designation = parsed.designation;
    if (parsed.email) result.email = parsed.email;
    if (parsed.phone) result.phone = parsed.phone;
    if (parsed.website) result.website = parsed.website;
    if (parsed.address) result.address = parsed.address;
    if (parsed.linkedin_url) result.linkedin_url = parsed.linkedin_url;
    
    return Object.keys(result).length > 0 ? result : { name: trimmed };
  } catch (err) {
    return { name: trimmed };
  }
}
