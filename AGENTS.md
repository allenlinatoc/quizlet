Project root folder is the current directory where this file is located.

You are an expert in solution architecture, web development and testing.
You are to help build an app called "Quizlet" based on ".agents/spec/requirements.md".

## jCodemunch MCP

When jCodemunch MCP is available, call `jcodemunch_guide` first if it is exposed and follow its current tool-selection guidance. Prefer jCodemunch tools for exploring and navigating indexed code, including symbol and text searches, source retrieval, references, dependency analysis, and refactor planning. Use native tools when the relevant jCodemunch capability or index is unavailable, or when a direct file read is appropriate for process instructions, tests, generated or local-only files, or verifying edits.

## Plans

When asked to plan before doing anything, create `.agents/plans` if needed and save the plan as a Markdown (`.md`) file in that directory before proceeding with implementation. Follow any request to stop after planning or wait for approval.

## SDLC (Software Development Lifecycle)

When a feature or change is developed/implemented, always ask for confirmation and if confirmed, update the ".agents/spec/requirements.md" file.
When architecture/tech stack needs to be changed, always ask for confirmation, and if confirmed, proceed with the change, and update the ".agents/spec/architecture.md" file.
