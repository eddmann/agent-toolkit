---
name: project
description: "Use when asked to find a project, work on a project, start a feature, fix a bug, or make changes to a repo."
user-invocable: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/project *)
config:
  PROJECTS_HOME:
    description: "Directory containing primary project repos"
    default: "~/Projects"
  PROJECTS_CLONE_DIR:
    description: "Directory for managed working clones"
    default: "~/.projects"
---

# Project Manager

Primary repos stay clean on main in `$PROJECTS_HOME`. Working clones live in `$PROJECTS_CLONE_DIR/<project>/<clone>/`.

Use `${CLAUDE_SKILL_DIR}/scripts/project` for all commands.

## Workflow

0. **`list`** to find the project if you don't know the exact name
1. **`create`** a clone — never work in the primary repo directly
2. **`switch`** to get the clone path, then `cd` there
3. Work normally — edit files, commit often
4. Tell the user the clone is ready for review
5. The user will **`accept`** or **`discard`**

## Commands

```bash
# find projects
scripts/project list                                       # all projects and their clones
scripts/project list auth                                  # filter by name
scripts/project list --status active --limit 5

# clone lifecycle
scripts/project create <project> --name <name> --desc "what this work is for"
scripts/project create my-app                              # auto-generates name
scripts/project switch <project> <clone>                   # get clone path
scripts/project sync <project> <clone>                     # pull latest main into clone
scripts/project diff <project> <clone>                     # commits + diff vs main
scripts/project accept <project> <clone>                   # apply commits to primary
scripts/project discard <project> <clone>                  # delete clone
scripts/project cleanup [--stale-days 7]                   # purge finished clones
```

## Rules

1. **Never modify the primary repo directly** — always work in a clone
2. **Commit early and often** — these become the patches on accept
3. **One feature per clone** — keep work isolated
4. **Check `list` first** — a relevant clone may already exist
