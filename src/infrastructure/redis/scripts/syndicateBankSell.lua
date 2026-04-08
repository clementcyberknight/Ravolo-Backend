-- Sell commodity from syndicate bank to treasury (atomic)
-- Only owner/officer can execute. Gold proceeds go to syndicate bank.
-- KEYS:
-- 1 userSyndicateKey     (STRING userId -> syndicateId)
-- 2 rolesKey             (HASH userId -> role)
-- 3 bankItemsKey         (HASH item -> qty)
-- 4 bankGoldKey          (STRING int)
-- 5 treasuryReserveKey   (STRING int)
-- 6 sellFlowKey          (HASH item -> flow)
-- 7 holdingsKey          (HASH item -> qty, monopoly tracker)
-- 8 idempKey
--
-- ARGV:
-- 1 userId
-- 2 syndicateId
-- 3 item
-- 4 quantity
-- 5 goldPayout (whole gold, precomputed in Node)
-- 6 idempTtlSec
-- 7 nowMs

local cached = redis.call('GET', KEYS[8])
if cached then
  return cached
end

local sid = redis.call('GET', KEYS[1])
if not sid or sid == '' or sid ~= ARGV[2] then
  return redis.error_reply('ERR_NOT_MEMBER')
end

local role = redis.call('HGET', KEYS[2], ARGV[1])
if role ~= 'owner' and role ~= 'officer' then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

local item = tostring(ARGV[3] or '')
if item == '' then
  return redis.error_reply('ERR_BAD_ARGS')
end

local qty = tonumber(ARGV[4])
if not qty or qty < 1 then
  return redis.error_reply('ERR_BAD_ARGS')
end

local have = tonumber(redis.call('HGET', KEYS[3], item) or '0') or 0
if have < qty then
  return redis.error_reply('ERR_INSUFFICIENT_INV')
end

local pay = tonumber(ARGV[5])
if not pay or pay < 0 then
  return redis.error_reply('ERR_BAD_ARGS')
end

local reserve = tonumber(redis.call('GET', KEYS[5]) or '0') or 0
if reserve < pay then
  return redis.error_reply('ERR_TREASURY_DEPLETED')
end

redis.call('HINCRBY', KEYS[3], item, -qty)
redis.call('INCRBY', KEYS[4], pay)
redis.call('DECRBY', KEYS[5], pay)
redis.call('HINCRBY', KEYS[6], item, qty)

local cur_hold = tonumber(redis.call('HGET', KEYS[7], item) or '0') or 0
local new_hold = cur_hold - qty
if new_hold > 0 then
  redis.call('HSET', KEYS[7], item, tostring(new_hold))
else
  redis.call('HDEL', KEYS[7], item)
end

local payload = table.concat({'OK', item, tostring(qty), tostring(pay)}, '|')
redis.call('SET', KEYS[8], payload, 'EX', tonumber(ARGV[6]) or 60)
return payload
