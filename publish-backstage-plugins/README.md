# Publish Backstage Plugins

This GitHub composite action discovers Backstage plugins in the local `plugins/` directory, builds them, assigns a release version, packs them, and publishes them to both the GitHub npm and npmjs.org registries.

It is intended for monorepos that contain one or more Backstage plugins under `plugins/<plugin-name>`.

## Important versioning note

**The published package version is derived from the root `package.json`, not from each plugin's own `package.json`.**

The action reads the version from the repository root `package.json`, removes any existing prerelease suffix, and then generates the final published version based on the branch and commit SHA. That generated version is then written into each plugin package before packing and publishing.

## What it does

The action performs the following steps:

1. Checks out the repository with full history
2. Sets up Node.js 22
3. Enables Yarn 4.4.1 through Corepack
4. Installs dependencies using `yarn install`
5. Generates TypeScript declaration files with `yarn tsc`
6. Determines a release version from the **root `package.json` version**
7. Discovers plugin packages under `plugins/`
8. Builds each plugin with `yarn build`
9. Updates each plugin's `package.json` version to the generated release version and removes the `private` flag
10. Performs a preflight check to ensure the target package versions do not already exist
11. Packs each plugin into an npm tarball
12. Publishes each tarball to the GitHub npm and npmjs.org registries
13. Writes action outputs for downstream workflow steps
14. Writes a summary to the GitHub Actions job summary

## Requirements

This action assumes:

- Your repository uses Yarn
- Your repository contains Backstage plugins under `plugins/`
- Each plugin directory contains a valid `package.json`
- Each plugin can be built by running `yarn build` inside its own directory
- The **root `package.json` contains the version that will be used as the basis for all published plugin versions**
- Packages are published to the GitHub Packages npm registry
- Package names use the `@bcgov` scope

## Inputs

### `token`

GitHub token used to authenticate against GitHub Packages.

Required: `true`

This token must have permission to publish packages. **Always pass this value using a GitHub Secret (e.g., `${{ secrets.GITHUB_TOKEN }}`).**


### `dispatch_repo`

Optional. The full name of a downstream repository to trigger (e.g., `bcgov/backstage-app`).

### `dispatch_token`

Optional. A Personal Access Token (PAT) with permissions to trigger actions on the `dispatch_repo`. **Always pass this value using a GitHub Secret.**

#### How to create the `dispatch_token`
1. Navigate to your GitHub **Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens**.
2. Click **Generate new token**.
3. **Resource owner**: Select the organization that owns the **target** repository.
4. **Repository access**: Select **Only select repositories** and choose the target repository (e.g., `csit-developer-portal-poc`).
5. **Permissions**: Under **Repository permissions**, find **Actions** and select **Access: Read and Write**.
6. Click **Generate token** and copy the value into a Secret in your plugin repository.

**Security Note:** Cross-repository triggers require a token with write access to the destination. Using a **Fine-grained PAT** is the recommended way to maintain the principle of least privilege.

### `dispatch_workflow`

Optional. The filename or ID of the workflow in the `dispatch_repo` to trigger (e.g., `update-plugins.yml`).

### `dispatch_branch`

Optional. The branch (ref) in the target repository to run the workflow on. Defaults to `main`.

## Outputs

This action exposes the following outputs for use in later workflow steps.

### `version`

The generated release version derived from the root `package.json`.

Example:

```yaml
${{ steps.publish_plugins.outputs.version }}
```

### `published_package_versions`

A JSON array describing the packages that were published.

Example shape:

```json
[
  {
    "name": "@bcgov/plugin-a",
    "version": "1.2.4-main.abcdef12",
    "path": "plugins/plugin-a"
  },
  {
    "name": "@bcgov/plugin-b",
    "version": "1.2.4-main.abcdef12",
    "path": "plugins/plugin-b"
  }
]
```

### `plugin_count`

The number of plugins published.

Example:

```yaml
${{ steps.publish_plugins.outputs.plugin_count }}
```

## Versioning strategy

**All published plugin versions are based on the version in the root `package.json`.**

The action calculates the publish version from the root `package.json` version and the current Git ref.

### How the base version is determined

The action runs this logic against the repository root:

```bash
ROOT_VERSION="$(node -p "require('./package.json').version")"
BASE_VERSION="$(echo "$ROOT_VERSION" | sed 's/-.*//')"
```

That means:

- It reads `version` from the root `package.json`
- It strips any existing prerelease suffix
- It uses that stripped value as the base for all published plugin versions

