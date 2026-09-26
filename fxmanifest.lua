-- FX Information
fx_version 'cerulean'
use_experimental_fxv2_oal 'yes'
nui_callback_strict_mode 'true'
lua54 'yes'
game 'gta5'

-- Resource Information
name 'fa_target'
author 'FA Scripts, based on ox_target by Overextended'
version '1.0.0'
repository 'https://github.com/FA-Scripts/fa_target'
description 'Modern, free and open-source interaction system for FiveM.'

-- Manifest
ui_page 'web/dist/index.html'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

client_scripts {
    'client/compat/exports.lua',
    'client/main.lua',
}

server_scripts {
    'server/main.lua',
    'server/theme.lua',
}

files {
    'web/dist/**',
    'web/dist/fonts/*.woff2',
    'locales/*.json',
    'client/api.lua',
    'client/utils.lua',
    'client/state.lua',
    'client/debug.lua',
    'client/defaults.lua',
    'client/framework/nd.lua',
    'client/framework/ox.lua',
    'client/framework/esx.lua',
    'client/framework/qbx.lua',
    'client/framework/qb.lua',
    'client/framework/inventory.lua',
    'client/compat/qtarget.lua',
    'client/compat/exports.lua',
    'client/theme.lua',
    'shared/theme.lua',
}

provide 'ox_target'
provide 'qb-target'
provide 'qtarget'

dependency 'ox_lib'
