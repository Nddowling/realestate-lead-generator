/**
 * SMS Templates for Real Estate Outreach
 *
 * Templates use {{variable}} syntax for replacement.
 * Available variables:
 * - {{ownerName}} - Property owner's name
 * - {{firstName}} - Owner's first name
 * - {{address}} - Property address
 * - {{city}} - Property city
 * - {{amount}} - Amount owed (for tax/foreclosure)
 * - {{auctionDate}} - Upcoming auction date
 */

export interface SMSTemplate {
  id: string;
  name: string;
  category: 'initial' | 'follow_up' | 'foreclosure' | 'tax_delinquent' | 'probate' | 'custom';
  body: string;
  description: string;
}

// Template variables type
export interface TemplateVariables {
  ownerName?: string;
  firstName?: string;
  address?: string;
  city?: string;
  amount?: number;
  auctionDate?: string;
  [key: string]: string | number | undefined;
}

/**
 * Pre-built SMS templates
 */
export const SMS_TEMPLATES: SMSTemplate[] = [
  // Initial Outreach Templates
  {
    id: 'initial-1',
    name: 'Friendly Introduction',
    category: 'initial',
    body: 'Hi {{firstName}}, I noticed your property at {{address}}. I help homeowners in {{city}} who might be looking to sell. Any interest in a quick cash offer? - Nick',
    description: 'Casual, friendly first contact',
  },
  {
    id: 'initial-2',
    name: 'Direct Approach',
    category: 'initial',
    body: 'Hi {{firstName}}, I buy houses in {{city}} for cash and can close quickly. Would you consider selling {{address}}? Reply YES if interested.',
    description: 'More direct, gets to the point',
  },
  {
    id: 'initial-3',
    name: 'Problem Solver',
    category: 'initial',
    body: 'Hello {{firstName}}, I work with homeowners in {{city}} who need to sell fast - no repairs, no fees, cash in hand. Is your property at {{address}} available? - Nick',
    description: 'Emphasizes benefits and ease',
  },

  // Follow-up Templates
  {
    id: 'followup-1',
    name: 'Gentle Follow-up',
    category: 'follow_up',
    body: 'Hi {{firstName}}, just following up on {{address}}. Still interested in a no-hassle cash offer? Happy to chat whenever works for you.',
    description: 'Soft follow-up, not pushy',
  },
  {
    id: 'followup-2',
    name: 'Check-in',
    category: 'follow_up',
    body: 'Hey {{firstName}}, checking back on the property at {{address}}. Circumstances change - if you ever want to explore selling, Im here. No pressure.',
    description: 'Low pressure check-in',
  },
  {
    id: 'followup-3',
    name: 'Last Attempt',
    category: 'follow_up',
    body: 'Hi {{firstName}}, last message from me about {{address}}. If timing isnt right, no worries. Just reply STOP and I wont bother you again. Best, Nick',
    description: 'Final follow-up with opt-out option',
  },

  // Foreclosure-Specific Templates
  {
    id: 'foreclosure-1',
    name: 'Foreclosure Help',
    category: 'foreclosure',
    body: 'Hi {{firstName}}, I noticed {{address}} has a foreclosure filing. I might be able to help you avoid auction and walk away with cash. Can we talk?',
    description: 'Direct foreclosure outreach',
  },
  {
    id: 'foreclosure-2',
    name: 'Urgent Foreclosure',
    category: 'foreclosure',
    body: 'Hi {{firstName}}, I see the auction for {{address}} is coming up{{auctionDate}}. I can make a cash offer and close before then. Call me if interested.',
    description: 'Time-sensitive foreclosure message',
  },
  {
    id: 'foreclosure-3',
    name: 'Foreclosure Options',
    category: 'foreclosure',
    body: '{{firstName}}, facing foreclosure on {{address}}? I work with homeowners to find solutions - could be a sale, could be other options. Free, no obligation chat?',
    description: 'Softer approach to foreclosure',
  },

  // Tax Delinquent Templates
  {
    id: 'tax-1',
    name: 'Tax Help Offer',
    category: 'tax_delinquent',
    body: 'Hi {{firstName}}, I noticed back taxes on {{address}}. I buy properties as-is and can help clear that up. Interested in discussing options?',
    description: 'Tax delinquent outreach',
  },
  {
    id: 'tax-2',
    name: 'Tax Relief',
    category: 'tax_delinquent',
    body: '{{firstName}}, dealing with property taxes on {{address}}? I can make a fair cash offer and handle all the back taxes. No stress. Want to chat?',
    description: 'Emphasizes tax relief',
  },

  // Probate Templates
  {
    id: 'probate-1',
    name: 'Probate Sympathy',
    category: 'probate',
    body: 'Hi {{firstName}}, sorry for your loss. If the property at {{address}} has become a burden, I can help with a fair, quick sale. No rush - whenever youre ready.',
    description: 'Sensitive probate outreach',
  },
  {
    id: 'probate-2',
    name: 'Estate Help',
    category: 'probate',
    body: 'Hello {{firstName}}, handling an estate with property in {{city}}? I specialize in quick, hassle-free purchases. Happy to discuss {{address}} when timing is right.',
    description: 'Estate-focused outreach',
  },
];

