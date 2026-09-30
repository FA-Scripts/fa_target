# FA Target

Modern, free and open-source interaction system for FiveM. FA Target is based on the MIT-licensed `ox_target` engine and provides Focus, Classic and world-anchored DUI modes, a Theme Creator, option keybinds, hold interactions, action feedback, and compatibility for `ox_target`, `qb-target`, and `qtarget` registrations.

## Installation

1. Install and start `ox_lib` 3.30.0 or newer.
2. Build the UI with `cd web && npm install && npm run build`, or use a release archive containing `web/dist`.
3. Keep the resource folder named `ox_target` and add `ensure ox_target` after `ox_lib`.
4. Stop/remove the old target resource. `provide` entries satisfy dependencies on the supported target resources.
5. Configure administrative ACE principals in `Config.AdminGroups`.

Do not run FA Target alongside another resource providing `ox_target`, `qb-target`, or `qtarget`.

The `ox_target` folder name is required when `inventory:target` is enabled. `ox_inventory`
checks `GetResourceState('ox_target')` directly; FiveM's `provide` metadata and export aliases
cannot change that native result. The branded `exports.fa_target:*` API remains available when
the folder is named `ox_target`.

## Configuration

`config.lua` controls framework/inventory detection, Focus, Classic or DUI mode, keybinds, blocking states, visual indicators, and player theme permissions. DUI uses the regular NUI renderer anchored to the raycast world coordinate, so it does not create a separate browser instance for every target. Explicit bridge values take precedence over auto-detection.

- `/fatheme` opens player preferences when enabled.
- `/fathemeadmin` opens the server theme editor for configured administrators.
- Server themes persist in resource KVP and update connected players live.
- Player preferences persist in client KVP and only override fields allowed by the server.

`Config.AdminGroups` accepts group names such as `admin` (or complete ACE principals) and grants
each configured group both `fa_target.theme` and
`command.fathemeadmin`. You can also grant either permission manually, including to one player:

```cfg
add_ace group.admin command.fathemeadmin allow
add_ace identifier.license:YOUR_LICENSE command.fathemeadmin allow
```

Resources which support runtime target replacement can listen for the client event
`fa_target:ready` and register their target options again after FA Target starts. FA Target does
not restart other resources automatically.

### Local fonts

Montserrat Variable is bundled locally and is the default for runtime interactions and the Theme Creator. To add a customer font, copy its `.woff2` file to `web/public/fonts`, add one entry to `Config.Theme.fonts`, and rebuild the UI:

```lua
{
    id = 'customer_font', label = 'Customer Font', family = 'Customer Font',
    file = 'CustomerFont.woff2', weight = '100 900'
}
```

Only local `.woff2` filenames are accepted. External URLs and traversal paths are rejected; missing files fall back to Montserrat and the system sans-serif stack. Existing saved `font = 'inter'` themes migrate to Montserrat automatically.

## API

Existing ox_target calls remain valid:

FA Target registers aliases in both directions before its main client script starts. With the
recommended `ox_target` folder name, existing `exports.ox_target:*` calls and the branded
`exports.fa_target:*` extensions are both available.

```lua
exports.ox_target:addBoxZone({
    coords = vec3(441.2, -981.9, 30.7), size = vec3(2, 2, 2),
    options = {{ name = 'armoury', label = 'Open armoury', event = 'police:armoury' }}
})
```

FA extensions are accepted on every option:

```lua
exports.fa_target:addLocalEntity(ped, {{
    name = 'dealer_talk', label = 'Talk to dealer',
    description = 'Browse available vehicles', icon = 'fa-solid fa-car',
    badge = 'NEW', key = 'E', hold = 1200, mode = 'focus',
    onSelect = function(data)
        return { status = 'success', message = 'Opening catalogue' }
    end
}})
```

An action can return `pending`, then resolve later with `exports.fa_target:resolveAction(requestId, result)`. Supported handler priority remains: `onSelect`, `export`, client `event`, `serverEvent`, then `command`. qb-target/qtarget adapters translate their zone, entity, model, bone, job, gang, item, action and event formats.

## Security

Visibility and `canInteract` are client-side UX checks, not authorization. Server events must independently validate the player, entity, distance, permissions, inventory and all state-changing input. Never trust prices, rewards, item counts or entity ownership received from NUI/client code.

## Verification

`npm run build` performs TypeScript checking and creates the production NUI. Static validation cannot prove runtime behavior. Before release, test in FiveM with OneSync on ESX, QBCore and Qbox, including walls/LOS, vehicle seats, controller input, resource restarts, entity despawn and theme persistence.

See [UPSTREAM.md](UPSTREAM.md) and [LICENSE](LICENSE) for attribution.
