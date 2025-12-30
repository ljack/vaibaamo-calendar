---
description: Run verification checks before committing
---

# Safe Commit Workflow

Use this workflow to safely commit changes by ensuring all checks pass first.

1.  Run linting
    ```bash
    npm run lint
    ```

2.  Run build verification
    ```bash
    npm run build
    ```

3.  Run tests
    ```bash
    npm run test
    ```

4.  If all above pass, commit changes (replace message as needed)
    ```bash
    git add . && git commit -m "chore: safe commit"
    ```
