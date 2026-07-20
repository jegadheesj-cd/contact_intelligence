import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger';

export interface StructuredContact {
  name: string;
  company: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  office: string | null;
  website: string | null;
  address: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  twitter_url: string | null;
}

export interface ContactUnderstandingField {
  field: string;
  value: string;
  confidence: number;
  source: string;
  reasoning: string;
}

export interface ValidationResult {
  fields: StructuredContact;
  understanding: ContactUnderstandingField[];
  needsManualReview: boolean;
}

// Heuristic regex helpers
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const WEBSITE_REGEX = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/;
const LINKEDIN_REGEX = /linkedin\.com\/(in|company)\/[a-zA-Z0-9_-]+/i;
const POSTAL_CODE_REGEX = /\b\d{5,6}\b/;

/**
 * Perform basic local regex checks and normalization on individual fields.
 */
export function cleanAndValidateField(field: string, value: string): { isValid: boolean; cleaned: string } {
  const trimmed = value.trim();
  if (!trimmed) return { isValid: false, cleaned: '' };

  switch (field) {
    case 'email':
      // Basic email validation
      const emailValid = EMAIL_REGEX.test(trimmed);
      return { isValid: emailValid, cleaned: emailValid ? trimmed.toLowerCase() : '' };

    case 'phone':
    case 'mobile':
    case 'office':
      // Clean phone number: remove spaces, hyphens, brackets, keep digits and '+'
      const digitsOnly = trimmed.replace(/\D/g, '');
      const hasPlus = trimmed.startsWith('+');
      const cleanedPhone = (hasPlus ? '+' : '') + digitsOnly;
      
      // Reject short numbers (like 641028) that are likely pincodes/postal codes
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return { isValid: false, cleaned: '' };
      }
      return { isValid: true, cleaned: cleanedPhone };

    case 'website':
      // Check website matches regex and does not contain @
      if (trimmed.includes('@')) {
        return { isValid: false, cleaned: '' };
      }
      const isWeb = WEBSITE_REGEX.test(trimmed);
      return { isValid: isWeb, cleaned: trimmed };

    case 'linkedin_url':
      const isLinkedin = LINKEDIN_REGEX.test(trimmed);
      return { isValid: isLinkedin, cleaned: trimmed };

    default:
      return { isValid: true, cleaned: trimmed };
  }
}

/**
 * Runs rule-based cross validation on structured fields.
 */
