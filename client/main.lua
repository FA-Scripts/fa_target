if not lib.checkDependency('ox_lib', '3.30.0', true) then return end

lib.locale()

local utils = require 'client.utils'
local state = require 'client.state'
local options = require 'client.api'.getTargetOptions()
local theme = require 'client.theme'

require 'client.debug'
require 'client.defaults'
require 'client.compat.qtarget'

local SendNuiMessage = SendNuiMessage
local GetEntityCoords = GetEntityCoords
local GetEntityType = GetEntityType
local HasEntityClearLosToEntity = HasEntityClearLosToEntity
local GetEntityBoneIndexByName = GetEntityBoneIndexByName
local GetEntityBonePosition_2 = GetEntityBonePosition_2
local GetEntityModel = GetEntityModel
local IsDisabledControlJustPressed = IsDisabledControlJustPressed
local DisableControlAction = DisableControlAction
local DisablePlayerFiring = DisablePlayerFiring
local GetModelDimensions = GetModelDimensions
local GetOffsetFromEntityInWorldCoords = GetOffsetFromEntityInWorldCoords
local currentTarget = {}
local currentMenu
local menuChanged
local actionStateChanged = false
local targetingSession = false
local inputSession = false
local targetingGeneration = 0
local switchingMode = false
local menuHistory = {}
local nearbyZones
local currentRequestId
local pendingActions = {}
local classicEngaged = false
local visibleTargets = {}
local inputHolds = {}
local outlinedEntity
local selectOption
local lastAnchorX, lastAnchorY, lastAnchorVisible

-- Toggle ox_target, instead of holding the hotkey
local toggleHotkey = GetConvarInt('fa_target:toggleHotkey',
    GetConvarInt('ox_target:toggleHotkey', Config.Interaction.toggle and 1 or 0)) == 1
local mouseButton = GetConvarInt('fa_target:leftClick', GetConvarInt('ox_target:leftClick', 1)) == 1 and 24 or 25
local debug = GetConvarInt('fa_target:debug', GetConvarInt('ox_target:debug', 0)) == 1
local vec0 = vec3(0, 0, 0)
local stateWarnings = setmetatable({}, { __mode = 'k' })

local function unavailableState(option, status, reason, remainingMs)
    local seconds = remainingMs and math.ceil(remainingMs / 1000)
    option.interactionState = {
        status = status, reason = reason or locale('state_' .. status),
        remainingMs = seconds and seconds * 1000 or nil,
    }
    option._stateToken = status .. ':' .. option.interactionState.reason .. ':' .. (seconds or '')
    return (option.unavailable or Config.Interaction.unavailable or 'hide') == 'hide'
end

local function warnState(option, callback)
    local now = GetGameTimer()
    if not stateWarnings[option] or now - stateWarnings[option] > 5000 then
        stateWarnings[option] = now
        utils.warn(('Invalid or failed %s for option %s; option hidden'):format(callback, option.name or option.label or 'unnamed'))
    end
end

local function nuiOptions(groups)
    local result = {}
    for groupName, list in pairs(groups) do
        result[groupName] = {}
        for i = 1, #list do
            local copy = {}
            for key, value in pairs(list[i]) do
                if type(value) ~= 'function' and key ~= '_stateToken' then copy[key] = value end
            end
            result[groupName][i] = copy
        end
    end
    return result
end

