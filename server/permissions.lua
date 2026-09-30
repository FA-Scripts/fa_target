local permissions = {}

permissions.theme = 'fa_target.theme'
permissions.adminCommand = 'command.fathemeadmin'

local registeredAces = {}

---@param principal unknown
---@return string?
local function normalizePrincipal(principal)
    if type(principal) ~= 'string' or principal == '' then return end
    if principal:match('^[%w_-]+$') then return 'group.' .. principal end
    return principal
end

local function registerAce(principal, ace)
    principal = normalizePrincipal(principal)
    if not principal then return end
    if IsPrincipalAceAllowed(principal, ace) then return end

    lib.addAce(principal, ace)
    registeredAces[#registeredAces + 1] = { principal = principal, ace = ace }
end

for i = 1, #(Config.AdminGroups or {}) do
    local principal = Config.AdminGroups[i]
    registerAce(principal, permissions.theme)
    registerAce(principal, permissions.adminCommand)
end

---@param source number
---@return boolean
function permissions.isAdmin(source)
    return source == 0
        or IsPlayerAceAllowed(source, permissions.theme)
        or IsPlayerAceAllowed(source, permissions.adminCommand)
end

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    for i = 1, #registeredAces do
        local entry = registeredAces[i]
        lib.removeAce(entry.principal, entry.ace)
    end
end)

return permissions
