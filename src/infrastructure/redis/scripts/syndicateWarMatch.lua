-- War Matchmaking: find two compatible syndicates and create war
-- KEYS:
-- 1 matchmakingKey    (ZSET: syndicateId → infamy)
-- 2 warSeqKey         (STRING: war sequence counter)
-- 3 activeWarsKey     (SET: active war IDs)
--
-- ARGV:
-- 1 bracketPct        (tolerance percentage, e.g. 10)
-- 2 nowMs
-- 3 prepDurationMs
-- 4 battleDurationMs
-- 5 cooldownDurationMs
-- 6 settlementDurationMs

-- Get all queued syndicates sorted by infamy
local members = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', '+inf', 'WITHSCORES')
local count = #members / 2
if count < 2 then
  return 'NO_MATCH'
end

local bracketPct = tonumber(ARGV[1]) or 10
local matched1 = nil
local matched2 = nil
local best_diff = math.huge

-- Find closest pair within bracket
for i = 0, count - 2 do
  local sid1 = members[i * 2 + 1]
  local inf1 = tonumber(members[i * 2 + 2]) or 0
  local sid2 = members[(i + 1) * 2 + 1]
  local inf2 = tonumber(members[(i + 1) * 2 + 2]) or 0

  local maxInf = math.max(inf1, inf2)
  local diff = math.abs(inf1 - inf2)
  local tolerance = maxInf * bracketPct / 100

  if diff <= tolerance and diff < best_diff then
    best_diff = diff
    matched1 = { sid = sid1, infamy = inf1 }
    matched2 = { sid = sid2, infamy = inf2 }
  end
end

if not matched1 then
  return 'NO_MATCH'
end

-- Remove from queue
redis.call('ZREM', KEYS[1], matched1.sid)
redis.call('ZREM', KEYS[1], matched2.sid)

-- Generate war ID
local seq = redis.call('INCR', KEYS[2])
local warId = 'war_' .. tostring(seq)

-- Calculate phase timestamps
local nowMs = tonumber(ARGV[2]) or 0
local prepDur = tonumber(ARGV[3]) or 3600000
local battleDur = tonumber(ARGV[4]) or 14400000
local cooldownDur = tonumber(ARGV[5]) or 1800000
local settlementDur = tonumber(ARGV[6]) or 1800000

local prepStart = nowMs
local battleStart = prepStart + prepDur
local cooldownStart = battleStart + battleDur
local settlementStart = cooldownStart + cooldownDur
local endsAt = settlementStart + settlementDur

-- Create war state hash
local warKey = 'ravolo:war:' .. warId
redis.call('HMSET', warKey,
  'warId', warId,
  'attackerSyndicateId', matched1.sid,
  'defenderSyndicateId', matched2.sid,
  'phase', 'prep',
  'declaredAtMs', tostring(nowMs),
  'prepStartsAtMs', tostring(prepStart),
  'battleStartsAtMs', tostring(battleStart),
  'cooldownStartsAtMs', tostring(cooldownStart),
  'settlementStartsAtMs', tostring(settlementStart),
  'endsAtMs', tostring(endsAt),
  'attackerInfamy', tostring(matched1.infamy),
  'defenderInfamy', tostring(matched2.infamy),
  'attackerStars', '0',
  'defenderStars', '0',
  'attackerDestructionBps', '0',
  'defenderDestructionBps', '0',
  'settled', '0'
)

-- Set active war for both syndicates
local activeKey1 = 'ravolo:syndicate:' .. matched1.sid .. ':active_war'
local activeKey2 = 'ravolo:syndicate:' .. matched2.sid .. ':active_war'
redis.call('SET', activeKey1, warId)
redis.call('SET', activeKey2, warId)

-- Add to active wars index
redis.call('SADD', KEYS[3], warId)

return 'MATCHED|' .. warId .. '|' .. matched1.sid .. '|' .. matched2.sid .. '|' .. tostring(matched1.infamy) .. '|' .. tostring(matched2.infamy)
