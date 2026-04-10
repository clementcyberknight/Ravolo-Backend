-- War Phase Advance: move wars through their phase timeline
-- KEYS:
-- 1 warStateKey   (HASH: war state)
--
-- ARGV:
-- 1 nowMs

local phase = redis.call('HGET', KEYS[1], 'phase')
if not phase or phase == '' or phase == 'ended' then
  return 'SKIP'
end

local nowMs = tonumber(ARGV[1]) or 0

if phase == 'prep' then
  local battleStart = tonumber(redis.call('HGET', KEYS[1], 'battleStartsAtMs') or '0') or 0
  if nowMs >= battleStart then
    redis.call('HSET', KEYS[1], 'phase', 'battle')
    return 'ADVANCED|battle'
  end
elseif phase == 'battle' then
  local cooldownStart = tonumber(redis.call('HGET', KEYS[1], 'cooldownStartsAtMs') or '0') or 0
  if nowMs >= cooldownStart then
    redis.call('HSET', KEYS[1], 'phase', 'cooldown')
    return 'ADVANCED|cooldown'
  end
elseif phase == 'cooldown' then
  local settlementStart = tonumber(redis.call('HGET', KEYS[1], 'settlementStartsAtMs') or '0') or 0
  if nowMs >= settlementStart then
    redis.call('HSET', KEYS[1], 'phase', 'settlement')
    return 'ADVANCED|settlement'
  end
elseif phase == 'settlement' then
  local endsAt = tonumber(redis.call('HGET', KEYS[1], 'endsAtMs') or '0') or 0
  if nowMs >= endsAt then
    redis.call('HSET', KEYS[1], 'phase', 'ended')
    return 'ADVANCED|ended'
  end
end

return 'NO_CHANGE|' .. phase
