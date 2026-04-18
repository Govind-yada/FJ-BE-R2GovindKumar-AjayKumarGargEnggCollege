'use strict';
const https  = require('https');
const logger = require('./logger');

const BASE_URL = 'https://api.openai.com/v1';

/**
 * Make a raw HTTPS POST to OpenAI — no axios dependency needed.
 */
function openaiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return reject(new Error('OPENAI_API_KEY is not set in .env'));
    }

    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.openai.com',
      path:     `/v1${endpoint}`,
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send messages to GPT-4o-mini and get a text response.
 * @param {Array<{role:string, content:string}>} messages
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
async function chat(messages, systemPrompt) {
  const body = {
    model:       process.env.OPENAI_MODEL || 'gpt-4o-mini',
    max_tokens:  1000,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };

  const res = await openaiPost('/chat/completions', body);
  return res.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Auto-categorise a transaction description using OpenAI.
 * Returns { category, type } — both strings.
 */
async function categorise(description, availableCategories) {
  const catList = availableCategories.map(c => `${c.name} (${c.type})`).join(', ');
  const systemPrompt = `You are a financial transaction categoriser for Indian users.
Given a transaction description, return ONLY a JSON object with two fields:
- "category": the best matching category name from the list
- "type": one of "income", "expense", or "investment"

Available categories: ${catList}

Respond with ONLY valid JSON, no explanation.`;

  try {
    const raw = await chat([{ role: 'user', content: `Transaction: "${description}"` }], systemPrompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn('AI categorisation failed', { description, err: err.message });
    return { category: null, type: 'expense' };
  }
}

/**
 * Generate a financial insight summary for the user's current month.
 */
async function generateInsight(financialData) {
  const systemPrompt = `You are a friendly, concise personal finance advisor for Indian users.
Analyse the user's financial data and give 3-4 specific, actionable insights.
Use Indian currency (₹). Be encouraging but honest. Keep the total response under 200 words.
Format as plain text paragraphs — no bullet points, no markdown headers.`;

  const userMsg = `Here is my financial data for this month:
- Total Income: ₹${financialData.income.toFixed(2)}
- Total Expenses: ₹${financialData.expense.toFixed(2)}
- Net Savings: ₹${financialData.savings.toFixed(2)}
- Savings Rate: ${financialData.savingsRate.toFixed(1)}%
- Top expense categories: ${financialData.topCategories.join(', ')}
- Budget overruns: ${financialData.overruns.join(', ') || 'none'}
Please give me personalised financial insights.`;

  return chat([{ role: 'user', content: userMsg }], systemPrompt);
}

/**
 * Answer a natural-language finance question from the user.
 */
async function answerQuestion(question, conversationHistory, financialContext) {
  const systemPrompt = `You are Finflow AI, a helpful personal finance assistant for Indian users.
You have access to the user's financial summary below. Answer questions naturally and helpfully.
Always use ₹ for amounts. Be concise — keep answers under 150 words.

User's Financial Context:
${financialContext}`;

  const messages = [
    ...conversationHistory.slice(-8), // keep last 8 messages for context
    { role: 'user', content: question },
  ];

  return chat(messages, systemPrompt);
}

module.exports = { chat, categorise, generateInsight, answerQuestion };
