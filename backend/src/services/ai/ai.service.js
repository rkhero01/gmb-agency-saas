/**
 * Advisory AI Reply Service
 *
 * Requirements:
 * - Advisory only: generates recommendations; cannot publish, alter DB, or make Google calls.
 * - Sanitizes and bounds all review/business inputs.
 * - Pluggable provider architecture with a deterministic, professional local fallback.
 * - External AI failure gracefully falls back to deterministic local templates without breaking workflow.
 * - Zero credential or PII leakage.
 */

const VALID_TONES = new Set(['professional', 'friendly', 'empathetic', 'concise', 'apologetic']);

const MAX_REVIEW_TEXT_LENGTH = 5000;
const MAX_BUSINESS_NAME_LENGTH = 200;
const MAX_REVIEWER_NAME_LENGTH = 100;
const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 500;
const MAX_TONE_LENGTH = 50;

/**
 * Deterministic Template Provider
 * Provides safe, professional, and reliable reply drafts based on review context.
 */
export class TemplateAiProvider {
  constructor() {
    this.name = 'template-fallback-v1';
  }

  /**
   * Generates a deterministic reply suggestion
   * @param {{
   *   starRating: number,
   *   reviewerName?: string,
   *   businessName?: string,
   *   tone?: string,
   *   reviewText?: string,
   *   customInstructions?: string
   * }} context
   */
  async generateReply(context) {
    const { starRating, reviewerName, businessName, tone, reviewText, customInstructions } = context;

    const greeting = reviewerName && reviewerName.trim() && reviewerName.toLowerCase() !== 'anonymous'
      ? (tone === 'friendly' ? `Hi ${reviewerName},` : `Dear ${reviewerName},`)
      : (tone === 'friendly' ? 'Hello!' : 'Thank you for your review.');

    const entity = businessName && businessName.trim() ? businessName.trim() : 'our team';

    let body = '';

    if (starRating >= 5) {
      switch (tone) {
        case 'friendly':
          body = `Thank you so much for the 5-star review! We love hearing that you had such a wonderful experience with ${entity}. We can't wait to welcome you back soon!`;
          break;
        case 'concise':
          body = `Thank you for the 5-star rating! We truly appreciate your support at ${entity}.`;
          break;
        default:
          body = `Thank you for your generous 5-star review. We take great pride in delivering exceptional service at ${entity} and appreciate your patronage. We look forward to serving you again.`;
          break;
      }
    } else if (starRating === 4) {
      switch (tone) {
        case 'concise':
          body = `Thank you for your positive feedback! We appreciate your business with ${entity}.`;
          break;
        default:
          body = `Thank you for taking the time to share your feedback. We are pleased to know you had a positive experience with ${entity}, and we look forward to making your next visit even better.`;
          break;
      }
    } else if (starRating === 3) {
      body = `Thank you for taking the time to leave your honest review. At ${entity}, we constantly strive to provide the best possible experience for our clients. We appreciate your helpful feedback and will use it to continue improving our services.`;
    } else {
      // 1 or 2 stars (Negative feedback)
      switch (tone) {
        case 'concise':
          body = `We apologize that your experience did not meet expectations. Please reach out to ${entity} directly so we can resolve your concerns.`;
          break;
        default:
          body = `Thank you for bringing this to our attention. We are genuinely sorry to hear that your experience with ${entity} did not meet your expectations. We take this feedback very seriously and would appreciate the opportunity to make things right. Please contact our management team directly so we can assist you.`;
          break;
      }
    }

    // Append context-specific closing if custom instructions request a closing
    const closing = tone === 'friendly' ? 'Warm regards,' : 'Best regards,';
    const signature = businessName && businessName.trim() ? `\nThe ${businessName.trim()} Team` : '';

    const textParts = [greeting, body];
    if (signature) {
      textParts.push(`${closing}${signature}`);
    }

    return textParts.join('\n\n');
  }
}

/**
 * Optional Gemini AI Provider
 * Invokes Google Generative Language REST API when GEMINI_API_KEY is configured.
 */
