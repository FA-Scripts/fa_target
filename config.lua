Config = {}

Config.Framework = 'auto' -- auto, standalone, esx, qbcore, qbox, ox
Config.Inventory = 'auto' -- auto, framework, ox_inventory, qb-inventory, qs-inventory, codem-inventory
Config.Locale = 'en'

Config.AdminGroups = {
    'admin',
}

Config.Interaction = {
    mode = 'focus', -- focus, classic or dui
    resourceModes = {}, -- ['legacy_resource'] = 'classic'
    targetKey = 'LMENU',
    confirmKey = 'E',
    toggle = false,
    revealDistance = 8.0,
    expandDistance = 2.5,
    asyncTimeout = 10000,
    hideExternalEntitiesInVehicle = true,
    suspendWhenDead = true,
    suspendWhenCuffed = true,
}

Config.Visual = {
    indicator = true,
    highlight = true,
    outline = false,
}

Config.Theme = {
    allowPlayerCustomization = true,
    fonts = {
        {
            id = 'montserrat', label = 'Montserrat', family = 'Montserrat',
            file = 'Montserrat-Variable.woff2', weight = '100 900'
        },
        { id = 'system', label = 'System', family = 'Segoe UI' },
        { id = 'condensed', label = 'Condensed', family = 'Arial Narrow' },
    },
    allowedPlayerFields = {
        preset = true, accent = true, surface = true, text = true, mutedText = true,
        opacity = true, radius = true, scale = true, position = true, font = true,
        animations = true, indicator = true, highlight = true,
    },
    default = {
        preset = 'precision', accent = '#7c5cff', surface = '#111217',
        text = '#f7f7fb', mutedText = '#9a9baa', opacity = 0.92,
        radius = 10, scale = 1.0, position = 'center', font = 'montserrat',
        animations = true, indicator = true, highlight = true,
    }
}
