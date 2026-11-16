/**
 * Classement humain / robot connu / douteux des événements du parcours
 * (mandat AT, décisions 36 et 68). Signatures existantes uniquement :
 * GooglebotDetectorService (robots connus) et BotGuard (clients scriptés).
 */
import {
  classifyUserAgent,
  isKnownBotUserAgent,
  SUSPICIOUS_UA_PATTERNS,
} from '../../../common/utils/user-agent-class.util';
import { GooglebotDetectorService } from './googlebot-detector.service';

describe('classifyUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) facebot',
    'Mozilla/5.0 (compatible; SomeCrawler/1.0)',
  ])('robot connu → bot : %s', (ua) => {
    expect(classifyUserAgent(ua)).toBe('bot');
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  ])('navigateur réel → human : %s', (ua) => {
    expect(classifyUserAgent(ua)).toBe('human');
  });

  it.each([
    ['agent absent', undefined],
    ['agent null', null],
    ['agent vide', '   '],
    ['curl', 'curl/8.5.0'],
    ['python-requests', 'python-requests/2.32.3'],
    ['node-fetch', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)'],
    [
      'navigateur piloté',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36',
    ],
    ['agent hors navigateur', 'MonOutil/1.0'],
  ])('douteux → suspect : %s', (_name, ua) => {
    expect(classifyUserAgent(ua)).toBe('suspect');
  });

  it('robot connu prime sur douteux (même agent porteur des deux signatures)', () => {
    expect(classifyUserAgent('python-requests/2.0 mybot')).toBe('bot');
  });

  it('ne crée aucune liste : toute signature BotGuard rend un agent navigateur douteux', () => {
    for (const p of SUSPICIOUS_UA_PATTERNS) {
      const ua = `Mozilla/5.0 (X11; Linux x86_64) ${p}1.0`;
      expect(classifyUserAgent(ua)).toBe(
        isKnownBotUserAgent(ua) ? 'bot' : 'suspect',
      );
    }
  });

  it('isBot du service garde la même règle que le classement', () => {
    const isBot = GooglebotDetectorService.prototype.isBot;
    for (const ua of [
      'Googlebot/2.1',
      'Mozilla/5.0 Firefox/132.0',
      'x spider y',
    ]) {
      expect(isBot.call({}, ua)).toBe(isKnownBotUserAgent(ua));
    }
  });
});
