local Theme = {}

local presets = { precision = true, minimal = true, glass = true, classic = true }
local positions = { left = true, center = true, right = true }
local fontAliases = { inter = 'montserrat' }

local function sanitizeFonts()
    local result = {}
    local registered = {}

    for i = 1, #(Config.Theme.fonts or {}) do
        local font = Config.Theme.fonts[i]
        local id = type(font.id) == 'string' and font.id:lower()
        local family = type(font.family) == 'string' and font.family
        local file = type(font.file) == 'string' and font.file or nil

        if id and id:match('^[%w_-]+$') and family and #family <= 64 and not registered[id]
            and (not file or (file:match('^[%w%._-]+%.woff2$') and not file:find('%.%.', 1, true))) then
            result[#result + 1] = {
                id = id,
                label = type(font.label) == 'string' and font.label:sub(1, 32) or id,
                family = family:sub(1, 64),
                file = file,
                weight = type(font.weight) == 'string' and font.weight:sub(1, 16) or '400 800',
            }
            registered[id] = true
        end
    end

    return result, registered
end

local fontCatalog, fonts = sanitizeFonts()

function Theme.getFonts()
    return fontCatalog
end

local function clamp(value, min, max)
    value = tonumber(value) or min
    if value ~= value or value == math.huge or value == -math.huge then value = min end
    return math.max(min, math.min(max, value))
end

local function choice(value, fallback, allowed, default)
    if allowed[value] then return value end
    return allowed[fallback] and fallback or default
end

local function colour(value, fallback)
    return type(value) == 'string' and value:match('^#%x%x%x%x%x%x$') and value or fallback
end

local function categoryColours(value)
    local result, count = {}, 0
    if type(value) ~= 'table' then return result end
    -- Stable ordering keeps imports and saved themes consistent across client/server.
    local keys = {}
    for key in pairs(value) do
        if type(key) == 'string' and #key <= 32 and key:match('^[%w_-]+$') then keys[#keys + 1] = key end
    end
    table.sort(keys)
    for i = 1, #keys do
        local key = keys[i]
        if colour(value[key], false) then
            result[key], count = value[key], count + 1
            if count == 16 then break end
        end
    end
    return result
end

function Theme.sanitize(input, fallback)
    input = type(input) == 'table' and input or {}
    fallback = fallback or Config.Theme.default
    local inputFont = fontAliases[input.font] or input.font
    local fallbackFont = fontAliases[fallback.font] or fallback.font
    local defaultFont = fontAliases[Config.Theme.default.font] or Config.Theme.default.font
    local preset = input.preset == 'compact' and 'minimal' or input.preset
    local fallbackPreset = fallback.preset == 'compact' and 'minimal' or fallback.preset

    return {
        preset = choice(preset, fallbackPreset, presets, 'precision'),
        accent = colour(input.accent, fallback.accent),
        surface = colour(input.surface, fallback.surface),
        text = colour(input.text, fallback.text),
        mutedText = colour(input.mutedText, fallback.mutedText),
        opacity = clamp(input.opacity or fallback.opacity, 0.45, 1.0),
        radius = clamp(input.radius or fallback.radius, 0, 24),
        scale = clamp(input.scale or fallback.scale, 0.75, 1.35),
        position = positions[input.position] and input.position or fallback.position,
        font = fonts[inputFont] and inputFont or fonts[fallbackFont] and fallbackFont or defaultFont,
        animations = input.animations == nil and fallback.animations or input.animations == true,
        indicator = input.indicator == nil and fallback.indicator or input.indicator == true,
        highlight = input.highlight == nil and fallback.highlight or input.highlight == true,
        blur = clamp(input.blur or fallback.blur or 12, 0, 20),
        width = clamp(input.width or fallback.width or 280, 220, 420),
        textSize = clamp(input.textSize or fallback.textSize or 13, 12, 20),
        indicatorSize = clamp(input.indicatorSize or fallback.indicatorSize or 13, 10, 24),
        indicatorStyle = choice(input.indicatorStyle, fallback.indicatorStyle, { ring = true, dot = true, crosshair = true }, 'ring'),
        cursorHint = choice(input.cursorHint, fallback.cursorHint, { always = true, first = true, never = true }, 'first'),
        colorVision = choice(input.colorVision, fallback.colorVision, { normal = true, protanopia = true, deuteranopia = true, tritanopia = true }, 'normal'),
        highContrast = input.highContrast == nil and fallback.highContrast == true or input.highContrast == true,
        fade = input.fade == nil and fallback.fade == true or input.fade == true,
        sound = input.sound == nil and fallback.sound == true or input.sound == true,
        soundVolume = clamp(input.soundVolume or fallback.soundVolume or 0.25, 0, 1),
        categoryColors = categoryColours(input.categoryColors or fallback.categoryColors),
    }
end

function Theme.merge(serverTheme, playerTheme, allowed)
    local merged = Theme.sanitize(serverTheme, Config.Theme.default)
    if not Config.Theme.allowPlayerCustomization or type(playerTheme) ~= 'table' then return merged end
    for key, enabled in pairs(allowed or {}) do
        if enabled and playerTheme[key] ~= nil then merged[key] = playerTheme[key] end
    end
    return Theme.sanitize(merged, Config.Theme.default)
end

return Theme
