local Theme = require 'shared.theme'
local KVP_KEY = 'fa_target:playerTheme'
local serverTheme = Theme.sanitize(Config.Theme.default)
local playerTheme
local allowedFields = {}
local allowPlayerCustomization = false
local editorSnapshot
local editorAdmin = false

local function decodeStored()
    local stored = GetResourceKvpString(KVP_KEY)
    if not stored then return end
    local ok, decoded = pcall(json.decode, stored)
    if ok then return decoded end
end

local function effectiveTheme()
    if not allowPlayerCustomization then return serverTheme end
    return Theme.merge(serverTheme, playerTheme, allowedFields)
end

local function pushTheme()
    SendNUIMessage({ event = 'theme', theme = effectiveTheme(), fonts = Theme.getFonts() })
end

local function openEditor(admin)
    editorAdmin = admin == true
    editorSnapshot = effectiveTheme()
    SetNuiFocus(true, true)
    SendNUIMessage({
        event = 'themeEditor', state = true, admin = editorAdmin,
        theme = editorSnapshot, allowed = editorAdmin and nil or allowedFields,
        resetTheme = editorAdmin and Theme.sanitize(Config.Theme.default) or serverTheme,
        presets = { 'precision', 'minimal', 'glass', 'compact', 'classic' },
        fonts = Theme.getFonts(),
    })
end

RegisterCommand('fatheme', function()
    if allowPlayerCustomization then openEditor(false) end
end, false)

RegisterCommand('fathemeadmin', function()
    lib.callback('fa_target:canEditTheme', false, function(allowed)
        if allowed then openEditor(true) end
    end)
end, false)

RegisterNUICallback('previewTheme', function(data, cb)
    local preview = editorAdmin and Theme.sanitize(data, Config.Theme.default)
        or Theme.merge(serverTheme, data, allowedFields)
    SendNUIMessage({ event = 'theme', theme = preview, fonts = Theme.getFonts() })
    cb({ ok = true, theme = preview })
end)

RegisterNUICallback('saveTheme', function(data, cb)
    local theme = Theme.sanitize(data, editorSnapshot)
    if editorAdmin then
        TriggerServerEvent('fa_target:saveServerTheme', theme)
    elseif allowPlayerCustomization then
        playerTheme = theme
        SetResourceKvp(KVP_KEY, json.encode(playerTheme))
        pushTheme()
    end
    SetNuiFocus(false, false)
    SendNUIMessage({ event = 'themeEditor', state = false })
    cb({ ok = true, theme = effectiveTheme() })
end)

RegisterNUICallback('cancelTheme', function(_, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ event = 'themeEditor', state = false })
    pushTheme()
    cb({ ok = true })
end)

RegisterNetEvent('fa_target:serverThemeChanged', function(theme)
    serverTheme = Theme.sanitize(theme, serverTheme)
    pushTheme()
end)

CreateThread(function()
    playerTheme = decodeStored()
    local remoteTheme, enabled, allowed = lib.callback.await('fa_target:getTheme', false)
    serverTheme = Theme.sanitize(remoteTheme, serverTheme)
    allowPlayerCustomization = enabled == true
    allowedFields = allowed or {}
    pushTheme()
end)

return { get = effectiveTheme, getFonts = Theme.getFonts, push = pushTheme }
