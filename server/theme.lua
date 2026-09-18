local Theme = require 'shared.theme'
local KVP_KEY = 'fa_target:serverTheme'
local serverTheme = Theme.sanitize(Config.Theme.default)

local stored = GetResourceKvpString(KVP_KEY)
if stored then
    local ok, decoded = pcall(json.decode, stored)
    if ok then serverTheme = Theme.sanitize(decoded, serverTheme) end
end

lib.callback.register('fa_target:getTheme', function()
    return serverTheme, Config.Theme.allowPlayerCustomization, Config.Theme.allowedPlayerFields
end)

lib.callback.register('fa_target:canEditTheme', function(source)
    return source == 0 or IsPlayerAceAllowed(source, 'fa_target.theme')
end)

RegisterNetEvent('fa_target:saveServerTheme', function(theme)
    local src = source
    if src ~= 0 and not IsPlayerAceAllowed(src, 'fa_target.theme') then return end
    serverTheme = Theme.sanitize(theme, serverTheme)
    SetResourceKvp(KVP_KEY, json.encode(serverTheme))
    TriggerClientEvent('fa_target:serverThemeChanged', -1, serverTheme)
end)
