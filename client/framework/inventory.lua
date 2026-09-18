local utils = require 'client.utils'
local playerItems = utils.getItems()
local inventory = Config.InventoryResolved or Config.Inventory

local function countItem(name)
    if inventory == 'qs-inventory' then
        local ok, count = pcall(function() return exports['qs-inventory']:GetItemTotalAmount(name) end)
        return ok and tonumber(count) or 0
    end
    if inventory == 'codem-inventory' then
        local ok, count = pcall(function() return exports['codem-inventory']:GetItemCount(name) end)
        return ok and tonumber(count) or 0
    end
    return rawget(playerItems, name) or 0
end

setmetatable(playerItems, { __index = function(self, name)
    local count = countItem(name)
    rawset(self, name, count)
    return count
end })

AddEventHandler('onClientResourceStop', function(resource)
    if resource == inventory then table.wipe(playerItems) end
end)
