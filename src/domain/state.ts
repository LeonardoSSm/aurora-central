import type { LauncherFault, ModuleOpenResult, Placement } from './events'

const faults: Record<LauncherFault, string> = {
  'invalid-executable': 'O arquivo selecionado não é um executável válido.',
  'approval-changed': 'O executável mudou. Selecione e autorize o arquivo novamente.',
  'already-registered': 'Este executável já está cadastrado em outro módulo.',
  'invalid-monitor': 'O monitor selecionado não está disponível para este aplicativo.',
  storage: 'O registro local está indisponível. Verifique se há outra instância do Central aberta.',
  spawn: 'O sistema recusou a inicialização do executável.',
  'exited-early': 'O processo encerrou com erro durante a inicialização.',
  'process-discovery': 'Não foi possível verificar os processos da sessão.',
  'dialog-busy': 'Já há uma seleção de executável em andamento.',
  dialog: 'Não foi possível ler a seleção do diálogo.',
  platform: 'A operação está indisponível no ambiente atual.',
}

const placement: Record<Placement, string> = {
  'not-requested': '',
  requested: ' Posicionamento solicitado.',
  confirmed: ' Janela no monitor preferido.',
  'fallback-requested': ' Posicionamento solicitado em outro monitor disponível.',
  'fallback-confirmed': ' Janela em outro monitor disponível.',
  unavailable: ' Posicionamento indisponível.',
}

export function faultNotice(reason: unknown): string {
  return typeof reason === 'string' && Object.hasOwn(faults, reason)
    ? faults[reason as LauncherFault]
    : faults.platform
}

export function moduleNotice(result: ModuleOpenResult): string {
  switch (result.status) {
    case 'not-configured': return 'Nenhum executável configurado.'
    case 'not-installed': return 'Executável cadastrado não encontrado.'
    case 'available': return 'Executável disponível.'
    case 'starting': return 'Processo iniciado. Aguardando janela.'
    case 'running': {
      const observation = {
        detected: 'Janela identificada.',
        'not-detected': 'Janela ainda não identificada.',
        unsupported: 'Detecção de janelas indisponível nesta sessão.',
      }[result.window]
      return `Em execução. ${observation}${placement[result.placement]}`
    }
    case 'focus-requested':
      return {
        confirmed: 'Foco confirmado.',
        requested: 'Foco solicitado. O sistema ainda não confirmou.',
        denied: 'O sistema recusou a solicitação de foco.',
      }[result.focus]
    case 'unavailable': return 'Abertura indisponível no ambiente atual.'
    case 'browser': return 'A abertura de aplicativos requer o Aurora Central desktop.'
    case 'error': return faultNotice(result.reason)
    case 'finished': return 'O processo já encerrou.'
    case 'timeout': return 'Tempo de resposta excedido. Consulte o estado do aplicativo.'
  }
}