local function getTargetAnchor(entity, coords, targetZones)
    if entity and entity > 0 and DoesEntityExist(entity) then
        local entityCoords = GetEntityCoords(entity)
        coords = vec3(entityCoords.x, entityCoords.y, entityCoords.z + 0.5)
    elseif targetZones then
        for i = 1, #targetZones do
            local zone = targetZones[i]
            local zoneOptions = zone.options

            for j = 1, #zoneOptions do
                if not zoneOptions[j].hide then
                    coords = zone.coords
                    goto zoneAnchorFound
                end
            end
        end
    end

    ::zoneAnchorFound::
    if not coords then return { visible = false } end

    local cameraCoords = GetGameplayCamCoord()
    local cameraRotation = GetGameplayCamRot(2)
    local pitch = math.rad(cameraRotation.x)
    local yaw = math.rad(cameraRotation.z)
    local cosPitch = math.cos(pitch)
    local sinPitch = math.sin(pitch)
    local cosYaw = math.cos(yaw)
    local sinYaw = math.sin(yaw)
    local relativeX = coords.x - cameraCoords.x
    local relativeY = coords.y - cameraCoords.y
    local relativeZ = coords.z - cameraCoords.z
    local depth = relativeX * (-sinYaw * cosPitch) + relativeY * (cosYaw * cosPitch) + relativeZ * sinPitch

    if depth <= 0.05 then
        return { visible = false }
    end

    local horizontal = relativeX * cosYaw + relativeY * sinYaw
    local vertical = relativeX * (sinYaw * sinPitch) + relativeY * (-cosYaw * sinPitch) + relativeZ * cosPitch
    local fovScale = math.tan(math.rad(GetGameplayCamFov()) * 0.5)
    local aspectRatio = GetAspectRatio(false)
    if fovScale <= 0 or aspectRatio <= 0 then return { visible = false } end

    local screenX = 0.5 + horizontal / (depth * fovScale * aspectRatio) * 0.5
    local screenY = 0.5 - vertical / (depth * fovScale) * 0.5
    if screenX ~= screenX or screenY ~= screenY or screenX < 0 or screenX > 1 or screenY < 0 or screenY > 1 then
        return { visible = false }
    end

    return { visible = true, x = screenX, y = screenY }
end

---@param option OxTargetOption
---@param distance number
---@param endCoords vector3
---@param entityHit? number
---@param entityType? number
---@param entityModel? number | false
local function shouldHide(option, distance, endCoords, entityHit, entityType, entityModel)
    option.interactionState, option._stateToken = nil, nil
    local inheritedMode = Config.Interaction.resourceModes[option.resource] or Config.Interaction.mode
    local optionMode = option.mode == 'inherit' and inheritedMode or option.mode or inheritedMode
    if optionMode == 'classic' and Config.Interaction.mode ~= 'classic' and not classicEngaged then return true end
    if option.menuName ~= currentMenu then
        return true
    end

    if distance > (option.distance or 7) then
        return true
    end

    if entityModel and Config.Interaction.hideExternalEntitiesInVehicle and cache.vehicle
        and entityHit ~= cache.vehicle then
        return true
    end

    local bone = entityModel and option.bones or nil

    if bone then
        ---@cast entityHit number
        ---@cast entityType number
        ---@cast entityModel number

        local _type = type(bone)

        if _type == 'string' then
            local boneId = GetEntityBoneIndexByName(entityHit, bone)

            if boneId ~= -1 and #(endCoords - GetEntityBonePosition_2(entityHit, boneId)) <= 2 then
                bone = boneId
            else
                return true
            end
        elseif _type == 'table' then
            local closestBone, boneDistance

            for j = 1, #bone do
                local boneId = GetEntityBoneIndexByName(entityHit, bone[j])

                if boneId ~= -1 then
                    local dist = #(endCoords - GetEntityBonePosition_2(entityHit, boneId))

                    if dist <= (boneDistance or 1) then
                        closestBone = boneId
                        boneDistance = dist
                    end
                end
            end

            if closestBone then
                bone = closestBone
            else
                return true
            end
        end
    end

    local offset = entityModel and option.offset or nil

    if offset then
        ---@cast entityHit number
        ---@cast entityType number
        ---@cast entityModel number

        if not option.absoluteOffset then
            local min, max = GetModelDimensions(entityModel)
            offset = (max - min) * offset + min
        end

        offset = GetOffsetFromEntityInWorldCoords(entityHit, offset.x, offset.y, offset.z)

        if #(endCoords - offset) > (option.offsetSize or 1) then
            return true
        end
    end

    if option.canInteract then
        local success, resp = pcall(option.canInteract, entityHit, distance, endCoords, option.name, bone)
        if not success then warnState(option, 'canInteract') return true end
        if not resp then return true end
    end

    if option.groups and not utils.hasPlayerGotGroup(option.groups) then return unavailableState(option, 'noPermission') end
    if option.items and not utils.hasPlayerGotItems(option.items, option.anyItem) then return unavailableState(option, 'missingItem') end
    if option.disabled then return unavailableState(option, 'disabled') end

    if option.getState then
        local success, result = pcall(option.getState, entityHit, distance, endCoords, option.name, bone)
        local statuses = { available = true, disabled = true, cooldown = true, missingItem = true, noPermission = true }
        if not success or type(result) ~= 'table' or not statuses[result.status] then
            warnState(option, 'getState')
            return true
        end
        if result.status ~= 'available' then
            local remaining = tonumber(result.remainingMs)
            if remaining and (remaining ~= remaining or remaining == math.huge or remaining == -math.huge) then remaining = nil end
            remaining = remaining and math.max(0, math.min(86400000, remaining)) or nil
            local reason = type(result.reason) == 'string' and result.reason:match('%S') and result.reason:sub(1, 160) or nil
            if result.status == 'cooldown' and remaining and not reason then reason = locale('state_cooldown_seconds', math.ceil(remaining / 1000)) end
            return unavailableState(option, result.status, reason, remaining)
        end
    end
    option.interactionState = { status = 'available' }
    option._stateToken = 'available'
    return false
