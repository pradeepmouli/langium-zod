---
name: dependabit-bootstrap
description: Bootstrap and configure Dependabit in any GitHub repository. Dependabit is an AI-powered tracker for external informational dependencies (documentation sites, research papers, API schemas, reference implementations) beyond traditional package managers. Use this skill when setting up Dependabit, adding dependency tracking workflows, configuring Dependabit for a repo, or when the user asks to track external dependencies, monitor documentation changes, or set up AI-powered dependency discovery.
---

# Dependabit Bootstrap

Set up [Dependabit](https://github.com/pradeepmouli/dependabit) in a repository to automatically discover, track, and monitor external informational dependencies using LLM-powered analysis.

## What Dependabit Tracks

Unlike Dependabot (which tracks package manager dependencies), Dependabit tracks **informational dependencies**:
- Documentation sites (React docs, API references, etc.)
- Research papers (arXiv, academic publications)
- API schemas and specifications (OpenAPI specs)
- Reference implementations (GitHub repos, example code)
- External resources referenced in code and docs

## Bootstrap Workflow

Setting up Dependabit involves these steps:

1. Detect default branch and repo structure
2. Create the GitHub Actions workflow files
3. Optionally create a configuration file
4. Instruct the user to trigger the initial manifest generation

### Step 1: Detect Repository Context

Before creating files, determine:
- The default branch name (`main` or `master`) for workflow triggers
- Whether `.github/workflows/` directory exists (create if not)
- Whether `.dependabit/` directory already exists

### Step 2: Create Workflow Files

Copy the three workflow templates from `assets/` into `.github/workflows/`:

| Asset File | Target Path | Purpose |
|---|---|---|
| `assets/dependabit-generate.yml` | `.github/workflows/dependabit-generate.yml` | One-time manifest generation (manual trigger) |
| `assets/dependabit-update.yml` | `.github/workflows/dependabit-update.yml` | Auto-update manifest on push |
| `assets/dependabit-check.yml` | `.github/workflows/dependabit-check.yml` | Periodic monitoring for changes |

Read each asset file and write it to the target path. Adjust the branch name in `dependabit-update.yml` if the repo uses `master` instead of `main`.

**LLM Provider Configuration**: The templates default to `github-copilot` as the LLM provider (zero additional setup required). If the user prefers a different provider, update the `llm_provider` field:
- `github-copilot` (default) - Uses GitHub Copilot via `GITHUB_TOKEN`, no extra secrets needed
- `claude` - Requires `ANTHROPIC_API_KEY` secret
- `openai` - Requires `OPENAI_API_KEY` secret

When changing provider, also update the `llm_api_key` input to reference the appropriate secret.

### Step 3: Create Configuration (Optional)

If the user wants custom behavior, create `.dependabit/config.yml` from `assets/config.yml`. Common customizations:

- **Schedule**: Change monitoring frequency (`hourly`, `daily`, `weekly`, `monthly`)
- **AI Agent Assignment**: Route issues to AI agents by severity (e.g., `@copilot` for minor, `@claude` for breaking)
- **Ignore patterns**: Exclude specific URLs, types, or patterns
- **Per-dependency overrides**: Custom schedules for specific dependencies

If the user doesn't need customization, skip this step - Dependabit works with sensible defaults.

### Step 4: Instruct User on Next Steps

After creating the files, tell the user:

1. **Commit and push** the new workflow files to the default branch
2. **Go to the Actions tab** in the GitHub repository
3. **Run "Dependabit - Generate Manifest"** manually to create the initial `.dependabit/manifest.json`
4. After generation completes, subsequent pushes will automatically update the manifest
5. Daily checks will monitor dependencies for changes and create issues

If the user wants to use a non-default LLM provider, remind them to add the appropriate API key as a GitHub Actions secret first.
