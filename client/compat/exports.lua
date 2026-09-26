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

for i = 1, #exportNames do
    local exportName = exportNames[i]
    AddEventHandler(('__cfx_export_ox_target_%s'):format(exportName), function(setCB)
        setCB(api[exportName])
    end)
end

require 'client.compat.qtarget'
