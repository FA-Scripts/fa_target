local Theme = require 'shared.theme'
local TargetState = require 'client.state'
local KVP_KEY = 'fa_target:playerTheme'
local serverTheme = Theme.sanitize(Config.Theme.default)
local playerTheme
local allowedFields = {}
local allowPlayerCustomization = false
local editorSnapshot
local editorAdmin = false
local editorOpen = false
local modeSwitcher
local modeKey = 'fa_target:interactionMode'
local modes = { focus = true, classic = true, dui = true }

local function applyMode(mode)
    if not modes[mode] then return false end
    if mode == Config.Interaction.mode then return true end
    if not Config.Interaction.allowPlayerModeSwitch then return false end
    local expires = GetGameTimer() + 5000
    while not modeSwitcher and GetGameTimer() < expires do Wait(0) end
    return modeSwitcher and modeSwitcher(mode) or false
end

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
    editorOpen = true
    editorAdmin = admin == true
    editorSnapshot = effectiveTheme()
    TargetState.setNuiFocus(false, false)
    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({
        event = 'themeEditor', state = true, admin = editorAdmin,
        theme = editorSnapshot, allowed = editorAdmin and nil or allowedFields,
        resetTheme = editorAdmin and Theme.sanitize(Config.Theme.default) or serverTheme,
        presets = { 'precision', 'minimal', 'glass', 'classic' },
        fonts = Theme.getFonts(),
        interactionMode = Config.Interaction.mode,
        allowModeSwitch = Config.Interaction.allowPlayerModeSwitch == true,
    })
end

RegisterCommand(Config.Theme.commandName, function()
    if allowPlayerCustomization or Config.Interaction.allowPlayerModeSwitch then openEditor(false) end
end, false)

RegisterNetEvent('fa_target:openAdminTheme', function()
    lib.callback('fa_target:canEditTheme', false, function(allowed)
        if allowed then openEditor(true) end
    end)
end)

RegisterNUICallback('previewTheme', function(data, cb)
    local preview = editorAdmin and Theme.sanitize(data, Config.Theme.default)
        or Theme.merge(serverTheme, data, allowedFields)
    SendNUIMessage({ event = 'theme', theme = preview, fonts = Theme.getFonts() })
    cb({ ok = true, theme = preview })
end)

RegisterNUICallback('saveTheme', function(data, cb)
    if not editorOpen or type(data) ~= 'table' then cb({ ok = false }) return end
    local requestedMode = data.interactionMode
    if requestedMode ~= nil and (not modes[requestedMode] or requestedMode ~= Config.Interaction.mode and not Config.Interaction.allowPlayerModeSwitch) then
        cb({ ok = false }) return
    end
    local previousMode = Config.Interaction.mode
    local modeChanged = requestedMode and Config.Interaction.allowPlayerModeSwitch and requestedMode ~= previousMode
    if modeChanged and not applyMode(requestedMode) then cb({ ok = false }) return end
    local theme = Theme.sanitize(data, editorSnapshot)
    if editorAdmin then
        local success, result = pcall(lib.callback.await, 'fa_target:saveTheme', false, theme)
        if not success or type(result) ~= 'table' or result.ok ~= true then
            if modeChanged then applyMode(previousMode) end
            cb({ ok = false })
            return
        end
        serverTheme = Theme.sanitize(result.theme, serverTheme)
    elseif allowPlayerCustomization then
        playerTheme = Theme.merge(serverTheme, theme, allowedFields)
        SetResourceKvp(KVP_KEY, json.encode(playerTheme))
        pushTheme()
    elseif not Config.Interaction.allowPlayerModeSwitch then
        cb({ ok = false })
        return
    end
    if requestedMode and Config.Interaction.allowPlayerModeSwitch then
        SetResourceKvp(modeKey, requestedMode)
    end
    editorOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ event = 'themeEditor', state = false })
    cb({ ok = true, theme = effectiveTheme() })
end)

RegisterNUICallback('cancelTheme', function(_, cb)
    editorOpen = false
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
    local remoteTheme, enabled, allowed, policy = lib.callback.await('fa_target:getTheme', false)
    serverTheme = Theme.sanitize(remoteTheme, serverTheme)
    allowPlayerCustomization = enabled == true
    allowedFields = enabled and (allowed or {}) or {}
    Config.Interaction.allowPlayerModeSwitch = type(policy) == 'table' and policy.allowPlayerModeSwitch == true
    local savedMode = GetResourceKvpString(modeKey)
    if Config.Interaction.allowPlayerModeSwitch and modes[savedMode] then applyMode(savedMode) end
    pushTheme()
end)

return { get = effectiveTheme, getFonts = Theme.getFonts, push = pushTheme, isEditorOpen = function() return editorOpen end,
    setModeSwitcher = function(callback) modeSwitcher = callback end }
