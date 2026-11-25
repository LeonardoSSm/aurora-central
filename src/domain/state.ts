import type { ModuleOpenSettled } from './events'

export function moduleNotice(event: ModuleOpenSettled): string {
  switch (event.result.status) {
    case 'unavailable':
      return 'Abertura indisponível no Ciclo 01.'
    case 'opened':
      return 'Aplicativo aberto.'
    case 'failed':
      return 'Não foi possível abrir o aplicativo.'
  }
}
