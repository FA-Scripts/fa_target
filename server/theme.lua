local Theme = require 'shared.theme'
local Permissions = require 'server.permissions'
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
    return Permissions.isAdmin(source)
end)

lib.addCommand('fathemeadmin', {
    help = 'Open the FA Target server theme editor.',
    restricted = true,
}, function(source)
    if source == 0 then return end
    TriggerClientEvent('fa_target:openAdminTheme', source)
end)

RegisterNetEvent('fa_target:saveServerTheme', function(theme)
    local src = source
    if not Permissions.isAdmin(src) then return end
    serverTheme = Theme.sanitize(theme, serverTheme)
    SetResourceKvp(KVP_KEY, json.encode(serverTheme))
    TriggerClientEvent('fa_target:serverThemeChanged', -1, serverTheme)
end)
