local Theme = {}

local presets = { precision = true, minimal = true, glass = true, compact = true, classic = true }
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
    return math.max(min, math.min(max, value))
end

local function colour(value, fallback)
    return type(value) == 'string' and value:match('^#%x%x%x%x%x%x$') and value or fallback
end

function Theme.sanitize(input, fallback)
    input = type(input) == 'table' and input or {}
    fallback = fallback or Config.Theme.default
    local inputFont = fontAliases[input.font] or input.font
    local fallbackFont = fontAliases[fallback.font] or fallback.font
    local defaultFont = fontAliases[Config.Theme.default.font] or Config.Theme.default.font

    return {
        preset = presets[input.preset] and input.preset or fallback.preset,
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
