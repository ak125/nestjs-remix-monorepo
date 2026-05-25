/**
 * Tests classifyUserAgent() — patterns case-insensitive, first-category-wins.
 *
 * Fixtures représentatives des bots actuellement rencontrés en field (Googlebot,
 * ClaudeBot, Perplexity, Bytespider) + UAs humains canoniques (Chrome mobile
 * Android, Safari iOS).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { classifyUserAgent, isBot } from '../user-agent';

test('classifyUserAgent: bot_search — Googlebot', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    'bot_search',
  );
});

test('classifyUserAgent: bot_search — Bingbot lowercase variant', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'),
    'bot_search',
  );
});

test('classifyUserAgent: bot_ai — GPTBot', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot'),
    'bot_ai',
  );
});

test('classifyUserAgent: bot_ai — ClaudeBot', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'),
    'bot_ai',
  );
});

test('classifyUserAgent: bot_ai — PerplexityBot', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/docs/perplexity-bot)'),
    'bot_ai',
  );
});

test('classifyUserAgent: bot_ai — Bytespider', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (Linux; Android 5.0) Bytespider; spider-feedback@bytedance.com'),
    'bot_ai',
  );
});

test('classifyUserAgent: bot_other — AhrefsBot', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'),
    'bot_other',
  );
});

test('classifyUserAgent: bot_other — Lighthouse', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (Linux; Android 11) AppleWebKit Chrome-Lighthouse'),
    'bot_other',
  );
});

test('classifyUserAgent: human — Chrome mobile Android', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'),
    'human',
  );
});

test('classifyUserAgent: human — Safari iOS', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'),
    'human',
  );
});

test('classifyUserAgent: human — Firefox desktop', () => {
  assert.equal(
    classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'),
    'human',
  );
});

test('classifyUserAgent: null/undefined/empty → human (graceful fallback)', () => {
  assert.equal(classifyUserAgent(null), 'human');
  assert.equal(classifyUserAgent(undefined), 'human');
  assert.equal(classifyUserAgent(''), 'human');
});

test('classifyUserAgent: case-insensitivity (BOTH cases handled)', () => {
  assert.equal(classifyUserAgent('GOOGLEBOT/2.1'), 'bot_search');
  assert.equal(classifyUserAgent('googlebot/2.1'), 'bot_search');
  assert.equal(classifyUserAgent('GoogleBot/2.1'), 'bot_search');
});

test('isBot: true for bot_*, false for human', () => {
  assert.equal(isBot('bot_search'), true);
  assert.equal(isBot('bot_ai'), true);
  assert.equal(isBot('bot_other'), true);
  assert.equal(isBot('human'), false);
});
