local api = require 'client.api'

local exportNames = {
    'addPolyZone',
    'addBoxZone',
    'addSphereZone',
    'zoneExists',
    'removeZone',
    'addGlobalPed',
    'removeGlobalPed',
    'addGlobalVehicle',
    'removeGlobalVehicle',
    'addGlobalObject',
    'removeGlobalObject',
    'addGlobalPlayer',
    'removeGlobalPlayer',
    'addModel',
    'removeModel',
    'addEntity',
    'removeEntity',
    'addLocalEntity',
    'removeLocalEntity',
    'addGlobalOption',
    'removeGlobalOption',
    'getTargetOptions',
    'disableTargeting',
    'isActive',
    'resolveAction',
}

local aliases = { 'fa_target', 'ox_target' }
local currentResource = GetCurrentResourceName()

for aliasIndex = 1, #aliases do
    local alias = aliases[aliasIndex]

    if alias ~= currentResource then
        for exportIndex = 1, #exportNames do
            local exportName = exportNames[exportIndex]
            AddEventHandler(('__cfx_export_%s_%s'):format(alias, exportName), function(setCB)
                setCB(api[exportName])
            end)
        end
    end
end

require 'client.compat.qtarget'
