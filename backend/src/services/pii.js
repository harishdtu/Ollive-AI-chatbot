/**
 * PII Redaction Service
 * Scrubs common PII patterns from text before storage.
 * Patterns: email, phone, SSN, credit card, IP addresses.
 */

const PII_PATTERNS = [
  { name: 'email',       re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,     mask: '[EMAIL]' },
  { name: 'phone',       re: /(\+?\d[\s\-.]?){7,15}\d/g,                                  mask: '[PHONE]' },
  { name: 'ssn',         re: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,                          mask: '[SSN]' },
  { name: 'credit_card', re: /\b(?:\d[ \-]?){13,16}\d\b/g,                                mask: '[CARD]' },
  { name: 'ip_address',  re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                              mask: '[IP]' },
];

/**
 * @param {string} text
 * @returns {{ redacted: string, wasRedacted: boolean }}
 */
function redactPII(text) {
  if (!text || typeof text !== 'string') return { redacted: text, wasRedacted: false };
  let result = text;
  let wasRedacted = false;
  for (const { re, mask } of PII_PATTERNS) {
    const replaced = result.replace(re, mask);
    if (replaced !== result) wasRedacted = true;
    result = replaced;
  }
  return { redacted: result, wasRedacted };
}

module.exports = { redactPII };
