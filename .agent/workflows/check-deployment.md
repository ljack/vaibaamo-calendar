---
description: Check GitHub Actions and Vercel deployment status
---

1. Check the status of the latest GitHub Action workflow run:
   ```bash
   gh run list --limit 3
   ```

2. If you are working on a PR, check the PR checks (which usually includes Vercel deployment status):
   ```bash
   gh pr checks
   ```

3. If you need to see the latest commit deployment status specifically or if not in a PR:
   ```bash
   gh run watch
   ```
   (This will stream the status until it completes)

4. For Vercel specific logs or URLs, usually looking at the PR checks output or the GitHub Actions log for the deployment step is the best CLI approach.
