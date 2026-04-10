-- War Attack: resolve troop deployment against defender
-- KEYS:
-- 1  warStateKey         (HASH: war state)
-- 2  attackCountKey      (HASH: userId → attack count)
-- 3  attackLogKey        (LIST: attack records)
-- 4  attackerBankGoldKey (STRING: attacker syndicate bank gold)
-- 5  defenderBankGoldKey (STRING: defender syndicate bank gold)
-- 6  defenderBankItemsKey(HASH: defender syndicate bank items)
-- 7  attackerBankItemsKey(HASH: attacker syndicate bank items)
-- 8  userSyndicateKey    (STRING: user's syndicate id)
-- 9  defenderShieldsKey  (HASH: shield type → expiry)
-- 10 defenderDefPowerKey (STRING: base defense power)
-- 11 idempKey            (STRING: idempotency)
--
-- ARGV:
-- 1  userId
-- 2  warId
-- 3  targetSyndicateId
-- 4  troopsCsv           (type:count,type:count,...)
-- 5  nowMs
-- 6  maxAttacks
-- 7  idempTtlSec
-- 8  troopPowerCsv       (type:basePower,type:basePower,...)
-- 9  star1Bps
-- 10 star2Bps
-- 11 star3Bps
-- 12 militiaSurgeBonusBps
-- 13 cropDecoyReduceBps

local existing = redis.call('GET', KEYS[11])
if existing then
  return existing
end

-- Validate war phase = battle
local phase = redis.call('HGET', KEYS[1], 'phase')
if phase ~= 'battle' then
  return redis.error_reply('ERR_WAR_NOT_IN_BATTLE')
end

local nowMs = tonumber(ARGV[5]) or 0
local battleStart = tonumber(redis.call('HGET', KEYS[1], 'battleStartsAtMs') or '0') or 0
local cooldownStart = tonumber(redis.call('HGET', KEYS[1], 'cooldownStartsAtMs') or '0') or 0
if nowMs < battleStart or nowMs >= cooldownStart then
  return redis.error_reply('ERR_WAR_NOT_IN_BATTLE')
end

-- Check user is in attacker syndicate
local userSid = redis.call('GET', KEYS[8])
if not userSid or userSid == '' then
  return redis.error_reply('ERR_NOT_IN_SYNDICATE')
end

local warAttackerSid = redis.call('HGET', KEYS[1], 'attackerSyndicateId')
local warDefenderSid = redis.call('HGET', KEYS[1], 'defenderSyndicateId')

-- Determine which side the user is on
local isSideA = (userSid == warAttackerSid)
local isSideB = (userSid == warDefenderSid)
if not isSideA and not isSideB then
  return redis.error_reply('ERR_NOT_IN_WAR')
end

-- Verify target is the opposing syndicate
if isSideA and ARGV[3] ~= warDefenderSid then
  return redis.error_reply('ERR_BAD_ARGS')
end
if isSideB and ARGV[3] ~= warAttackerSid then
  return redis.error_reply('ERR_BAD_ARGS')
end

-- Check attack count
local maxAttacks = tonumber(ARGV[6]) or 2
local curAttacks = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0') or 0
if curAttacks >= maxAttacks then
  return redis.error_reply('ERR_MAX_ATTACKS_REACHED')
end

-- Parse troop power table
local troopPower = {}
for pair in string.gmatch(ARGV[8], '([^,]+)') do
  local sep = string.find(pair, ':')
  if sep then
    local t = string.sub(pair, 1, sep - 1)
    local p = tonumber(string.sub(pair, sep + 1)) or 0
    troopPower[t] = p
  end
end

-- Calculate total attack power from troops
local totalAtkPower = 0
local hasSiege = false
for pair in string.gmatch(ARGV[4], '([^,]+)') do
  local sep = string.find(pair, ':')
  if sep then
    local ttype = string.sub(pair, 1, sep - 1)
    local tcount = tonumber(string.sub(pair, sep + 1)) or 0
    local base = troopPower[ttype] or 10
    totalAtkPower = totalAtkPower + (tcount * base)
    if ttype == 'siege_harvester' then hasSiege = true end
  end
end

-- Get defense power and parse shields
local baseDef = tonumber(redis.call('GET', KEYS[10]) or '100') or 100
if baseDef < 1 then baseDef = 100 end

-- Check militia surge
local militiaSurgeBonusBps = tonumber(ARGV[12]) or 5000
local surgeExp = tonumber(redis.call('HGET', KEYS[9], 'militia_surge') or '0') or 0
local effectiveDef = baseDef
if surgeExp > nowMs then
  effectiveDef = baseDef + math.floor(baseDef * militiaSurgeBonusBps / 10000)
end

-- Calculate destruction basis points (0-10000)
local destructionBps = 0
if effectiveDef > 0 then
  destructionBps = math.floor(totalAtkPower * 10000 / effectiveDef)
end
if destructionBps > 10000 then destructionBps = 10000 end
if destructionBps < 0 then destructionBps = 0 end

-- Calculate stars
local star1 = tonumber(ARGV[9]) or 5000
local star2 = tonumber(ARGV[10]) or 7500
local star3 = tonumber(ARGV[11]) or 10000
local stars = 0
if destructionBps >= star3 then
  stars = 3
elseif destructionBps >= star2 then
  stars = 2
elseif destructionBps >= star1 or (hasSiege and destructionBps >= 2500) then
  stars = 1
end

-- Calculate loot
local cropDecoyReduceBps = tonumber(ARGV[13]) or 7500
local decoyExp = tonumber(redis.call('HGET', KEYS[9], 'crop_decoy') or '0') or 0
local decoyActive = (decoyExp > nowMs)
local vaultExp = tonumber(redis.call('HGET', KEYS[9], 'gold_vault_lock') or '0') or 0
local vaultActive = (vaultExp > nowMs)

-- Gold loot
local defGold = tonumber(redis.call('GET', KEYS[5]) or '0') or 0
local lootGold = math.floor(defGold * destructionBps / 10000)
if decoyActive then
  lootGold = math.floor(lootGold * (10000 - cropDecoyReduceBps) / 10000)
end
if vaultActive then
  lootGold = 0
end
if lootGold > 0 then
  redis.call('DECRBY', KEYS[5], lootGold)
  redis.call('INCRBY', KEYS[4], lootGold)
end

-- Item loot (take proportional % of each item in defender bank)
local defItems = redis.call('HGETALL', KEYS[6])
local lootItemParts = {}
for i = 1, #defItems, 2 do
  local itemId = defItems[i]
  local qty = tonumber(defItems[i + 1]) or 0
  local take = math.floor(qty * destructionBps / 10000)
  if decoyActive then
    take = math.floor(take * (10000 - cropDecoyReduceBps) / 10000)
  end
  if take > 0 then
    redis.call('HINCRBY', KEYS[6], itemId, -take)
    redis.call('HINCRBY', KEYS[7], itemId, take)
    table.insert(lootItemParts, itemId .. ':' .. tostring(take))
  end
end

-- Increment attack count
redis.call('HINCRBY', KEYS[2], ARGV[1], 1)

-- Update war-level best stars + cumulative destruction
local starsField = isSideA and 'attackerStars' or 'defenderStars'
local destField = isSideA and 'defenderDestructionBps' or 'attackerDestructionBps'
local curBestStars = tonumber(redis.call('HGET', KEYS[1], starsField) or '0') or 0
if stars > curBestStars then
  redis.call('HSET', KEYS[1], starsField, tostring(stars))
end
local curDest = tonumber(redis.call('HGET', KEYS[1], destField) or '0') or 0
local newDest = curDest + destructionBps
if newDest > 10000 then newDest = 10000 end
redis.call('HSET', KEYS[1], destField, tostring(newDest))

-- Log attack
local attackSeq = redis.call('LLEN', KEYS[3]) + 1
local attackId = ARGV[2] .. '_atk_' .. tostring(attackSeq)
local lootItemStr = table.concat(lootItemParts, ';')
local logLine = attackId .. '|' .. ARGV[1] .. '|' .. userSid .. '|' .. ARGV[3] .. '|' .. ARGV[4] .. '|' .. tostring(stars) .. '|' .. tostring(destructionBps) .. '|' .. tostring(lootGold) .. '|' .. lootItemStr .. '|' .. tostring(nowMs)
redis.call('RPUSH', KEYS[3], logLine)

local reply = 'OK|' .. attackId .. '|' .. tostring(stars) .. '|' .. tostring(destructionBps) .. '|' .. tostring(lootGold) .. '|' .. lootItemStr
redis.call('SET', KEYS[11], reply, 'EX', tonumber(ARGV[7]) or 60)
return reply