/**
 * Replace template variables with actual values
 */
export function fillTemplate(template: string, variables: TemplateVariables): string {
  let result = template;

  // Extract first name from full name if not provided
  if (!variables.firstName && variables.ownerName) {
    const nameParts = variables.ownerName.split(/[\s,]+/);
    // Handle "LAST, FIRST" format
    if (variables.ownerName.includes(',')) {
      variables.firstName = nameParts[1] || nameParts[0];
    } else {
      variables.firstName = nameParts[0];
    }
    // Capitalize properly
    if (variables.firstName) {
      variables.firstName = variables.firstName.charAt(0).toUpperCase() +
        variables.firstName.slice(1).toLowerCase();
    }
  }

  // Format auction date if provided
  if (variables.auctionDate) {
    const date = new Date(variables.auctionDate);
    if (!isNaN(date.getTime())) {
      variables.auctionDate = ` on ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    }
  }

  // Format amount if provided
  if (variables.amount && typeof variables.amount === 'number') {
    (variables as any).amountFormatted = `$${variables.amount.toLocaleString()}`;
  }

  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
  }

  // Remove any unreplaced variables
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  // Clean up double spaces
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): SMSTemplate | undefined {
  return SMS_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: SMSTemplate['category']): SMSTemplate[] {
  return SMS_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get appropriate templates based on lead distress type
 */
export function getRecommendedTemplates(distressTypes: string[]): SMSTemplate[] {
  const templates: SMSTemplate[] = [];

  // Add category-specific templates
  if (distressTypes.includes('foreclosure') || distressTypes.includes('pre_foreclosure')) {
    templates.push(...getTemplatesByCategory('foreclosure'));
  }
  if (distressTypes.includes('tax_delinquent')) {
    templates.push(...getTemplatesByCategory('tax_delinquent'));
  }
  if (distressTypes.includes('probate')) {
    templates.push(...getTemplatesByCategory('probate'));
  }

  // Always include initial templates
  templates.push(...getTemplatesByCategory('initial'));

  // Remove duplicates
  return Array.from(new Map(templates.map(t => [t.id, t])).values());
}

/**
 * Validate template variables
 */
export function validateTemplate(template: string, variables: TemplateVariables): {
  valid: boolean;
  missingVariables: string[];
} {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const requiredVars: string[] = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    requiredVars.push(match[1]);
  }

  const missingVariables = requiredVars.filter(v => {
    const value = variables[v];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Preview a template with sample data
 */
export function previewTemplate(templateId: string): string {
  const template = getTemplateById(templateId);
  if (!template) return '';

  const sampleVariables: TemplateVariables = {
    ownerName: 'John Smith',
    firstName: 'John',
    address: '123 Main St',
    city: 'Savannah',
    amount: 5000,
    auctionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return fillTemplate(template.body, sampleVariables);
}
