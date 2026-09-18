local QBCore = exports['qb-core']:GetCoreObject()
local utils = require 'client.utils'
local groups = {}
local playerItems = utils.getItems()

local function setPlayerData(data)
    table.wipe(groups)
    groups.job = data.job
    groups.gang = data.gang
    if Config.Inventory ~= 'framework' and Config.Inventory ~= 'auto' then return end
    table.wipe(playerItems)
    for _, item in pairs(data.items or {}) do
        local name = item.name
        if name then playerItems[name] = (playerItems[name] or 0) + (item.amount or item.count or 0) end
    end
end

setPlayerData(QBCore.Functions.GetPlayerData() or {})
RegisterNetEvent('QBCore:Player:SetPlayerData', setPlayerData)
RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function() setPlayerData(QBCore.Functions.GetPlayerData() or {}) end)
RegisterNetEvent('QBCore:Client:OnPlayerUnload', function() table.wipe(groups) table.wipe(playerItems) end)
RegisterNetEvent('QBCore:Client:OnJobUpdate', function(job) groups.job = job end)
RegisterNetEvent('QBCore:Client:OnGangUpdate', function(gang) groups.gang = gang end)

function utils.hasPlayerGotGroup(filter)
    local filterType = type(filter)
    for _, data in pairs(groups) do
        if data then
            if filterType == 'string' and data.name == filter then return true end
            if filterType == 'table' then
                local grade = type(data.grade) == 'table' and data.grade.level or data.grade or 0
                if table.type(filter) == 'hash' then
                    for name, required in pairs(filter) do
                        if data.name == name and grade >= required then return true end
                    end
                else
                    for i = 1, #filter do if data.name == filter[i] then return true end end
                end
            end
        end
    end
    return false
end
