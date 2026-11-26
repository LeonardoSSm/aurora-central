import { modules, type ModuleId } from '../domain/registry'
import type { ModuleOpenResult } from '../domain/events'
import { moduleNotice } from '../domain/state'
import { IntelligenceError } from './contracts'

export type CommandName = 'module.describe' | 'module.open'
export type CommandPermission = 'modules:read' | 'modules:open'

export interface CommandProposal {
  readonly name: CommandName
  readonly args: { readonly moduleId: ModuleId }
}

export interface PreparedCommand {
  readonly label: string
  readonly confirmationRequired: boolean
}

const descriptions: Record<ModuleId, string> = {
  board: 'Espaço de organização do ecossistema.',
  control: 'Monitoramento e observabilidade.',
  lens: 'Entrada para os recursos do Aurora Lens.',
  nexus: 'Memória, conhecimento e contexto.',
}

const definitions = {
  'module.describe': { permission: 'modules:read', confirmationRequired: false },
  'module.open': { permission: 'modules:open', confirmationRequired: true },
} as const satisfies Record<CommandName, { permission: CommandPermission; confirmationRequired: boolean }>

export function hasFields<const Field extends string>(
  value: unknown, ...fields: Field[]
): value is Record<Field, unknown> {
  return typeof value === 'object' && value !== null &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field))
}

export function createCommandRegistry(openModule: (id: ModuleId, signal: AbortSignal) => Promise<ModuleOpenResult>) {
  const prepared = new WeakMap<PreparedCommand, (signal: AbortSignal) => string | Promise<string>>()
  const authorized = new WeakSet<PreparedCommand>()

  return {
    prepare(raw: unknown, permissions: readonly CommandPermission[]): PreparedCommand {
      if (!hasFields(raw, 'name', 'args') ||
        (raw.name !== 'module.describe' && raw.name !== 'module.open') ||
        !hasFields(raw.args, 'moduleId')) {
        throw new IntelligenceError('command-invalid')
      }
      const moduleId = raw.args.moduleId
      const module = modules.find(({ id }) => id === moduleId)
      if (!module) throw new IntelligenceError('command-invalid')
      const { permission, confirmationRequired } = definitions[raw.name]
      if (!permissions.includes(permission)) throw new IntelligenceError('command-forbidden')

      const label = `Aurora ${module.name}`
      const command = Object.freeze({ label, confirmationRequired })
      prepared.set(command, raw.name === 'module.describe'
        ? () => `${label} · ${descriptions[module.id]}`
        : async (signal) => {
          const result = await openModule(module.id, signal)
          const notice = `${label} · ${moduleNotice(result)}`
          if (result.status === 'running' || (result.status === 'focus-requested' && result.focus !== 'denied')) {
            return notice
          }
          throw new IntelligenceError('command-failed', notice)
        })
      return command
    },

    authorize(command: PreparedCommand) {
      if (prepared.has(command) && command.confirmationRequired) authorized.add(command)
    },

    async execute(command: PreparedCommand, signal: AbortSignal) {
      const run = prepared.get(command)
      prepared.delete(command)
      const approved = authorized.delete(command)
      signal.throwIfAborted()
      if (!run || (command.confirmationRequired && !approved)) throw new IntelligenceError('command-forbidden')
      return run(signal)
    },
  }
}

export type CommandRegistry = ReturnType<typeof createCommandRegistry>
