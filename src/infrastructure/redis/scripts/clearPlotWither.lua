-- Clear wither flag so plot can be planted again (atomic, idempotent)
-- KEYS[1] plotKey
-- KEYS[2] idempKey
-- ARGV[1] idempTtlSec

local cached = redis.call('GET', KEYS[2])
if cached then
  return cached
end

local w = redis.call('HGET', KEYS[1], 'wither')
if w ~= '1' then
  return redis.error_reply('ERR_NOT_WITHERED')
end

local cropId = redis.call('HGET', KEYS[1], 'cropId')
if type(cropId) == 'string' and cropId ~= '' then
  return redis.error_reply('ERR_PLOT_OCCUPIED')
end

redis.call('DEL', KEYS[1])

local payload = 'OK'
redis.call('SET', KEYS[2], payload, 'EX', tonumber(ARGV[1]) or 60)
return payload
