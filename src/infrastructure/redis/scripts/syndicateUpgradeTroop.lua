-- Upgrade Troop: atomically level up a troop type for a syndicate
-- KEYS:
-- 1 userSyndicateKey  (STRING: user's syndicate id)
-- 2 rolesKey          (HASH: member roles)
-- 3 bankGoldKey       (STRING: syndicate bank gold)
-- 4 troopLevelsKey    (HASH: troopType → level)
-- 5 idempKey          (STRING: idempotency)
--
-- ARGV:
-- 1 userId
-- 2 syndicateId
-- 3 troopType
-- 4 goldCost          (cost for this specific upgrade)
-- 5 maxLevel
-- 6 idempTtlSec

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

-- Get current level (default 1)
local currentLevel = tonumber(redis.call('HGET', KEYS[4], ARGV[3]) or '1') or 1
if currentLevel < 1 then currentLevel = 1 end

local maxLevel = tonumber(ARGV[5]) or 5
if currentLevel >= maxLevel then
  return redis.error_reply('ERR_MAX_TROOP_LEVEL')
end

-- Check gold
local goldCost = tonumber(ARGV[4]) or 0
if goldCost <= 0 then
  return redis.error_reply('ERR_BAD_ARGS')
end

local bank = tonumber(redis.call('GET', KEYS[3]) or '0') or 0
if bank < goldCost then
  return redis.error_reply('ERR_INSUFFICIENT_GOLD')
end

-- Deduct gold and upgrade
redis.call('DECRBY', KEYS[3], goldCost)
local newLevel = currentLevel + 1
redis.call('HSET', KEYS[4], ARGV[3], tostring(newLevel))

local reply = 'OK|' .. ARGV[3] .. '|' .. tostring(newLevel) .. '|' .. tostring(goldCost)
redis.call('SET', KEYS[5], reply, 'EX', tonumber(ARGV[6]) or 60)
return reply