export function crossValidateFields(fields: Partial<StructuredContact>): StructuredContact {
  const result: StructuredContact = {
    name: fields.name || 'Unknown Contact',
    company: fields.company || null,
    designation: fields.designation || null,
    email: fields.email || null,
    phone: fields.phone || null,
    mobile: fields.mobile || null,
    office: fields.office || null,
    website: fields.website || null,
    address: fields.address || null,
    street: fields.street || null,
    city: fields.city || null,
    state: fields.state || null,
    postalCode: fields.postalCode || null,
    country: fields.country || null,
    linkedin_url: fields.linkedin_url || null,
    github_url: fields.github_url || null,
    twitter_url: fields.twitter_url || null,
  };

  // Swapping misclassified email/website first
  const emailVal = result.email || '';
  const webVal = result.website || '';
  const emailHasAt = emailVal.includes('@');
  const webHasAt = webVal.includes('@');

  if (!emailHasAt && webHasAt) {
    result.email = webVal;
    result.website = emailVal || null;
  } else if (emailHasAt && !webHasAt && WEBSITE_REGEX.test(emailVal) && !WEBSITE_REGEX.test(webVal)) {
    // If email is actually a website and website is an email, swap
    result.email = webVal;
    result.website = emailVal;
  }

  // Cross validate website vs email (single field cleanups)
  if (result.website && result.website.includes('@')) {
    if (!result.email) {
      result.email = result.website;
    }
    result.website = null;
  }

  if (result.email && !result.email.includes('@')) {
    if (WEBSITE_REGEX.test(result.email)) {
      if (!result.website) {
        result.website = result.email;
      }
    }
    result.email = null;
  }

  // Validate and clean phone/mobile/office fields
  if (result.phone) {
    const val = cleanAndValidateField('phone', result.phone);
    if (!val.isValid) {
      // Check if it looks like a postal code/pincode
      const digitsOnly = result.phone.replace(/\D/g, '');
      if (digitsOnly.length === 6 && !result.postalCode) {
        result.postalCode = digitsOnly;
      }
      result.phone = null;
    } else {
      result.phone = val.cleaned;
    }
  }

  if (result.mobile) {
    const val = cleanAndValidateField('mobile', result.mobile);
    result.mobile = val.isValid ? val.cleaned : null;
  }

  if (result.office) {
    const val = cleanAndValidateField('office', result.office);
    result.office = val.isValid ? val.cleaned : null;
  }

  // If phone is valid and we have no mobile, set mobile
  if (result.phone && !result.mobile) {
    result.mobile = result.phone;
  }

  // Validate website
  if (result.website) {
    const val = cleanAndValidateField('website', result.website);
    result.website = val.isValid ? val.cleaned : null;
  }

  // Validate email
  if (result.email) {
    const val = cleanAndValidateField('email', result.email);
    result.email = val.isValid ? val.cleaned : null;
  }

  // Validate LinkedIn
  if (result.linkedin_url) {
    const val = cleanAndValidateField('linkedin_url', result.linkedin_url);
    result.linkedin_url = val.isValid ? val.cleaned : null;
  }

  // Address components heuristics if not already split
  if (result.address && (!result.street || !result.city || !result.postalCode)) {
    const parts = result.address.split(',').map(p => p.trim()).filter(Boolean);
    
    let country: string | null = null;
    let postalCode: string | null = null;
    
    // Find postal code
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (POSTAL_CODE_REGEX.test(part)) {
        postalCode = part.match(POSTAL_CODE_REGEX)?.[0] || null;
        parts.splice(i, 1);
        i--;
      }
    }
    
    // Check if last part is country
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (/\b(usa|uk|india|canada|germany|france|australia|united states|united kingdom|singapore|china|japan)\b/i.test(lastPart) || lastPart.length === 3 || lastPart.length === 2) {
        country = lastPart;
        parts.pop();
      }
    }
    
    // Split remaining parts
    if (parts.length >= 3) {
      result.street = parts.slice(0, parts.length - 1).join(', ');
      result.city = parts[parts.length - 1];
    } else if (parts.length === 2) {
      result.street = parts[0];
      result.city = parts[1];
    } else if (parts.length === 1) {
      result.street = parts[0];
    }
    
    if (postalCode) result.postalCode = postalCode;
    if (country) result.country = country;
  }

  return result;
}

/**
 * Main validation engine function. Integrates rules-based matching with Gemini correction.
 */


/**
 * Main validation engine function. Integrates rules-based matching with Gemini correction.
 */
