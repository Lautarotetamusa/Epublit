import { cpSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Port de los hooks de Claude Code de Epublit a OpenCode V2.
 *
 * `planner-file-guard.sh` NO vive acá: se replica con `permissions` del agente
 * `planner` (.opencode/agents/planner.md), que es el lugar correcto.
 *
 * Acá van los dos chequeos previos al spawn, que en Claude Code eran hooks
 * PreToolUse sobre el tool `Agent`:
 *   - ensure-design-system.sh      -> front-designer y front-implementer
 *   - ensure-impeccable-skill.sh   -> front-designer
 *
 * Se implementan con el hook `permission.evaluate`, que es el único punto del
 * harness V2 que puede negar una acción (action/subagent + resource/<agentID>).
 */

const DESIGN_SYSTEM_AGENTS = new Set(["front-designer", "front-implementer"])

function projectRoot(ctx: any): string {
  return ctx?.location?.project?.canonical ?? ctx?.location?.directory ?? process.cwd()
}

function checkDesignSystem(root: string): string | undefined {
  const designSystem = join(root, "front", "src", "design-system")
  const hasBarrel = existsSync(join(designSystem, "index.ts"))
  const hasReadme = existsSync(join(designSystem, "readme.md"))
  if (hasBarrel && hasReadme) return undefined
  return (
    "front-designer / front-implementer necesitan front/src/design-system/ " +
    "(con su barrel index.ts y readme.md) y no está, o está incompleto. " +
    "Generá/restaurá el sistema de diseño del proyecto antes de correr este agente."
  )
}

function ensureImpeccableSkill(root: string): string | undefined {
  const projectSkill = join(root, ".claude", "skills", "impeccable")
  if (existsSync(join(projectSkill, "SKILL.md"))) return undefined

  const userSkill = join(homedir(), ".claude", "skills", "impeccable")
  if (existsSync(join(userSkill, "SKILL.md"))) {
    try {
      mkdirSync(join(root, ".claude", "skills"), { recursive: true })
      cpSync(userSkill, projectSkill, { recursive: true })
      return undefined
    } catch (error) {
      return (
        "No se pudo instalar la skill 'impeccable' en .claude/skills/impeccable/ " +
        `desde ~/.claude/skills/impeccable: ${String(error)}`
      )
    }
  }

  return (
    "front-designer necesita la skill 'impeccable' (impeccable.style) instalada en " +
    ".claude/skills/impeccable/ y no se encontró ni en el proyecto ni en " +
    "~/.claude/skills/impeccable. Instalala antes de correr este agente."
  )
}

export default {
  id: "epublit.hooks",
  async setup(ctx: any) {
    // El hook corre para decisiones allow/ask (una denegación explícita de config
    // es final y no llega acá), que es exactamente el caso de un spawn permitido.
    await ctx.permission.hook("evaluate", (event: any) => {
      if (event.action !== "subagent") return
      const requested: string[] = Array.isArray(event.resources) ? event.resources : []
      if (requested.length === 0) return

      const root = projectRoot(ctx)

      for (const agentID of requested) {
        if (DESIGN_SYSTEM_AGENTS.has(agentID)) {
          const problem = checkDesignSystem(root)
          if (problem) {
            event.effect = "deny"
            event.message = problem
            return
          }
        }
        if (agentID === "front-designer") {
          const problem = ensureImpeccableSkill(root)
          if (problem) {
            event.effect = "deny"
            event.message = problem
            return
          }
        }
      }
    })
  },
}
