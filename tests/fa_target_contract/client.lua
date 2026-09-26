local createdZones = {}
local testPed

local function assertValue(value, message)
    if not value then error(('FA Target contract failed: %s'):format(message), 2) end
end

local function addZone(id)
    createdZones[#createdZones + 1] = id
    assertValue(exports.fa_target:zoneExists(id), ('zone %s was not registered'):format(id))
end

RegisterCommand('fatargettest', function()
    local coords = GetEntityCoords(cache.ped)
    addZone(exports.ox_target:addBoxZone({
        name = 'fa_contract_ox_box', coords = coords + vec3(0, 3, 0), size = vec3(1.5, 1.5, 2.0),
        options = {{ name = 'fa_contract_ox_box_press', label = 'ox_target box export', onSelect = function()
            return { status = 'success', message = 'ox_target addBoxZone works' }
        end }}
    }))
    addZone(exports.ox_target:addSphereZone({
        name = 'fa_contract_sphere', coords = coords + vec3(2, 0, 0), radius = 1.5,
        options = {{ name = 'fa_contract_press', label = 'Press test', key = 'E', onSelect = function()
            return { status = 'success', message = 'Press works' }
        end }}
    }))

    exports['qb-target']:AddBoxZone('fa_contract_qb', coords + vec3(-2, 0, 0), 2.0, 2.0, {
        heading = 0, minZ = coords.z - 1, maxZ = coords.z + 1, debugPoly = true
    }, { distance = 3.0, options = {{ label = 'QB compatibility', icon = 'fa-solid fa-check',
        action = function()
            print('[fa_target_contract] qb-target action passed')
            return { status = 'success', message = 'QB compatibility works' }
        end }} })

    local model = `a_m_m_business_01`
    lib.requestModel(model)
    testPed = CreatePed(4, model, coords.x, coords.y + 2, coords.z - 1, 180.0, false, false)
    FreezeEntityPosition(testPed, true)
    exports.fa_target:addLocalEntity(testPed, {{
        name = 'fa_contract_hold', label = 'Hold test', description = 'Hold for one second',
        icon = 'fa-solid fa-stopwatch', badge = 'TEST', key = 'G', hold = 1000,
        groups = nil, items = nil, canInteract = function(entity) return entity == testPed end,
        onSelect = function(data)
            assertValue(data.entity == testPed, 'local entity response mismatch')
            return { status = 'success', message = 'Hold works' }
        end
    }})
    SetModelAsNoLongerNeeded(model)
    print('[fa_target_contract] registrations passed; test UI, LOS, keys, hold and cleanup in game')
end, false)

local function cleanup()
    for i = 1, #createdZones do exports.fa_target:removeZone(createdZones[i]) end
    if testPed and DoesEntityExist(testPed) then
        exports.fa_target:removeLocalEntity(testPed, 'fa_contract_hold')
        DeleteEntity(testPed)
    end
end

RegisterCommand('fatargettestclean', cleanup, false)
AddEventHandler('onResourceStop', function(resource) if resource == GetCurrentResourceName() then cleanup() end end)
