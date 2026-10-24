
Config = {}

--[[
    FRAMEWORK & INVENTORY
    Automatically detect your server framework and inventory,
    or select an integration manually.
]]

Config.Framework = 'auto' -- auto, standalone, esx, qbcore, qbox, ox
Config.Inventory = 'auto' -- auto, framework, ox_inventory, qb-inventory, qs-inventory, codem-inventory
Config.Locale = 'en' -- Language used by the resource.

-- Groups allowed to access administrative features.
-- Make sure these match your framework's permission groups.
Config.AdminGroups = {
    'admin',
    'owner',
    'god',
    'best'
}

--[[
    INTERACTION SETTINGS
    Configure how players discover and interact with targets.
]]

Config.Interaction = {
    -- Default interaction mode: focus, classic or dui.
    -- Focus - Automatically shows the target options when looking at an interaction
    -- Classic - Requires holding the targetKey (Default: ALT) to show the interaction options.
    -- DUI - Automatically shows the target options using a world anchored UI
    mode = 'focus',

    -- Allow players to override the default mode
    -- and save their preference through the theme editor.
    allowPlayerModeSwitch = false,

    -- Override interaction modes for specific resources.
    -- Example: ['resource_name'] = 'classic'
    resourceModes = {},

    -- Default key bindings (FiveM control names).
    targetKey = 'LMENU', -- Left Alt
    confirmKey = 'E',

    -- Enable toggle mode instead of holding the target key.
    toggle = false,

    -- Maximum distance for displaying nearby targets (meters).
    revealDistance = 8.0,

    -- Distance at which target options expand (meters).
    expandDistance = 2.5,

    -- Timeout for asynchronous checks (milliseconds).
    -- 10000 = 10 seconds.
    asyncTimeout = 10000,

    -- Hide external targets while the player is inside a vehicle.
    hideExternalEntitiesInVehicle = true,

    -- Disable interaction while dead or handcuffed.
    suspendWhenDead = true,
    suspendWhenCuffed = true,

    -- How unavailable interaction options are handled:
    -- 'show': Display disabled options and their reason.
    -- 'hide': Completely hide unavailable options.
    unavailable = 'show',
}

--[[
    VISUAL EFFECTS
    Configure visual feedback for nearby targets.
]]

Config.Visual = {
    indicator = true, -- Display target indicators.
    highlight = true, -- Highlight targeted entities.
    outline = false,  -- Draw an outline around targeted entities.
}

--[[
    THEME CUSTOMIZATION
    Control which appearance settings players can customize.
]]

Config.Theme = {
    -- Allow players to customize their interaction UI.
    allowPlayerCustomization = true,

    -- Command used to open the theme editor (without /).
    commandName = 'targetheme',

    -- Fonts available in the theme editor.
    -- Custom fonts must be included in the resource's UI assets.
    -- After adding custom fonts make sure to rebuild the UI.
    fonts = {
        {
            id = 'montserrat',
            label = 'Montserrat',
            family = 'Montserrat',
            file = 'Montserrat-Variable.woff2',
            weight = '100 900'
        },
        {
            id = 'system',
            label = 'System',
            family = 'Segoe UI'
        },
        {
            id = 'condensed',
            label = 'Condensed',
            family = 'Arial Narrow'
        },
    },

    -- Player customization permissions.
    -- true  = Players can modify this setting.
    -- false = Players cannot modify this setting.
    allowedPlayerFields = {
        preset = true,
        accent = true,
        surface = true,
        text = true,
        mutedText = true,
        opacity = true,
        radius = true,
        scale = true,
        position = true,
        font = true,
        animations = true,
        indicator = true,
        highlight = true,
        blur = true,
        width = true,
        textSize = true,
        indicatorSize = true,
        indicatorStyle = true,
        cursorHint = true,
        highContrast = true,
        colorVision = true,
        fade = true,
        sound = true,
        soundVolume = true,
        categoryColors = true,
    },

    --[[
        DEFAULT THEME
        Initial appearance for players without saved preferences.
        Individual customization may override these values.
    ]]

    default = {
        -- Preset and colors (HEX).
        preset = 'precision',
        accent = '#7c5cff',
        surface = '#111217',
        text = '#f7f7fb',
        mutedText = '#adb0bf',

        -- Layout and appearance.
        opacity = 0.92,
        radius = 10,
        scale = 1.0,
        position = 'center',
        font = 'montserrat',

        -- Visual effects.
        animations = true,
        indicator = true,
        highlight = true,
        blur = 12,

        -- Dimensions and text.
        width = 280,
        textSize = 13,
        indicatorSize = 13,
        indicatorStyle = 'ring',

        -- Accessibility and interaction feedback.
        cursorHint = 'first',
        highContrast = false,
        colorVision = 'normal',
        fade = false,

        -- Audio feedback.
        sound = false,
        soundVolume = 0.25,

        -- Custom category colors.
        categoryColors = {},
    }
}
