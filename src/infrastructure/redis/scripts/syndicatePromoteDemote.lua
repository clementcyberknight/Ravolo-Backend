-- Promote or Demote member (atomic)
-- KEYS:
-- 1 actorUserSyndicateKey
-- 2 rolesKey
-- 3 idempKey
--
-- ARGV:
-- 1 actorUserId
-- 2 targetUserId
-- 3 syndicateId
-- 4 mode ("promote"|"demote")
-- 5 idempTtlSec
-- 6 maxAdmins (e.g. 10)

local existing = redis.call('GET', KEYS[3])
if existing then return existing end

local actorId = tostring(ARGV[1] or '')
local targetId = tostring(ARGV[2] or '')
local sid = tostring(ARGV[3] or '')
local mode = tostring(ARGV[4] or '')
local maxAdmins = tonumber(ARGV[6] or '10')

local actorSid = redis.call('GET', KEYS[1])
if not actorSid or actorSid ~= sid then
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

local actorRole = redis.call('HGET', KEYS[2], actorId) or 'member'
if actorRole ~= 'owner' then
  -- For now, only owner can promote/demote to officer
  return redis.error_reply('ERR_NOT_AUTHORIZED')
end

local targetRole = redis.call('HGET', KEYS[2], targetId)
if not targetRole or targetRole == '' then
  return redis.error_reply('ERR_TARGET_NOT_IN_SYNDICATE')
end

if mode == 'promote' then
  if targetRole == 'officer' or targetRole == 'owner' then
    return redis.error_reply('ERR_ALREADY_ADMIN')
  end

  -- Count current officers + owner
  local allRoles = redis.call('HGETALL', KEYS[2])
  local adminCount = 0
  for i = 2, #allRoles, 2 do
    local r = allRoles[i]
    if r == 'owner' or r == 'officer' then
      adminCount = adminCount + 1
    end
  end

  if adminCount >= maxAdmins then
    return redis.error_reply('ERR_MAX_ADMINS_REACHED')
  end

  redis.call('HSET', KEYS[2], targetId, 'officer')
  local reply = 'OK'
  redis.call('SET', KEYS[3], reply, 'EX', tonumber(ARGV[5]) or 60)
  return reply

elseif mode == 'demote' then
  if targetRole == 'member' then
    return redis.error_reply('ERR_ALREADY_MEMBER')
  end
  if targetRole == 'owner' then
    return redis.error_reply('ERR_CANNOT_DEMOTE_OWNER')
  end

  redis.call('HSET', KEYS[2], targetId, 'member')
  local reply = 'OK'
  redis.call('SET', KEYS[3], reply, 'EX', tonumber(ARGV[5]) or 60)
  return reply
end

return redis.error_reply('ERR_BAD_ARGS')
