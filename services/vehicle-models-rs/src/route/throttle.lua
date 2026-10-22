-- ThrottlerStorageService.increment (@nestjs/throttler 6.7.1), atomique.
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
