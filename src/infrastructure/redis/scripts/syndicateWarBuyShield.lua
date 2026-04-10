-- Buy War Shield: purchase a specific shield type for syndicate
-- KEYS:
-- 1 userSyndicateKey  (STRING)
-- 2 rolesKey          (HASH: member roles)
-- 3 bankGoldKey       (STRING: syndicate bank gold)
-- 4 warShieldsKey     (HASH: shieldType → expiresAtMs)
-- 5 idempKey          (STRING: idempotency)
--
-- ARGV:
-- 1 userId
-- 2 syndicateId
-- 3 shieldType
-- 4 goldCost
-- 5 durationMs
-- 6 nowMs
-- 7 idempTtlSec

local existing = redis.call('GET', KEYS[5])
if existing then
  return existing
end

-- Check membership
local sid = redis.call('GET', KEYS[1])
if not sid or sid == '' or sid ~= ARGV[2] then
  return redis.error_reply('ERR_NOT_MEMBER')
end

-- Check role (officer or owner)
local role = redis.call('HGET', KEYS[2], ARGV[1])
if role ~= 'owner' and role ~= 'officer' then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

local goldCost = tonumber(ARGV[4]) or 0
if goldCost <= 0 then
  return redis.error_reply('ERR_BAD_ARGS')
end

-- Check bank gold
local bank = tonumber(redis.call('GET', KEYS[3]) or '0') or 0
if bank < goldCost then
  return redis.error_reply('ERR_INSUFFICIENT_GOLD')
end

-- Check if shield already active
local nowMs = tonumber(ARGV[6]) or 0
local curExp = tonumber(redis.call('HGET', KEYS[4], ARGV[3]) or '0') or 0
if curExp > nowMs then
  return redis.error_reply('ERR_SHIELD_ALREADY_ACTIVE')
end

-- Deduct gold
redis.call('DECRBY', KEYS[3], goldCost)

-- Set shield expiry
local durationMs = tonumber(ARGV[5]) or 0
local expiresAt = nowMs + durationMs
redis.call('HSET', KEYS[4], ARGV[3], tostring(expiresAt))

local reply = 'OK|' .. ARGV[3] .. '|' .. tostring(expiresAt)
redis.call('SET', KEYS[5], reply, 'EX', tonumber(ARGV[7]) or 60)
return reply
