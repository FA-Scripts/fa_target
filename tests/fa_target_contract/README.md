# Live contract test

Copy this folder as a separate resource, start it after `fa_target`, and run
`/fatargettest`. Its `dependency 'ox_target'` intentionally resolves through
`fa_target`'s manifest replacement, then it registers native FA, ox_target
(`addBoxZone` and `addSphereZone`) and qb-target fixtures near
the player. Validate Focus, Classic and DUI presentation; confirm that the spawned
ped is detected without receiving the unsafe native outline, while the currently
targeted object or vehicle can be outlined. Also test keys
1-5, E/G, mouse, controller, hold cancellation, LOS behind walls and restart cleanup. Run
`/fatargettestclean` afterwards.

While the fixture is enabled, restart `ox_target`. The fixture listens for `fa_target:ready`
and must recreate its zones and ped interaction without running `/fatargettest` again.

Repeat on OneSync with standalone, ESX, QBCore and Qbox. Static repository tests
cannot validate GTA natives, resource `provide` resolution or resmon timings.
