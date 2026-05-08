# Publishing to npmjs.com

This project publishes the package `html-to-pdf-document` to npmjs.com.

## Prerequisites

1. Make sure you have an npm account with publish access to this package.
2. Log in locally:

```sh
npm login
```

3. Confirm the active npm user:

```sh
npm whoami
```

## Before publishing

Run the full verification pipeline:

```sh
npm run prepublishOnly
```

This runs:

- `npm run typecheck`
- `npm test`
- `npm run build`

Renderer changes, type changes, and README/documentation changes should be made before this step so `dist` and the npm README stay in sync.

You can also inspect the package contents without publishing:

```sh
npm pack --dry-run
```

Confirm the dry-run output includes the current `README.md`, `LICENSE`, `package.json`, and rebuilt `dist` files. The README shown on npm comes from this package tarball.

The published package is limited by the `files` field in `package.json`, currently:

- `dist`
- `README.md`
- `LICENSE`

Runtime dependencies are declared in `dependencies`, so npm installs `html2canvas` and `jspdf` automatically for users who run `npm install html-to-pdf-document`.

## Version the package

Choose the right semantic version bump:

```sh
npm version patch
npm version minor
npm version major
```

Use:

- `patch` for backwards-compatible fixes.
- `minor` for backwards-compatible features.
- `major` for breaking API changes.

`npm version` updates `package.json`, updates `package-lock.json`, creates a git commit, and creates a git tag.

## Publish

Publish the current package to npmjs.com:

```sh
npm run publish:npm
```

That script runs:

```sh
npm publish --access public
```

The `prepublishOnly` script runs automatically before npm publishes, so typecheck, tests, and build must pass before the package is uploaded.

## After publishing

Confirm the published version:

```sh
npm view html-to-pdf-document version
```

Push the version commit and tag:

```sh
git push
git push --tags
```

## Common issues

### Not logged in

If publish fails with an authentication error, run:

```sh
npm login
npm whoami
```

### Package name unavailable

If npm says the package name is already taken, update the `name` field in `package.json` to an available name or publish under a scope, for example `@your-scope/html-to-pdf-document`.

### Two-factor authentication

If your npm account requires two-factor authentication, npm will prompt for a one-time password during publish.

### Dry-run cache permission error

If `npm pack --dry-run` fails because of local npm cache permissions, use a temporary cache:

```sh
npm pack --dry-run --cache /tmp/html-to-pdf-document-npm-cache
```
