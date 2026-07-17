import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';
import { ContactSource } from '@prisma/client';
import { parseContactString } from '../../utils/vcardParser';
import { calculateDecisionMakerScore } from '../profile-enrichment/enrichment.service';

export class NfcService {
  public async saveNfcData(userId: string, contactId: string | undefined, payload: any) {
    // 1. Parse and normalize payload fields
    const parsed = parseAndNormalizeNfc(payload);

    // 2. Validate payload - requires at least a name, email, or phone
    if (!parsed.name && !parsed.email && !parsed.phone) {
      throw new AppError('Invalid NFC payload: payload must contain at least a name, email, or phone number', 400);
    }

    let finalContactId = contactId;
    const score = calculateDecisionMakerScore(parsed.designation || '');

    if (finalContactId) {
      // Update existing contact's fields and set source to NFC
      await prisma.contact.update({
        where: { id: finalContactId, userId },
        data: {
          ...parsed,
          decisionMakerScore: score,
          source: ContactSource.NFC,
        },
      }).catch(() => {});
    } else {
      // Create new contact from NFC data
      const newContact = await prisma.contact.create({
        data: {
          userId,
          name: parsed.name || 'NFC Contact',
          company: parsed.company || null,
          designation: parsed.designation || null,
          email: parsed.email || null,
          phone: parsed.phone || null,
          website: parsed.website || null,
          address: parsed.address || null,
          decisionMakerScore: score,
          source: ContactSource.NFC,
          aiSummary: {
            create: {
              summaryText: 'Summary generation pending...',
            },
          },
        },
      });
      finalContactId = newContact.id;
    }

    // 3. Create NFCData record
    const nfcRecord = await prisma.nFCData.create({
      data: {
        contactId: finalContactId,
        payload: payload,
      },
    });

    return nfcRecord;
  }

  public async getNfcData(userId: string, nfcId: string) {
    const record = await prisma.nFCData.findUnique({
      where: { id: nfcId },
      include: {
        contact: true,
      },
    });

    if (!record) {
      throw new AppError('NFC data record not found', 404);
    }

    // Verify ownership
    if (record.contact && record.contact.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return record;
  }
}

/**
 * Parses and normalizes multiple NFC record formats (vCard, NDEF structures, and flat JSON).
 */
export function parseAndNormalizeNfc(payload: any): {
  name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  linkedin_url?: string;
} {
  if (!payload) return {};

  // Case 1: Plain string (raw vCard, MeCard, JSON string or plain text)
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    try {
      const parsed = JSON.parse(trimmed);
      return parseAndNormalizeNfc(parsed);
    } catch (_) {
      return parseContactString(trimmed);
    }
  }

  // Case 2: NDEF Records Collection (Android Beam, NFC tag, etc.)
  if (payload.records && Array.isArray(payload.records)) {
    const data: any = {};
    for (const record of payload.records) {
      if (!record.payload) continue;

      let recordPayload = '';
      if (typeof record.payload === 'string') {
        recordPayload = record.payload;
      } else if (Buffer.isBuffer(record.payload)) {
        recordPayload = record.payload.toString('utf-8');
      } else if (Array.isArray(record.payload)) {
        recordPayload = Buffer.from(record.payload).toString('utf-8');
      } else if (record.payload.type === 'Buffer' && Array.isArray(record.payload.data)) {
        recordPayload = Buffer.from(record.payload.data).toString('utf-8');
      } else {
        recordPayload = String(record.payload);
      }

      const recordType = String(record.type || '').toUpperCase();
      if (recordType === 'U' || recordType === 'URI') {
        let cleanUri = recordPayload;
        // Prepend NDEF standard URI prefixes if present
        if (cleanUri.length > 0) {
          const firstCharCode = cleanUri.charCodeAt(0);
          if (firstCharCode < 32) {
            const prefixes = [
              '',
              'http://www.',
              'https://www.',
              'http://',
              'https://',
              'tel:',
              'mailto:',
              'ftp://anonymous:anonymous@',
              'ftp://ftp.',
              'ftps://',
              'sftp://',
              'smb://',
              'nfs://',
              'ftp://',
              'dav://',
              'news:',
              'telnet://',
              'imap:',
              'rtsp://',
              'urn:',
              'pop:',
              'sip:',
              'sips:',
              'tftp:',
              'btspp://',
              'btl2cap://',
              'btgoep://',
              'tcpobex://',
              'irdaobex://',
              'file://',
            ];
            const prefix = prefixes[firstCharCode] || '';
            cleanUri = prefix + cleanUri.substring(1);
          }
        }
        Object.assign(data, parseContactString(cleanUri));
      } else if (recordType === 'T' || recordType === 'TEXT' || record.tnf === 1) {
        let cleanText = recordPayload;
        // Strip language code header from NDEF Text format
        if (cleanText.length > 0) {
          const firstCharCode = cleanText.charCodeAt(0);
          if (firstCharCode < 32) {
            cleanText = cleanText.substring(1 + firstCharCode);
          }
        }
        Object.assign(data, parseContactString(cleanText));
      }
    }
    return data;
  }

  // Case 3: Flat Custom JSON Object
  const normalized: any = {};
  const getValue = (keys: string[]) => {
    for (const key of keys) {
      if (payload[key] !== undefined && payload[key] !== null) {
        return String(payload[key]).trim();
      }
    }
    return undefined;
  };

  normalized.name = getValue(['name', 'fullName', 'fn', 'formattedName']);
  normalized.company = getValue(['company', 'org', 'organization', 'companyName']);
  normalized.designation = getValue(['designation', 'title', 'role', 'jobTitle']);
  normalized.email = getValue(['email', 'mail', 'emailAddress']);
  normalized.phone = getValue(['phone', 'tel', 'phoneNumber', 'mobile']);
  normalized.website = getValue(['website', 'url', 'webAddress']);
  normalized.address = getValue(['address', 'adr', 'location', 'streetAddress']);

  // Clean undefined properties
  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  });

  return normalized;
}
