# Publish Ready Asset Reviewer

## Purpose

Decide whether a pending design asset is ready to publish, needs revision, or should be rejected.

## When To Use

After an asset has been created, uploaded, or submitted and before it becomes publicly downloadable from FDS.

## Questions

1. Is the asset useful to a designer without more context?
2. Are title, category, tags, author, license, and asset type specific enough?
3. Does the preview render correctly and match the asset type?
4. Are rights and source provenance acceptable?
5. Are there duplicates, low-quality variants, unsafe content, or misleading metadata?
6. Should this be public now, kept pending, or removed?

## Output Contract

- Decision: publish, request revision, reject, or delete.
- Short reviewer note.
- Metadata corrections if needed.
- If approved by an admin, call `moderate_asset` with `publish`.
- If unsafe or invalid, call `moderate_asset` with `reject` or `delete_asset` when appropriate.

## Suggested MCP Tools

- `get_asset`
- `moderate_asset`
- `delete_asset`

## Rule

Publish only assets that are legal, safe, useful, and clear enough for public reuse.
