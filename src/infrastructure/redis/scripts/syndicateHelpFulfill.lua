-- Help Fulfill: atomically transfer gold from fulfiller to requester
-- KEYS:
-- 1 fulfillerWalletKey   (HASH: gold field)
-- 2 requesterWalletKey   (HASH: gold field)
-- 3 helpRequestsKey      (HASH: requestId → JSON)
-- 4 idempKey             (STRING: idempotency)
--
-- ARGV:
-- 1 fulfillerUserId
-- 2 requesterUserId
-- 3 helpRequestId
-- 4 goldAmount
-- 5 nowMs
-- 6 idempTtlSec

local existing = redis.call('GET', KEYS[4])
if existing then
  return existing
end

-- Prevent self-fulfillment
if ARGV[1] == ARGV[2] then
  return redis.error_reply('ERR_HELP_SELF_FULFILL')
end

-- Check help request still exists
local reqJson = redis.call('HGET', KEYS[3], ARGV[3])
if not reqJson then
  return redis.error_reply('ERR_HELP_REQUEST_NOT_FOUND')
end

-- Parse request to verify status and expiry
-- We store status in the hash entry; check it hasn't been fulfilled
-- Format is JSON, but we'll do a simple string check for "open"
if not string.find(reqJson, '"open"') then
  return redis.error_reply('ERR_HELP_ALREADY_FULFILLED')
end

-- Check expiry from the request data
local expiresAt = string.match(reqJson, '"expiresAtMs":(%d+)')
if expiresAt then
  local nowMs = tonumber(ARGV[5]) or 0
  if nowMs > tonumber(expiresAt) then
    -- Clean up expired request
    redis.call('HDEL', KEYS[3], ARGV[3])
    return redis.error_reply('ERR_HELP_REQUEST_EXPIRED')
  end
end

-- Check fulfiller has enough gold
local goldAmount = tonumber(ARGV[4]) or 0
if goldAmount <= 0 then
  return redis.error_reply('ERR_BAD_ARGS')
end

local fulfillerGold = tonumber(redis.call('HGET', KEYS[1], 'gold') or '0') or 0
if fulfillerGold < goldAmount then
  return redis.error_reply('ERR_INSUFFICIENT_GOLD')
end

-- Transfer gold: deduct from fulfiller, credit to requester
redis.call('HINCRBY', KEYS[1], 'gold', -goldAmount)
redis.call('HINCRBY', KEYS[2], 'gold', goldAmount)

-- Remove the help request (fulfilled)
redis.call('HDEL', KEYS[3], ARGV[3])

-- Store idempotency
local reply = 'OK|' .. ARGV[3] .. '|' .. ARGV[1] .. '|' .. ARGV[2] .. '|' .. tostring(goldAmount)
redis.call('SET', KEYS[4], reply, 'EX', tonumber(ARGV[6]) or 60)
return reply