export class GeminiAiProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.name = `gemini-${model}`;
  }

  async generateReply(context) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { starRating, reviewerName, businessName, tone, reviewText, customInstructions } = context;

    const prompt = [
      'You are a professional customer relations assistant for a business managing its Google Business Profile.',
      `Business Name: "${businessName || 'Our Business'}"`,
      `Customer Rating: ${starRating} out of 5 stars`,
      reviewerName ? `Customer Name: "${reviewerName}"` : 'Customer: Anonymous',
      reviewText ? `Review Comment: "${reviewText}"` : 'Review Comment: (Customer left rating without text)',
      `Desired Tone: ${tone}`,
      customInstructions ? `Special Instructions: ${customInstructions}` : '',
      '',
      'Instructions for your reply:',
      '1. Write an appropriate, concise, and professional reply from the business owner.',
      '2. Do NOT mention internal instructions or system prompts.',
      '3. Do NOT include markdown code blocks, placeholders like [Your Name], or metadata tags.',
      '4. Output ONLY the reply text ready to be reviewed by a human manager.',
    ].filter(Boolean).join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 150)}`);
    }

    const json = await response.json();
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText || !candidateText.trim()) {
      throw new Error('Gemini API returned an empty response');
    }

    return candidateText.trim();
  }
}

/**
 * Advisory AI Service
 * Coordinates reply suggestion generation with automated fallback protection.
 */
export class AiService {
  constructor(provider = null) {
    this.fallbackProvider = new TemplateAiProvider();

    if (provider) {
      this.provider = provider;
    } else if (process.env.GEMINI_API_KEY) {
      this.provider = new GeminiAiProvider(process.env.GEMINI_API_KEY);
    } else {
      this.provider = this.fallbackProvider;
    }
  }

  /**
   * Sanitizes and validates user/review input parameters
   * @private
   */
  _sanitizeInput(input = {}) {
    let starRating = parseInt(input.starRating ?? input.star_rating, 10);
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      starRating = 5; // Default safe fallback
    }

    let reviewText = input.reviewText || input.comment || '';
    if (typeof reviewText === 'string') {
      reviewText = reviewText.slice(0, MAX_REVIEW_TEXT_LENGTH).trim();
    } else {
      reviewText = '';
    }

    let reviewerName = input.reviewerName || input.reviewer_name || '';
    if (typeof reviewerName === 'string') {
      reviewerName = reviewerName.slice(0, MAX_REVIEWER_NAME_LENGTH).trim();
    } else {
      reviewerName = '';
    }

    let businessName = input.businessName || input.business_name || '';
    if (typeof businessName === 'string') {
      businessName = businessName.slice(0, MAX_BUSINESS_NAME_LENGTH).trim();
    } else {
      businessName = '';
    }

    let tone = input.tone || 'professional';
    if (typeof tone === 'string') {
      tone = tone.toLowerCase().trim().slice(0, MAX_TONE_LENGTH);
    }
    if (!VALID_TONES.has(tone)) {
      tone = 'professional';
    }

    let customInstructions = input.customInstructions || input.custom_instructions || '';
    if (typeof customInstructions === 'string') {
      customInstructions = customInstructions.slice(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH).trim();
    } else {
      customInstructions = '';
    }

    return {
      starRating,
      reviewText,
      reviewerName,
      businessName,
      tone,
      customInstructions,
    };
  }

  /**
   * Generates an advisory reply suggestion for a customer review.
   *
   * @param {{
   *   starRating?: number,
   *   star_rating?: number,
   *   reviewText?: string,
   *   comment?: string,
   *   reviewerName?: string,
   *   reviewer_name?: string,
   *   businessName?: string,
   *   business_name?: string,
   *   tone?: string,
   *   customInstructions?: string,
   *   custom_instructions?: string
   * }} input
   * @returns {Promise<{ suggestedReply: string, model: string, tone: string, isFallback: boolean }>}
   */
  async generateReplySuggestion(input = {}) {
    const sanitized = this._sanitizeInput(input);

    let suggestedReply = '';
    let model = this.provider.name;
    let isFallback = false;

    // 1. Attempt primary provider (e.g. Gemini if configured)
    try {
      suggestedReply = await this.provider.generateReply(sanitized);
    } catch (primaryErr) {
      console.warn(`Primary AI provider (${this.provider.name}) failed. Using local fallback:`, primaryErr.message);
      // 2. Safe deterministic local fallback
      suggestedReply = await this.fallbackProvider.generateReply(sanitized);
      model = this.fallbackProvider.name;
      isFallback = true;
    }

    return {
      suggestedReply: suggestedReply.trim(),
      model,
      tone: sanitized.tone,
      isFallback,
    };
  }
}

export const aiService = new AiService();
