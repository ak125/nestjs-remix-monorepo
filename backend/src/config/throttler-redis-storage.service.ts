/**
 * RedisThrottlerStorage — compteurs du limiteur partagés entre processus.
 *
 * Le garde (`CloudflareThrottlerGuard`), les paliers, `skipIf` et les clés
 * restent ceux de @nestjs/throttler : seules les données des compteurs passent
 * du `Map` du processus à Redis. Une clé reste `sha256(Classe-Handler-palier-IP)`,
 * donc la portée de chaque limite est inchangée ; deux processus qui servent la
 * même route pour la même adresse consomment le même budget.
 *
 * Panne Redis : ni ouverture ni fermeture. Le processus repasse sur le stockage
 * en mémoire de la bibliothèque (le comportement d'avant ce stockage) et le
 * journalise à l'entrée comme au retour.
 */

import {
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  type ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import Redis from 'ioredis';

import { redisConnectionOptions } from './app.config';

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

export const THROTTLER_KEY_PREFIX = 'throttler:';

/**
 * Jusqu'à huit appels séquentiels par requête (deux contextes × quatre paliers) :
 * 2 s au pire si Redis cesse de répondre sans couper la connexion.
 */
const COMMAND_TIMEOUT_MS = 250;

/**
 * Transcription de `ThrottlerStorageService.increment` (@nestjs/throttler 6.7.1),
 * branches comprises. ARGV[1] = horloge de l'appelant en ms, comme `Date.now()`
 * dans la bibliothèque. Puis, pour l'entrée i : KEYS[2i-1] = enregistrement
 * (e = expiresAt, b = blockExpiresAt, x = isBlocked), KEYS[2i] = échéances des
 * coups, ARGV[3i-1..3i+1] = ttl, limit, blockDuration. Réponse : une liste
 * { totalHits, timeToExpire, isBlocked (0/1), timeToBlockExpire } par entrée
 * traitée ; arrêt après la première entrée bloquée, comme la boucle du garde.
 *
 * La purge lit la tête de liste : exacte tant que le ttl d'une clé est constant
 * (paliers et `@Throttle` du dépôt). Sinon, comme après un recul d'horloge, des
 * coups expirés restent comptés : l'écart va toujours du côté strict.
 *
 * Copie octet à octet : services/vehicle-models-rs/src/route/throttle.lua
 * (vérifiée par throttler-redis-storage.service.test.ts).
 */
export const THROTTLER_INCREMENT_LUA = `-- ThrottlerStorageService.increment (@nestjs/throttler 6.7.1), atomique.
local n = #KEYS / 2
if n < 1 or n % 1 ~= 0 or #ARGV ~= 1 + 3 * n then
  error('throttle: KEYS et ARGV incohérents')
end
local now = tonumber(ARGV[1])
local function secs(at)
  return math.ceil((at - now) / 1000)
end
local out = {}
for i = 1, n do
  local rec, hits = KEYS[2 * i - 1], KEYS[2 * i]
  local ttl = tonumber(ARGV[3 * i - 1])
  local limit = tonumber(ARGV[3 * i])
  local block = tonumber(ARGV[3 * i + 1])
  local f = redis.call('HMGET', rec, 'e', 'b', 'x')
  local expires = tonumber(f[1]) or now + ttl
  local blockExpires = tonumber(f[2]) or 0
  local blocked = tonumber(f[3]) == 1
  while true do
    local head = redis.call('LINDEX', hits, 0)
    if not head or tonumber(head) > now then break end
    redis.call('LPOP', hits)
  end
  local total = redis.call('LLEN', hits)
  local toExpire = secs(expires)
  if toExpire <= 0 then
    expires = now + ttl
    toExpire = secs(expires)
  end
  local isBlocked, toBlock
  if block <= 0 then
    -- incrementWithoutBlock : isBlocked de l'enregistrement reste inchangé.
    isBlocked = total >= limit
    if not isBlocked then
      redis.call('RPUSH', hits, now + ttl)
    end
    total = total + 1
    toBlock = 0
    if isBlocked then
      local head = tonumber(redis.call('LINDEX', hits, 0))
      toBlock = head and secs(head) or toExpire
    end
  else
    if not blocked then
      redis.call('RPUSH', hits, now + ttl)
      total = total + 1
    end
    if total > limit and not blocked then
      blocked = true
      blockExpires = now + block
    end
    toBlock = secs(blockExpires)
    if toBlock <= 0 and blocked then
      blocked = false
      redis.call('DEL', hits)
      redis.call('RPUSH', hits, now + ttl)
      total = 1
    end
    isBlocked = blocked
  end
  redis.call('HSET', rec, 'e', expires, 'b', blockExpires, 'x', blocked and 1 or 0)
  local keep = math.max(expires, blocked and blockExpires or 0, tonumber(redis.call('LINDEX', hits, -1)) or 0)
  redis.call('PEXPIRE', rec, keep - now)
  redis.call('PEXPIRE', hits, keep - now)
  out[i] = { total, toExpire, isBlocked and 1 or 0, toBlock }
  if isBlocked then break end
end
return out
`;

type IncrementReply = Array<[number, number, number, number]>;

type ThrottlerRedis = Redis & {
  throttlerIncrement(
    record: string,
    hits: string,
    now: number,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<IncrementReply>;
};

export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: ThrottlerRedis;
  /** Stockage 6.7.1 du processus, utilisé seulement quand Redis échoue. */
  private readonly local = new ThrottlerStorageService();
  private lastError: string | undefined;
  /** Décisions prises en mémoire depuis l'entrée en repli ; null hors repli. */
  private localDecisions: number | null = null;

  constructor(private readonly config: ConfigService) {
    this.redis = this.createRedis() as ThrottlerRedis;
    this.redis.defineCommand('throttlerIncrement', {
      numberOfKeys: 2,
      lua: THROTTLER_INCREMENT_LUA,
    });
    this.redis.on('error', (err: Error) => {
      this.lastError = err.message;
    });
  }

  /** Factory hook — les tests passent une instance ioredis-mock. */
  protected createRedis(): Redis {
    return new Redis({
      ...redisConnectionOptions((key) => this.config.get<string>(key)),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: COMMAND_TIMEOUT_MS,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.redis.connect().catch((err: Error) => this.degrade(err));
  }

  onApplicationShutdown(): void {
    this.local.onApplicationShutdown();
    this.redis.disconnect();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    let reply: IncrementReply;
    try {
      reply = await this.redis.throttlerIncrement(
        THROTTLER_KEY_PREFIX + key,
        `${THROTTLER_KEY_PREFIX}${key}:${throttlerName}`,
        Date.now(),
        ttl,
        limit,
        blockDuration,
      );
    } catch (err) {
      this.degrade(err as Error);
      this.localDecisions = (this.localDecisions ?? 0) + 1;
      return this.local.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
    this.recover();
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = reply[0];
    return {
      totalHits,
      timeToExpire,
      isBlocked: isBlocked === 1,
      timeToBlockExpire,
    };
  }

  private degrade(err: Error): void {
    if (this.localDecisions !== null) return;
    this.localDecisions = 0;
    const cause =
      this.lastError && this.lastError !== err.message
        ? `${err.message} ; ${this.lastError}`
        : err.message;
    this.logger.error(
      `Redis indisponible (${cause}) : limiteur en mémoire du processus, budget non partagé`,
    );
  }

  private recover(): void {
    if (this.localDecisions === null) return;
    this.logger.warn(
      `Redis revenu : budget partagé rétabli après ${this.localDecisions} décision(s) en mémoire du processus`,
    );
    this.localDecisions = null;
  }
}