end

local optionGroups = { '__global', 'entity', 'globalTarget', 'localEntity', 'model' }

local function rebuildVisibleTargets(zones)
    table.wipe(visibleTargets)

    for groupIndex = 1, #optionGroups do
        local targetType = optionGroups[groupIndex]
        local group = options[targetType]

        if group then
            for optionIndex = 1, #group do
                local option = group[optionIndex]
                if not option.hide then
                    visibleTargets[#visibleTargets + 1] = {
                        option = option,
                        targetType = targetType,
                        targetId = optionIndex,
                    }
                end
            end
        end
    end

    for zoneIndex = 1, #zones do
        local zoneOptions = zones[zoneIndex]
        for optionIndex = 1, #zoneOptions do
            local option = zoneOptions[optionIndex]
            if not option.hide then
                visibleTargets[#visibleTargets + 1] = {
                    option = option,
                    targetType = 'zones',
                    targetId = optionIndex,
                    zoneId = zoneIndex,
                }
            end
        end
    end

    for i = 1, #visibleTargets do visibleTargets[i].slot = i end
end

local function handleTargetInput(inputId, target, pressed)
    if not target then return end
    local holdDuration = tonumber(target.option.hold) or 0

    if pressed then
        if theme.isEditorOpen() then return end
        if target.option.hide or target.option.interactionState and target.option.interactionState.status ~= 'available' then return end
        if inputHolds[inputId] then return end
        if holdDuration <= 0 then
            selectOption({ target.targetType, target.targetId, target.zoneId })
            return
        end

        local hold = { target = target, duration = holdDuration }
        inputHolds[inputId] = hold
        SendNUIMessage({ event = 'holdVisual', slot = target.slot, pressed = true, duration = holdDuration })
        CreateThread(function()
            Wait(holdDuration)
            if inputHolds[inputId] ~= hold then return end
            inputHolds[inputId] = nil
            SendNUIMessage({ event = 'holdVisual', slot = target.slot, pressed = false })
            selectOption({ target.targetType, target.targetId, target.zoneId })
        end)
        return
    end

    local held = inputHolds[inputId]
    if not held then return end
    inputHolds[inputId] = nil
    SendNUIMessage({ event = 'holdVisual', slot = held.target.slot, pressed = false })
end

local function clearInputHolds()
    for inputId, held in pairs(inputHolds) do
        SendNUIMessage({ event = 'holdVisual', slot = held.target.slot, pressed = false })
        inputHolds[inputId] = nil
    end
end

