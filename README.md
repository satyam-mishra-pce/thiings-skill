# Thiings skill

A coding-agent skill for finding and downloading 3D PNG graphics from [Thiings.co](https://www.thiings.co/things).

## Install

Copy or clone this directory into your agent's skills directory. For Claude Code:

```bash
git clone <repository-url> ~/.claude/skills/thiings
```

Restart the agent after installing it. The skill activates when you ask for a Thiings graphic, 3D icon, object illustration, or similar asset.

You can also run the helper yourself:

```bash
node scripts/thiings.mjs search "paper plane" --limit 8
node scripts/thiings.mjs download paper-plane ./public/images/paper-plane.png
```

Node.js 18 or newer is required. There are no package dependencies.

## Licensing

Free individual downloads are limited to personal, non-commercial use and require visible attribution. Commercial work needs an appropriate paid license. Read the current [Thiings terms](https://www.thiings.co/terms) before shipping an asset.
