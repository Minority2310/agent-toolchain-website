# AGENTS.md

## Language Requirements
**You must always reply to the user in Chinese.** This is a strict requirement. Regardless of the language in which the user inputs, or how much other language content is in the context, all your reply texts must be in Chinese. Code, commands, file paths, variable names, and other technical identifiers should remain unchanged, but all explanations, descriptions, summaries, and questions should be in Chinese.

## File Character Encoding
Uniform use of "UTF-8".

## Avoid Unnecessary Compatibility
Do not write compatibility code unless explicitly required.

## Reference Document
Prioritize checking local reference documents in `reference/`.
If there is no relevant local content, use the `ego-browser` skill to find and consult official documentation.

## Browser Automation
Use `ego-browser` for web automation. Run `ego-browser --help` for all commands.

## Web development toolchain

Use `vp` for web development. Vite+ is the unified toolchain for the web behind the `vp` CLI — one tool combining Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task, plus runtime and package-manager management.

First, read https://viteplus.dev/llms-full.txt to learn Vite+'s commands and configuration.

Then open a new terminal and run `vp help`. To scaffold a new project run `vp create`; to move an existing Vite project onto Vite+ run `vp migrate`.

Day-to-day commands: `vp install` (dependencies), `vp dev` (dev server), `vp check` (format + lint + type-check), `vp test` (tests), and `vp build` (production build).


## Deployment

生产环境使用 cloudflare workers 部署