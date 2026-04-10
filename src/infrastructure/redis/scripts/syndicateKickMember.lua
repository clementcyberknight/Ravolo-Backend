-- Kick member from syndicate (atomic)
-- KEYS:
-- 1 actorUserSyndicateKey
-- 2 membersKey
-- 3 rolesKey
-- 4 targetUserSyndicateKey
-- 5 idempKey
--
-- ARGV:
-- 1 actorUserId
-- 2 targetUserId
-- 3 syndicateId
-- 4 idempTtlSec

local existing = redis.call('GET', KEYS[5])
if existing then return existing end

local actorId = tostring(ARGV[1] or '')
local targetId = tostring(ARGV[2] or '')
local sid = tostring(ARGV[3] or '')

if actorId == targetId then
  return redis.error_reply('ERR_CANNOT_KICK_SELF')
end

local actorSid = redis.call('GET', KEYS[1])
if not actorSid or actorSid ~= sid then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

local targetSid = redis.call('GET', KEYS[4])
if targetSid ~= sid then
  return redis.error_reply('ERR_TARGET_NOT_IN_SYNDICATE')
end

local actorRole = redis.call('HGET', KEYS[3], actorId) or 'member'
local targetRole = redis.call('HGET', KEYS[3], targetId) or 'member'

if actorRole == 'member' then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

if targetRole == 'owner' then
  -- Even another admin cannot kick the owner
  return redis.error_reply('ERR_CANNOT_KICK_OWNER')
end

-- Officers cannot kick other officers
if actorRole == 'officer' and targetRole == 'officer' then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

-- Perform kick
redis.call('SREM', KEYS[2], targetId)
redis.call('HDEL', KEYS[3], targetId)
redis.call('DEL', KEYS[4])

local reply = 'OK'
redis.call('SET', KEYS[5], reply, 'EX', tonumber(ARGV[4]) or 60)
return reply