export async function validateAndCorrectContact(
  rawOcrText: string,
  initialFields: Partial<StructuredContact>
): Promise<ValidationResult> {
  // 1. Run local rules-based cross validation first
  const baseFields = crossValidateFields(initialFields);
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('[Validation Engine] API Key missing, returning local heuristic results.');
    return buildFallbackResult(baseFields);
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `You are a strict Contact Understanding Agent.
Your ONLY responsibility is to extract, classify, and validate information that EXACTLY exists in the provided raw OCR text.

DO NOT hallucinate. DO NOT perform web searches. DO NOT invent values. DO NOT format values in a way that wasn't on the card unless standardizing phone numbers or emails.

Raw OCR Text:
"""
${rawOcrText}
"""

Heuristic Initial Parsed Fields (For reference, these may contain errors like Swaps):
${JSON.stringify(baseFields, null, 2)}

Instructions:
1. Classify text into: Name, Company, Designation, Department, Email, Website, Phone, Mobile, Office, Address, City, State, Country, Postal Code, LinkedIn URL.
2. Resolve ambiguity and detect swaps (e.g. Name vs Company, Phone vs Postal Code, Designation vs Company).
3. If you are unsure, assign a low confidence score.
4. Output a JSON array of objects. Each object MUST have:
   - field (string)
   - value (string)
   - confidence (number between 0.0 and 1.0)
   - source (string, e.g., "OCR Line 3")
   - reasoning (string, e.g., "Appears directly above designation. Matches typical human name.")

Example Output:
[
  {
    "field": "Name",
    "value": "Vishal Wamanker",
    "confidence": 0.98,
    "source": "Raw OCR",
    "reasoning": "Appears directly above designation. Not a company keyword."
  },
  {
    "field": "Company",
    "value": "INFOSYS",
    "confidence": 0.95,
    "source": "Raw OCR",
    "reasoning": "Standard company name at the top of the card."
  }
]

Return ONLY the JSON array. Do not include markdown formatting or backticks.`;

    const response = await model.generateContent(prompt);
    const responseText = response.response.text().trim();
    const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedArray = JSON.parse(cleanedJson) as ContactUnderstandingField[];

    if (Array.isArray(parsedArray)) {
      const finalFields: Record<string, string | null> = {
        name: null, company: null, designation: null, department: null,
        email: null, website: null, phone: null, mobile: null, office: null,
        address: null, city: null, state: null, country: null, postalCode: null,
        linkedin_url: null
      };

      let needsManualReview = false;

      for (const item of parsedArray) {
        const key = item.field.toLowerCase().replace(/\s+/g, '');
        // Map common keys
        if (key.includes('name')) finalFields.name = item.value;
        else if (key.includes('company')) finalFields.company = item.value;
        else if (key.includes('designation') || key.includes('title')) finalFields.designation = item.value;
        else if (key.includes('email')) finalFields.email = item.value;
        else if (key.includes('website')) finalFields.website = item.value;
        else if (key.includes('mobile')) finalFields.mobile = item.value;
        else if (key.includes('office')) finalFields.office = item.value;
        else if (key.includes('phone')) finalFields.phone = item.value;
        else if (key.includes('linkedin')) finalFields.linkedin_url = item.value;
        else if (key.includes('address')) finalFields.address = item.value;
        else if (key.includes('city')) finalFields.city = item.value;
        else if (key.includes('state')) finalFields.state = item.value;
        else if (key.includes('country')) finalFields.country = item.value;
        else if (key.includes('postal') || key.includes('zip')) finalFields.postalCode = item.value;

        if (item.confidence < 0.70) {
          needsManualReview = true;
        }
      }

      // Re-run minimal heuristic cross-validation to ensure formats (like email/phone) are safe
      const sanitizedFields = crossValidateFields(finalFields as any);

      return {
        fields: sanitizedFields as any,
        understanding: parsedArray,
        needsManualReview,
      };
    }
  } catch (err: any) {
    logger.error('[Validation Engine] Gemini validation request failed, falling back to heuristics:', err.message);
  }

  return buildFallbackResult(baseFields);
}

function buildFallbackResult(baseFields: StructuredContact): ValidationResult {
  const understanding: ContactUnderstandingField[] = [];
  let needsManualReview = false;
  
  for (const [key, value] of Object.entries(baseFields)) {
    if (value && value !== 'Unknown Contact') {
      understanding.push({
        field: key,
        value: value,
        confidence: 0.65,
        source: 'Heuristics',
        reasoning: 'Fallback heuristic parsing.'
      });
      needsManualReview = true;
    }
  }

  return {
    fields: baseFields as any,
    understanding,
    needsManualReview,
  };
}

/**
 * Zero-shot layout parser using Gemini to extract and correct contact profiles from raw OCR lines.
 */
export async function runGeminiOcrClassifier(
  rawOcrText: string,
  baseFields: any
): Promise<ValidationResult> {
  return validateAndCorrectContact(rawOcrText, baseFields);
}

