# AppForge UI tooling migration

This candidate upgrades AppForge itself from Tailwind 3 to Tailwind 4.3.3 and uses the Tailwind PostCSS plugin. It removes the vulnerable development dependency chain rather than overriding incompatible transitive versions. It depends on the lint-staged 17.6.0 change and Node >=22.22.1 in PR #129.

The migration preserves AppForge theme tokens and light/dark behavior, adds the documented border-color compatibility rule, and renames affected UI utilities. Generated-product recipes and agent instructions retain their existing tooling; this change applies to the AppForge UI. Review corrected an upgrade-tool replacement of the user-facing course-outline button text.

Tailwind 4 requires Safari 16.4+, Chrome 111+, and Firefox 128+. This is a browser-support change that must be considered before release. Official guide: https://tailwindcss.com/docs/upgrade-guide .

Verification includes the real lint-staged configuration, full dependency audit, type checks, lint, production build, full source tests, desktop comparison and mobile menu/theme behavior. Final results are recorded in the PR after completion. No release or paying-customer certification is implied by this local candidate.
