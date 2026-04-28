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
3. Upgrades npm to the latest version (required for OIDC Trusted Publishing)
4. Enables Yarn 4.4.1 through Corepack
5. Installs dependencies using `yarn install`
6. Generates TypeScript declaration files with `yarn tsc`
7. Determines a release version from the **root `package.json` version**
8. Discovers plugin packages under `plugins/`
9. Builds and prepares each plugin (updates version and removes `private` flag)
10. Writes a summary of planned packages to the job summary
11. Performs a preflight check to ensure the target package versions do not already exist
12. Packs each plugin into an npm tarball
13. Publishes each tarball to **npmjs.org** with provenance and dist-tags
14. Publishes each tarball to the **GitHub Packages** npm registry
15. Finalizes action outputs for downstream workflow steps
16. Writes a detailed summary of published packages to the job summary
17. (Optional) Updates a downstream repository by committing updated plugin dependency versions

## Requirements
- Your repository uses Yarn
- Your repository contains Backstage plugins under `plugins/`
- Each plugin directory contains a valid `package.json`
- Each plugin can be built by running `yarn build` inside its own directory
- The **root `package.json` contains the version that will be used as the basis for all published plugin versions**

## Inputs

### `token`

GitHub token used to authenticate against GitHub Packages.

Required: `true`

This token must have permission to publish packages. **Always pass this value using a GitHub Secret (e.g., `${{ secrets.GITHUB_TOKEN }}`).**

### `dispatch_repo`

Optional. The full name of a downstream repository to update (e.g., `owner/repo-c`).

### `dispatch_ssh_key`

Optional. SSH private key with access to the target repository for dispatching updates. **Always pass this value using a GitHub Secret.**

To set up SSH authentication:

1. Generate an SSH key pair (if you don't have one):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-dispatch" -f dispatch_key -N ""
   ```

2. Add the public key as a Deploy Key to the downstream repository:
   1. Go to the downstream repo (`dispatch_repo`) -> Settings -> Deploy Keys
   2. Click `Add deploy key`
   3. Paste contents of `dispatch_key.pub`
   4. Check `Allow write access` (required for pushing commits)
   5. Save

3. Store the private key as a secret in the upstream repository:
   1. Go to the upstream repo -> Settings -> Secrets and Variables -> Actions
   2. Click `New repository secret`
      1. Name: `DISPATCH_SSH_KEY` (or your preferred name)
      2. Value: Paste the entire contents of the private key file
   3. Save


### `dispatch_branch`

Optional. The branch (ref) in the target repository to commit to. If not specified, 
it will be set based on the branch in the current repository:
- for `main` or `feature/*` branches, use the same branch name (creating the `feature/*` branch if necessary)
- otherwise, use `main`


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

### `target_repo_status`

The status of the downstream repository update. `updated`, `no-changes`, or `skipped`

Example:

```yaml
${{ steps.publish_plugins.outputs.target_repo_status }}
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

Before publishing, it checks whether that exact package version already exists in GitHub Packages or npmjs.org. If any package version already exists, the action fails before publishing anything.

## Updating downstream repositories

If `dispatch_repo` and `dispatch_ssh_key` are provided, the action will automatically update the downstream repository with the latest published plugin versions.

### How it works

1. Clones the downstream repository using SSH authentication
2. For each published plugin, runs `yarn up <package-name>@<version> --mode=update-lockfile` to update the dependency
3. Commits the updated `package.json` and `yarn.lock` files
4. Pushes the commit to the specified branch of the downstream repository

### Monorepo support

The action supports monorepos with multiple `package.json` files. The `yarn up` command will find and update the specified packages wherever they appear in the monorepo's workspace structure.

Example scenario:
```
downstream-repo/
├── package.json
├── apps/
│   └── app-a/
│       └── package.json
└── packages/
    └── lib-b/
        └── package.json
```

If plugins are dependencies in multiple `package.json` files, `yarn up` will update all of them.

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
          dispatch_ssh_key: ${{ secrets.DISPATCH_SSH_KEY }}
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

The action publishes to two registries:

1. **GitHub Packages** (`https://npm.pkg.github.com`)
   - Requires `NODE_AUTH_TOKEN` from the `token` input
   - Used for internal/private distribution

2. **npmjs.org** (`https://registry.npmjs.org`)
   - Uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) for authentication
   - No additional secrets required
   - Publishes with dist-tags: the package version and either `latest` (main branch) or `dev` (other branches)

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
- If `dispatch_repo` and `dispatch_ssh_key` are provided, the `dispatch_repo` must have a `main` branch

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
- Grant the below permissions to the workflow job:
  - `packages: write` (for publishing to GitHub Packages)
  - `contents: write` (for reading repository contents and committing to downstream repos)
  - `id-token: write` (for npm Trusted Publishing authentication)
- This action requires npm Trusted Publishing to be configured. See https://docs.npmjs.com/trusted-publishers for setup instructions
- For downstream repository updates, ensure the deploy key has write access and the target branch exists
- The downstream repository should be a Yarn workspace or monorepo for the `yarn up` commands to work correctly