local function setOutlinedEntity(entity)
    if outlinedEntity == entity then return end
    if outlinedEntity and outlinedEntity > 0 and DoesEntityExist(outlinedEntity) then
        SetEntityDrawOutline(outlinedEntity, false)
    end
    outlinedEntity = entity and entity > 0 and entity or nil
    if outlinedEntity and DoesEntityExist(outlinedEntity) then SetEntityDrawOutline(outlinedEntity, true) end
end

AddEventHandler('fa_target:inputKey', function(key, pressed)
    key = key:upper()
    for i = 1, #visibleTargets do
        local optionKey = visibleTargets[i].option.key
        if optionKey and optionKey:upper() == key then
            handleTargetInput(('key:%s'):format(key), visibleTargets[i], pressed)
            return
        end
    end

    local firstTarget = visibleTargets[1]
    if key == Config.Interaction.confirmKey:upper() and firstTarget and not firstTarget.option.key then
        handleTargetInput('confirm:keyboard', firstTarget, pressed)
    end
end)

AddEventHandler('fa_target:inputSlot', function(slot, pressed)
    slot = tonumber(slot)
    if not slot or slot < 1 or slot > 5 then return end

    local digit = tostring(slot)
    for i = 1, #visibleTargets do
        local optionKey = visibleTargets[i].option.key
        if optionKey and optionKey:upper() == digit then
            handleTargetInput(('slot:%d'):format(slot), visibleTargets[i], pressed)
            return
        end
    end

    local slotTarget = visibleTargets[slot]
    if slotTarget and not slotTarget.option.key then
        handleTargetInput(('slot:%d'):format(slot), slotTarget, pressed)
    end
end)

for slot = 1, 5 do
    local slotIndex = slot
    local command = ('fa_target_slot_%d'):format(slotIndex)
    RegisterCommand('+' .. command, function()
        TriggerEvent('fa_target:inputSlot', slotIndex, true)
    end, false)
    RegisterCommand('-' .. command, function()
        TriggerEvent('fa_target:inputSlot', slotIndex, false)
    end, false)
    RegisterKeyMapping('+' .. command, ('FA Target option %d'):format(slotIndex), 'keyboard', tostring(slotIndex))
end

