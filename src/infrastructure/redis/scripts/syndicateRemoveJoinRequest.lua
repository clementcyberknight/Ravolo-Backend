-- Remove join request (cancel by user or reject by admin) (atomic)
-- KEYS:
-- 1 actorUserSyndicateKey
-- 2 joinReqKey
-- 3 targetUserPendingSyndicateKey
-- 4 rolesKey
-- 5 idempKey
--
-- ARGV:
-- 1 actorUserId
-- 2 targetUserId
-- 3 syndicateId
-- 4 mode ("cancel"|"reject")
-- 5 idempTtlSec

local existing = redis.call('GET', KEYS[5])
if existing then
  return existing
end

local mode = tostring(ARGV[4] or '')
local actorId = tostring(ARGV[1] or '')
local targetId = tostring(ARGV[2] or '')
local sid = tostring(ARGV[3] or '')

if mode == 'cancel' then
  if actorId ~= targetId then
    return redis.error_reply('ERR_NOT_AUTHORIZED')
  end
  -- We don't strictly need to check if it matches sid in ARGV,
  -- but it's safer if we do to ensure we're touching the right joinReqKey.
  local pendingSid = redis.call('GET', KEYS[3])
  if pendingSid ~= sid then
    -- Maybe they aren't even requesting this syndicate
    return redis.error_reply('ERR_JOIN_REQUEST_MISSING')
  end

  redis.call('SREM', KEYS[2], targetId)
  redis.call('DEL', KEYS[3])

  local reply = 'OK'
  redis.call('SET', KEYS[5], reply, 'EX', tonumber(ARGV[5]) or 60)
  return reply
end

if mode == 'reject' then
  local actorSid = redis.call('GET', KEYS[1])
  if not actorSid or actorSid == '' or actorSid ~= sid then
    return redis.error_reply('ERR_NOT_AUTHORIZED')
  end

  local role = redis.call('HGET', KEYS[4], actorId) or 'member'
  if role ~= 'owner' and role ~= 'officer' then
    return redis.error_reply('ERR_NOT_AUTHORIZED')
  end

  local isMember = redis.call('SISMEMBER', KEYS[2], targetId)
  if isMember ~= 1 then
    return redis.error_reply('ERR_JOIN_REQUEST_MISSING')
  end

  redis.call('SREM', KEYS[2], targetId)

  -- Only clear the pending key if it still points to this syndicate
  local pendingSid = redis.call('GET', KEYS[3])
  if pendingSid == sid then
    redis.call('DEL', KEYS[3])
  end

  local reply = 'OK'
  redis.call('SET', KEYS[5], reply, 'EX', tonumber(ARGV[5]) or 60)
  return reply
end

return redis.error_reply('ERR_BAD_ARGS')
