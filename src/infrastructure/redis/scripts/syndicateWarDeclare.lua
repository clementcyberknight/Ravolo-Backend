-- War Declaration: queue syndicate for matchmaking
-- KEYS:
-- 1 userSyndicateKey    (STRING: user's syndicate id)
-- 2 metaKey             (HASH: syndicate meta)
-- 3 activeWarKey        (STRING: current active warId for syndicate)
-- 4 cooldownKey         (STRING: war cooldown expiry ms)
-- 5 matchmakingKey      (ZSET: syndicateId → infamy)
-- 6 infamyKey           (ZSET: syndicateId → infamy)
-- 7 idempKey            (STRING: idempotency)
-- 8 rolesKey            (HASH: member roles)
-- 9 warShieldsKey       (HASH: shieldType → expiresAtMs)
--
-- ARGV:
-- 1 userId
-- 2 syndicateId
-- 3 nowMs
-- 4 idempTtlSec
-- 5 startingInfamy

local existing = redis.call('GET', KEYS[7])
if existing then
  return existing
end

local sid = redis.call('GET', KEYS[1])
if not sid or sid == '' or sid ~= ARGV[2] then
  return redis.error_reply('ERR_NOT_MEMBER')
end

-- Must be owner or officer
local role = redis.call('HGET', KEYS[8], ARGV[1])
if role ~= 'owner' and role ~= 'officer' then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

-- Check syndicate exists
local metaId = redis.call('HGET', KEYS[2], 'id')
if not metaId or metaId == '' then
  return redis.error_reply('ERR_NO_SUCH_SYNDICATE')
end

-- Check no active war
local activeWar = redis.call('GET', KEYS[3])
if activeWar and activeWar ~= '' then
  return redis.error_reply('ERR_ALREADY_IN_WAR')
end

-- Check already in matchmaking queue
local queueScore = redis.call('ZSCORE', KEYS[5], ARGV[2])
if queueScore then
  return redis.error_reply('ERR_ALREADY_IN_WAR')
end

-- Check cooldown
local nowMs = tonumber(ARGV[3]) or 0
local cdUntil = tonumber(redis.call('GET', KEYS[4]) or '0') or 0
if cdUntil > nowMs then
  return redis.error_reply('ERR_WAR_COOLDOWN')
end

-- Check ceasefire shield active
local ceasefireExp = tonumber(redis.call('HGET', KEYS[9], 'ceasefire') or '0') or 0
if ceasefireExp > nowMs then
  return redis.error_reply('ERR_CEASEFIRE_ACTIVE')
end

-- Get or initialize infamy
local infamy = tonumber(redis.call('ZSCORE', KEYS[6], ARGV[2])) or 0
if infamy <= 0 then
  infamy = tonumber(ARGV[5]) or 1000
  redis.call('ZADD', KEYS[6], infamy, ARGV[2])
end

-- Add to matchmaking queue
redis.call('ZADD', KEYS[5], infamy, ARGV[2])

local reply = 'OK|' .. ARGV[2] .. '|' .. tostring(infamy)
redis.call('SET', KEYS[7], reply, 'EX', tonumber(ARGV[4]) or 60)
return reply