local function startTargeting()
    local playerState = LocalPlayer.state
    if switchingMode or targetingSession or inputSession or state.isDisabled() or state.isActive() or IsNuiFocused() or IsPauseMenuActive() then return end
    if Config.Interaction.suspendWhenDead and (IsEntityDead(cache.ped) or playerState.isDead or playerState.dead) then return end
    if Config.Interaction.suspendWhenCuffed and (playerState.isCuffed or playerState.ishandcuffed) then return end

    state.setActive(true)
    targetingSession = true
    targetingGeneration = targetingGeneration + 1
    local generation = targetingGeneration

    local flag = 511
    local hit, entityHit, endCoords, distance, lastEntity, entityType, entityModel, hasTarget, zonesChanged
    local zones = {}

    inputSession = true
    CreateThread(function()
        local dict, texture = utils.getTexture()
        local lastCoords

        while state.isActive() and generation == targetingGeneration do
            while theme.isEditorOpen() and state.isActive() and generation == targetingGeneration do clearInputHolds() Wait(100) end
            if not state.isActive() or generation ~= targetingGeneration then break end
            lastCoords = endCoords == vec0 and lastCoords or endCoords or vec0

            if debug then
                DrawMarker(28, lastCoords.x, lastCoords.y, lastCoords.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.2,
                    0.2,
                    ---@diagnostic disable-next-line: param-type-mismatch
                    255, 42, 24, 100, false, false, 0, true, false, false, false)
            end

            utils.drawZoneSprites(dict, texture)
            if hasTarget then
                -- Prevent the click used to open/select the target UI from also
                -- firing a weapon or triggering the unarmed attack control.
                DisablePlayerFiring(cache.playerId, true)
                DisableControlAction(0, 24, true)
            end

            if Config.Interaction.mode == 'classic' or state.isNuiFocused() then
                DisablePlayerFiring(cache.playerId, true)
                DisableControlAction(0, 25, true)
                DisableControlAction(0, 140, true)
                DisableControlAction(0, 141, true)
                DisableControlAction(0, 142, true)
            end

            if state.isNuiFocused() then
                DisableControlAction(0, 1, true)
                DisableControlAction(0, 2, true)

                if not hasTarget or options and IsDisabledControlJustPressed(0, 25) then
                    state.setNuiFocus(false, false)
                end
            elseif hasTarget and IsDisabledControlJustPressed(0, mouseButton) then
                state.setNuiFocus(true, true)
            end

            if hasTarget then
                local firstTarget = visibleTargets[1]
                if firstTarget and not firstTarget.option.key then
                    if IsControlJustPressed(0, 191) then
                        handleTargetInput('confirm:controller', firstTarget, true)
                    elseif IsControlJustReleased(0, 191) then
                        handleTargetInput('confirm:controller', firstTarget, false)
                    end
                end
            end

            Wait(hasTarget and 0 or 200)
        end

        SetStreamedTextureDictAsNoLongerNeeded(dict)
        inputSession = false
    end)

    while state.isActive() and generation == targetingGeneration do
        while theme.isEditorOpen() and state.isActive() and generation == targetingGeneration do clearInputHolds() Wait(100) end
        if not state.isActive() or generation ~= targetingGeneration then break end
        if not state.isNuiFocused() and lib.progressActive() then
            state.setActive(false)
            break
        end

        local playerCoords = GetEntityCoords(cache.ped)
        hit, entityHit, endCoords = lib.raycast.fromCamera(flag, 4, 20)
        distance = #(playerCoords - endCoords)

        if entityHit ~= 0 and entityHit ~= lastEntity then
            local success, result = pcall(GetEntityType, entityHit)
            entityType = success and result or 0
        end

        if entityType == 0 then
            local _flag = flag == 511 and 26 or 511
            local _hit, _entityHit, _endCoords = lib.raycast.fromCamera(_flag, 4, 20)
            local _distance = #(playerCoords - _endCoords)

            if _distance < distance then
                flag, hit, entityHit, endCoords, distance = _flag, _hit, _entityHit, _endCoords, _distance

                if entityHit ~= 0 then
                    local success, result = pcall(GetEntityType, entityHit)
                    entityType = success and result or 0
                end
            end
        end

        nearbyZones, zonesChanged = utils.getNearbyZones(endCoords)

        local entityChanged = entityHit ~= lastEntity
        local newOptions = (zonesChanged or entityChanged or menuChanged or actionStateChanged) and true
        actionStateChanged = false
        local holdInvalidated = newOptions

        if entityChanged then
            currentMenu = nil

            if entityHit > 0 then
                entityHit = HasEntityClearLosToEntity(cache.ped, entityHit, 17) and entityHit or 0
            end

            if entityHit > 0 then
                local success, result = pcall(GetEntityModel, entityHit)
                entityModel = success and result
            else
                entityType = 0
                entityModel = nil
            end
        end

        if hasTarget and (zonesChanged or entityChanged and hasTarget > 1) then
            SendNuiMessage('{"event": "leftTarget"}')

            if entityChanged then options:wipe() end

            setOutlinedEntity(nil)
            clearInputHolds()

            hasTarget = false
        end

        if newOptions and entityModel and entityHit > 0 then
            options:set(entityHit, entityType, entityModel)
        end

        lastEntity = entityHit
        currentTarget.entity = entityHit
        currentTarget.coords = endCoords
        currentTarget.distance = distance
        currentTarget.entityType, currentTarget.entityModel = entityType, entityModel
        local hidden = 0
        local totalOptions = 0

        for k, v in pairs(options) do
            local optionCount = #v
            local dist = k == '__global' and 0 or distance
            totalOptions += optionCount

            for i = 1, optionCount do
                local option = v[i]
                local previousState = option._stateToken
                local previousStatus = option.interactionState and option.interactionState.status
                local hide = shouldHide(option, dist, endCoords, entityHit, entityType, entityModel)

                if option.hide ~= hide or previousState ~= option._stateToken then
                    if option.hide ~= hide or previousStatus ~= (option.interactionState and option.interactionState.status) then holdInvalidated = true end
                    option.hide = hide
                    newOptions = true
                end

                if hide then hidden += 1 end
            end
        end

        if zonesChanged then table.wipe(zones) end

        for i = 1, #nearbyZones do
            local zoneOptions = nearbyZones[i].options
            local optionCount = #zoneOptions
            totalOptions += optionCount
            zones[i] = zoneOptions

            for j = 1, optionCount do
                local option = zoneOptions[j]
                local previousState = option._stateToken
                local previousStatus = option.interactionState and option.interactionState.status
                local hide = shouldHide(option, distance, endCoords, entityHit)

                if option.hide ~= hide or previousState ~= option._stateToken then
                    if option.hide ~= hide or previousStatus ~= (option.interactionState and option.interactionState.status) then holdInvalidated = true end
                    option.hide = hide
                    newOptions = true
                end

                if hide then hidden += 1 end
            end
        end

        if holdInvalidated then clearInputHolds() end
        rebuildVisibleTargets(zones)

        local hasEntityInteraction = false
        for i = 1, #visibleTargets do
            local targetType = visibleTargets[i].targetType
            if targetType ~= '__global' and targetType ~= 'zones' then
                hasEntityInteraction = true
                break
            end
        end

        local currentTheme = theme.get()
        if currentTheme.fade then
            SendNUIMessage({ event = 'targetDistance', distance = distance, revealDistance = Config.Interaction.revealDistance, expandDistance = Config.Interaction.expandDistance })
        end
        if debug or Config.Visual.outline or (Config.Visual.highlight and currentTheme.highlight) then
            -- SET_ENTITY_DRAW_OUTLINE is unsafe for skinned ped meshes and can hard-crash FiveM.
            -- Peds remain fully targetable; only their experimental native outline is suppressed.
            local canOutline = entityHit > 0 and entityType ~= 1 and hasEntityInteraction and DoesEntityExist(entityHit)
            setOutlinedEntity(canOutline and entityHit or nil)
        else
            setOutlinedEntity(nil)
        end

        if newOptions then
            if hasTarget == 1 and (totalOptions - hidden) > 1 then
                hasTarget = true
            end

            if hasTarget and hidden == totalOptions then
                if hasTarget and hasTarget ~= 1 then
                    hasTarget = false
                    SendNuiMessage('{"event": "leftTarget"}')
                end
            elseif menuChanged or hasTarget ~= 1 and hidden ~= totalOptions then
                hasTarget = options.size

                if currentMenu and options.__global[1]?.name ~= 'builtin:goback' then
                    table.insert(options.__global, 1,
                        {
                            icon = 'fa-solid fa-circle-chevron-left',
                            label = locale('go_back'),
                            name = 'builtin:goback',
                            menuName = currentMenu,
                            openMenu = 'home'
                        })
                end

                rebuildVisibleTargets(zones)

                local anchor
                if Config.Interaction.mode == 'dui' then
                    anchor = getTargetAnchor(hasEntityInteraction and entityHit or nil, endCoords, nearbyZones)
                    lastAnchorVisible = anchor.visible
                    lastAnchorX, lastAnchorY = anchor.x, anchor.y
                end

                SendNuiMessage(json.encode({
                    event = 'setTarget',
                    options = nuiOptions(options),
                    zones = nuiOptions(zones),
                    mode = Config.Interaction.mode,
                    theme = currentTheme,
                    fonts = theme.getFonts(),
                    hasTarget = true,
                    anchor = anchor,
                }, { sort_keys = true }))
            end

            menuChanged = false
        end

        if hasTarget and Config.Interaction.mode == 'dui' then
            local anchor = getTargetAnchor(hasEntityInteraction and entityHit or nil, endCoords, nearbyZones)
            if anchor.visible and (not lastAnchorVisible or not lastAnchorX
                or math.abs(anchor.x - lastAnchorX) > 0.0015 or math.abs(anchor.y - lastAnchorY) > 0.0015) then
                lastAnchorVisible = true
                lastAnchorX, lastAnchorY = anchor.x, anchor.y
                SendNUIMessage({ event = 'targetAnchor', anchor = anchor })
            elseif not anchor.visible and lastAnchorVisible ~= false then
                lastAnchorVisible = false
                lastAnchorX, lastAnchorY = nil, nil
                SendNUIMessage({ event = 'targetAnchor', anchor = anchor })
            end
        end

        if toggleHotkey and IsPauseMenuActive() then
            state.setActive(false)
        end

        if not hasTarget or hasTarget == 1 then
            flag = flag == 511 and 26 or 511
        end

        Wait(hit and 50 or 250)
    end

    setOutlinedEntity(nil)
    clearInputHolds()
    table.wipe(visibleTargets)
    lastAnchorX, lastAnchorY, lastAnchorVisible = nil, nil, nil

    if not theme.isEditorOpen() then state.setNuiFocus(false) end
    SendNuiMessage('{"event": "visible", "state": false}')
    table.wipe(currentTarget)
    options:wipe()

    if nearbyZones then table.wipe(nearbyZones) end
    targetingSession = false
