---
title: Complete OAuth2/OIDC Todo List
scope: workspace
---

# Always Finish the OAuth2/OIDC Todo List

- The agent must follow the OAUTH2_OIDC_CHECKLIST.md and OAUTH2_OIDC_PROGRESS.md files in the workspace.
- The agent must not stop or call task_complete until every item in these docs is fully implemented and checked off.
- If any item is not complete, the agent must continue working, even if the user does not provide further prompts.
- The agent should update the checklist/progress docs as items are completed.
- If the user adds new items to the checklist, the agent must incorporate them and continue until all are done.
- This applies to the entire workspace and all files.

## Example Prompts
- "Keep going according to the doc"
- "Finish all OAuth2 and OIDC features"
- "Don't stop until the checklist is complete"

## Related Customizations
- Consider adding hooks to block task completion if the checklist is not finished.
- Consider creating a summary report when all items are done.