Example:

- Root version: `1.2.3`
- Base version used for publishing: `1.2.3`

Example with prerelease input:

- Root version: `1.2.3-beta.1`
- Base version used for publishing: `1.2.3`

### Main branch

If the workflow runs on `refs/heads/main`, the action:

- Reads the version from the **root `package.json`**
- Removes any prerelease suffix
- Increments the patch number by 1
- Appends `-main.<sha8>`

Example:

- Root version: `1.2.3`
- Commit SHA: `abcdef123456...`
- Published version: `1.2.4-main.abcdef12`

### Other branches

If the workflow runs on any non-main branch, the action:

- Reads the version from the **root `package.json`**
- Removes any prerelease suffix
- Normalizes the branch name
- Appends `-feature.<branch-name>.<sha8>`

Example:

- Root version: `1.2.3`
- Branch: `feature/my-new-plugin`
- Commit SHA: `abcdef123456...`
- Published version: `1.2.3-feature.my-new-plugin.abcdef12`

## Plugin discovery

The action searches for plugin directories using:

```bash
find plugins -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/package.json' ';' -print
```

Only direct subdirectories of `plugins/` that contain a `package.json` are included.

## Publish flow

For each discovered plugin, the action:

- Runs `yarn build`
- Sets the plugin `package.json.version` to the generated release version
- Removes `private` from the plugin `package.json`
- Creates an npm tarball using `npm pack`
- Publishes the tarball with `npm publish`

Before publishing, it checks whether that exact package version already exists in GitHub Packages (or npmjs.org if we're publishing there as well). If any package version already exists, the action fails before publishing anything.

## Updating downstream repositories

If `dispatch_repo`, `dispatch_token`, and `dispatch_workflow` are provided, the action will trigger a `workflow_dispatch` event in the target repository.

The triggered workflow receives the following input:
- `packages`: A stringified JSON array of the published packages (name and version).

## Example usage

```yaml
name: Publish Plugins

on:
  push:
    branches:
      - main
      - 'feature/**'

jobs:
  publish:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      packages: write
      id-token: write

    steps:
      - name: Publish Backstage plugins
        id: publish_plugins
        uses: bcgov/aps-devops/publish-backstage-plugins@dev
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          dispatch_repo: 'bcgov/backstage-app'
          dispatch_token: ${{ secrets.DISPATCH_PAT }}
          dispatch_workflow: 'update-plugins.yml'
          dispatch_branch: 'main'

      - name: Show publish outputs
        shell: bash
        run: |
          echo "Version: ${{ steps.publish_plugins.outputs.version }}"
          echo "Plugin count: ${{ steps.publish_plugins.outputs.plugin_count }}"
          echo 'Published packages: ${{ steps.publish_plugins.outputs.published_package_versions }}'
          echo 'Target repo status: ${{ steps.publish_plugins.outputs.target_repo_status }}'
```

## Registry configuration

The action publishes to:

```text
https://npm.pkg.github.com
```

and

```text
https://npmjs.com
```

## GitHub Actions summary

The action writes a summary to the workflow run that includes:

- Calculated release version
- Git ref and commit SHA
- Planned packages
- Published packages
- Example install commands

## Failure conditions

The action will fail if:

- No plugins are found under `plugins/`
- Dependency installation fails
- TypeScript declaration generation fails
- Any plugin build fails
- A target package version already exists in either registry
- A tarball is not created as expected
- Publishing any package fails

## Notes

- The published package version is based on the **root `package.json` version**
- The action mutates each plugin's `package.json` during the workflow by changing the version and removing `private`
- Those changes occur only in the workflow workspace and are not committed back to the repository
- Temporary working files are written under `/tmp`
- The `published_package_versions` output is JSON, so downstream steps may want to parse it before using individual fields

## Expected repository structure

```text
.
├── package.json
├── plugins
│   ├── plugin-a
│   │   ├── package.json
│   │   └── ...
│   └── plugin-b
│       ├── package.json
│       └── ...
└── .github
    └── actions
        └── publish-backstage-plugins
            └── action.yml
```

## Tips

- Keep the **root `package.json` version** up to date, since all published plugin versions are derived from it
- Ensure each plugin has a working `build` script
- Use branch names that normalize cleanly into prerelease identifiers
- Grant the below permissions to the workflow job
  - `packages: write`
  - `contents: write`
  - `id-token: write`
- This action relies on NPM Trusted Publishing being configured. See https://docs.npmjs.com/trusted-publishers for 
  more information.