end

theme.setModeSwitcher(function(mode)
    if switchingMode then return false end
    switchingMode = true
    targetingGeneration = targetingGeneration + 1
    state.setActive(false)
    clearInputHolds()
    local expires = GetGameTimer() + 5000
    while (targetingSession or inputSession) and GetGameTimer() < expires do Wait(0) end
    if targetingSession or inputSession then switchingMode = false return false end
    classicEngaged = false
    Config.Interaction.mode = mode
    SendNUIMessage({ event = 'interactionMode', mode = mode })
    switchingMode = false
    return true
end)

do
    ---@type KeybindProps
    local keybind = {
        name = 'ox_target',
        defaultKey = GetConvar('fa_target:defaultHotkey', GetConvar('ox_target:defaultHotkey', Config.Interaction.targetKey)),
        defaultMapper = 'keyboard',
        description = locale('toggle_targeting'),
    }

    function keybind:onPressed()
        if Config.Interaction.mode == 'focus' or Config.Interaction.mode == 'dui' then
            classicEngaged = true
            return
        end
        if toggleHotkey and state.isActive() then return state.setActive(false) end
        return startTargeting()
    end

    function keybind:onReleased()
        classicEngaged = false
        if Config.Interaction.mode == 'classic' and not toggleHotkey then state.setActive(false) end
    end

    lib.addKeybind(keybind)
