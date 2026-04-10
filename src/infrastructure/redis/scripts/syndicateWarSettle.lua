-- War Settlement: resolve winner, transfer Infamy, record history, cleanup
-- KEYS:
-- 1  warStateKey            (HASH)
-- 2  infamyKey              (ZSET)
-- 3  attackerActiveWarKey   (STRING)
-- 4  defenderActiveWarKey   (STRING)
-- 5  attackerHistoryKey     (ZSET)
-- 6  defenderHistoryKey     (ZSET)
-- 7  attackerCooldownKey    (STRING)
-- 8  defenderCooldownKey    (STRING)
-- 9  activeWarsKey          (SET)
--
-- ARGV:
-- 1  warId
-- 2  nowMs
-- 3  cooldownDurationMs        (post-war cooldown for re-declaring)
-- 4  underdogStealMinBps
-- 5  underdogStealMaxBps
-- 6  favouriteGainBps
-- 7  warTtlSec                 (how long to keep war state hash)

local settled = redis.call('HGET', KEYS[1], 'settled')
if settled == '1' then
  return 'ALREADY_SETTLED'
end

local phase = redis.call('HGET', KEYS[1], 'phase')
if phase ~= 'settlement' and phase ~= 'ended' then
  return 'NOT_READY'
end

local attackerSid = redis.call('HGET', KEYS[1], 'attackerSyndicateId')
local defenderSid = redis.call('HGET', KEYS[1], 'defenderSyndicateId')
local attackerStars = tonumber(redis.call('HGET', KEYS[1], 'attackerStars') or '0') or 0
local defenderStars = tonumber(redis.call('HGET', KEYS[1], 'defenderStars') or '0') or 0
local attackerDestBps = tonumber(redis.call('HGET', KEYS[1], 'attackerDestructionBps') or '0') or 0
local defenderDestBps = tonumber(redis.call('HGET', KEYS[1], 'defenderDestructionBps') or '0') or 0

-- Determine winner: most stars wins; tie-break by destruction %
local winner = 'draw'
local winnerSid = ''
local loserSid = ''
if attackerStars > defenderStars then
  winner = 'attacker'
  winnerSid = attackerSid
  loserSid = defenderSid
elseif defenderStars > attackerStars then
  winner = 'defender'
  winnerSid = defenderSid
  loserSid = attackerSid
elseif defenderDestBps > attackerDestBps then
  winner = 'attacker'
  winnerSid = attackerSid
  loserSid = defenderSid
elseif attackerDestBps > defenderDestBps then
  winner = 'defender'
  winnerSid = defenderSid
  loserSid = attackerSid
end

-- Infamy transfer
local nowMs = tonumber(ARGV[2]) or 0
local underdogMinBps = tonumber(ARGV[4]) or 2500
local underdogMaxBps = tonumber(ARGV[5]) or 4000
local favGainBps = tonumber(ARGV[6]) or 500

local infamyDelta = 0
if winner ~= 'draw' and winnerSid ~= '' then
  local winnerInf = tonumber(redis.call('ZSCORE', KEYS[2], winnerSid) or '1000') or 1000
  local loserInf = tonumber(redis.call('ZSCORE', KEYS[2], loserSid) or '1000') or 1000

  if winnerInf <= loserInf then
    -- Underdog wins: steal 25–40% of diff + base 50
    local diff = loserInf - winnerInf
    -- Use a deterministic pseudo-random (based on warId hash via nowMs)
    local range = underdogMaxBps - underdogMinBps
    local pctBps = underdogMinBps + (nowMs % (range + 1))
    infamyDelta = math.floor((diff + 50) * pctBps / 10000)
    if infamyDelta < 1 then infamyDelta = 1 end
  else
    -- Favourite wins: gains flat 5% of loser infamy (capped at 50)
    infamyDelta = math.floor(loserInf * favGainBps / 10000)
    if infamyDelta > 50 then infamyDelta = 50 end
    if infamyDelta < 1 then infamyDelta = 1 end
  end

  redis.call('ZINCRBY', KEYS[2], infamyDelta, winnerSid)
  redis.call('ZINCRBY', KEYS[2], -infamyDelta, loserSid)

  -- Floor loser infamy at 100
  local loserNew = tonumber(redis.call('ZSCORE', KEYS[2], loserSid) or '100') or 100
  if loserNew < 100 then
    redis.call('ZADD', KEYS[2], 100, loserSid)
  end
end

-- Mark settled
redis.call('HSET', KEYS[1], 'settled', '1')
redis.call('HSET', KEYS[1], 'phase', 'ended')
redis.call('HSET', KEYS[1], 'winner', winner)
redis.call('HSET', KEYS[1], 'infamyDelta', tostring(infamyDelta))

-- Set TTL on war state (keep for reference but eventually expire)
local warTtlSec = tonumber(ARGV[7]) or 604800 -- 7 days default
redis.call('EXPIRE', KEYS[1], warTtlSec)

-- War history
redis.call('ZADD', KEYS[5], nowMs, ARGV[1])
redis.call('ZADD', KEYS[6], nowMs, ARGV[1])

-- Clear active war
redis.call('DEL', KEYS[3])
redis.call('DEL', KEYS[4])

-- Set post-war cooldown
local cdMs = tonumber(ARGV[3]) or 3600000
redis.call('SET', KEYS[7], tostring(nowMs + cdMs), 'PX', cdMs + 60000)
redis.call('SET', KEYS[8], tostring(nowMs + cdMs), 'PX', cdMs + 60000)

-- Remove from active wars index
redis.call('SREM', KEYS[9], ARGV[1])

return 'SETTLED|' .. winner .. '|' .. tostring(infamyDelta) .. '|' .. winnerSid .. '|' .. loserSid
