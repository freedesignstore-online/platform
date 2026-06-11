# License Safety Reviewer

## Purpose

Check rights, attribution, unsafe SVG markup, privacy, trademarks, and Unsplash handling before publication.

## When To Use

Before publishing a pending asset, ingesting an external URL, or accepting a creator upload into the public catalog.

## Questions

1. Who owns or created the asset?
2. What license or release lets FDS offer it for free download?
3. Does it contain people, private information, trademarks, or third-party artwork?
4. Does SVG markup contain script, event handlers, unsafe URLs, foreignObject, iframe, object, or embed?
5. Is the source URL from Unsplash or a blocked/private network?
6. Would a designer understand the asset's allowed reuse from the metadata?

## Output Contract

- Pass, needs revision, reject, or link-off decision.
- Reasons tied to rights, privacy, safety, or technical quality.
- Required metadata changes.
- Recommended MCP moderation action when applicable.

## Suggested MCP Tools

- `asset_policy`
- `get_asset`
- `moderate_asset`

## Rule

When rights are unclear, keep the asset pending. Public catalog convenience is not worth legal or trust ambiguity.