end

---@generic T
---@param option T
---@param server? boolean
---@return T
local function getResponse(option, server)
    local response = table.clone(option)
    response.entity = currentTarget.entity
    response.zone = currentTarget.zone
    response.coords = currentTarget.coords
    response.distance = currentTarget.distance
    response.requestId = currentRequestId

    if server then
        response.entity = response.entity ~= 0 and NetworkGetEntityIsNetworked(response.entity) and
            NetworkGetNetworkIdFromEntity(response.entity) or 0
    end

    response.icon = nil
    response.groups = nil
    response.items = nil
    response.canInteract = nil
    response.getState = nil
    response._stateToken = nil
    response.interactionState = nil
    response.onSelect = nil
    response.export = nil
    response.event = nil
    response.serverEvent = nil
    response.command = nil

    return response
end

selectOption = function(data)
    if theme.isEditorOpen() then return end
    if type(data) ~= 'table' or not state.isActive() or not currentTarget.coords then return end
    if type(data[1]) ~= 'string' or type(data[2]) ~= 'number' or data[2] % 1 ~= 0
        or data[3] ~= nil and (type(data[3]) ~= 'number' or data[3] % 1 ~= 0) then return end
    if IsNuiFocused() and not state.isNuiFocused() then return end -- Theme Creator or another NUI owns focus.
    if IsPauseMenuActive() or Config.Interaction.suspendWhenDead and IsEntityDead(cache.ped) then return end
    if Config.Interaction.suspendWhenCuffed and (LocalPlayer.state.isCuffed or LocalPlayer.state.ishandcuffed) then return end
    local zone = data[3] and nearbyZones[data[3]]

    ---@type OxTargetOption?
    local group = options[data[1]]
    local option = zone and zone.options[data[2]] or group and group[data[2]]

    if option then
        local isVisible = false
        for i = 1, #visibleTargets do
            if visibleTargets[i].option == option and visibleTargets[i].targetType == data[1]
                and visibleTargets[i].targetId == data[2] and visibleTargets[i].zoneId == data[3] then isVisible = true break end
        end
        if not isVisible or option.hide then return end
        local entity = currentTarget.entity
        if data[1] ~= 'zones' and entity and entity > 0 and not DoesEntityExist(entity) then return end
        local hidden = shouldHide(option, data[1] == '__global' and 0 or currentTarget.distance,
            currentTarget.coords, entity, data[1] ~= 'zones' and currentTarget.entityType or nil,
            data[1] ~= 'zones' and currentTarget.entityModel or nil)
        if hidden or option.interactionState and option.interactionState.status ~= 'available' then
            actionStateChanged = true
            clearInputHolds()
            SendNUIMessage({ event = 'actionResult', status = 'error', message = option.interactionState and option.interactionState.reason or locale('state_disabled') })
            return
        end
        if option.openMenu then
            local menuDepth = #menuHistory

            if option.name == 'builtin:goback' then
                option.menuName = option.openMenu
                option.openMenu = menuHistory[menuDepth]

                if menuDepth > 0 then
                    menuHistory[menuDepth] = nil
                end
            else
                menuHistory[menuDepth + 1] = currentMenu
            end

            menuChanged = true
            currentMenu = option.openMenu ~= 'home' and option.openMenu or nil

            options:wipe()
        else
            state.setNuiFocus(false)
        end

        currentTarget.zone = zone?.id

        local result
        currentRequestId = ('%s:%s:%d'):format(option.resource or 'fa_target', option.name or 'option', GetGameTimer())
        if option.onSelect then
            result = option.onSelect(option.qtarget and currentTarget.entity or getResponse(option))
        elseif option.export then
            result = exports[option.resource or zone.resource][option.export](nil, getResponse(option))
        elseif option.event then
            TriggerEvent(option.event, getResponse(option))
        elseif option.serverEvent then
            TriggerServerEvent(option.serverEvent, getResponse(option, true))
        elseif option.command then
            ExecuteCommand(option.command)
        end


        if type(result) == 'table' and result.status then
            if result.status == 'pending' then
                pendingActions[currentRequestId] = GetGameTimer() + Config.Interaction.asyncTimeout
            end
            SendNUIMessage({ event = 'actionResult', requestId = currentRequestId, status = result.status, message = result.message })
        end
        currentRequestId = nil

        if option.menuName == 'home' then return end
    end

    if not option?.openMenu and IsNuiFocused() then
        state.setActive(false)
    end
end

RegisterNUICallback('select', function(data, cb)
    cb(1)
    selectOption(data)
end)

AddEventHandler('fa_target:resolveAction', function(requestId, result)
    local expires = pendingActions[requestId]
    if not expires or expires < GetGameTimer() or type(result) ~= 'table' then return end
    pendingActions[requestId] = nil
    SendNUIMessage({ event = 'actionResult', requestId = requestId, status = result.status, message = result.message })
end)

RegisterNUICallback('setCursor', function(data, cb)
    state.setNuiFocus(data and data.state == true, data and data.state == true)
    cb({ ok = true })
end)

CreateThread(function()
    if Config.Interaction.mode ~= 'focus' and Config.Interaction.mode ~= 'dui' then return end
    while true do
        if not state.isActive() and not state.isDisabled() and not IsNuiFocused() and not IsPauseMenuActive() then
            startTargeting()
        end
        Wait(500)
    end
end)

CreateThread(function()
    Wait(0)
    TriggerEvent('fa_target:ready')
    TriggerEvent('ox_target:ready')
end)
