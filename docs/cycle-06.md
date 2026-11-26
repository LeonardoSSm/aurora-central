# Ciclo 06 — Configurações persistentes e personalização

O painel **Configurações** fica no rodapé da home e reúne Geral, Aparência, Desempenho, Aplicativos, Monitores e Acessibilidade. O atalho **Aplicativos** abre diretamente a categoria. A prévia usa o canvas da home. **Fechar** ou Esc descarta o rascunho. **Restaurar padrões** prepara a restauração para conferência e **Aplicar** confirma a gravação. A demonstração do núcleo continua com ajustes de sessão. [Issue #7](https://github.com/LeonardoSSm/aurora-central/issues/7) · [Referência oficial](visual-identity.md)

## Schema v1

O Rust é a fonte de verdade do schema de `settings.json`, no diretório de configuração resolvido pelo Tauri. A WebView usa o contrato equivalente em TypeScript. Os objetos rejeitam campos extras e o arquivo tem limite de 128 KiB.

| Campo | Valores | Padrão |
| --- | --- | --- |
| `version` | Inteiro discriminador do schema | `1` |
| `initialView` | `central`, `immersive`, `ambiental` | `central` |
| `motion` | `system`, `reduced` | `system` |
| `graphics.profile` | `low`, `medium`, `high`, `ultra` | `medium` |
| `graphics.quality` | `standard`, `economy` (halo simplificado) | `standard` |
| `graphics.palette` | `aurora`, `nebula`, `ember`, `glacier` | `aurora` |
| `graphics.particleCount` | Nulo segue o perfil. Inteiro entre 5.000 e 100.000 sobrescreve a densidade. | Nulo (20.000 no perfil Médio) |
| `graphics.brightness` | Inteiro de 25 a 150% | 100% |
| `graphics.speed` | Inteiro de 25 a 175% | 100% |
| `graphics.fps` | 30, 45, 60, 90 ou 120 | 60 |
| `graphics.dpr` | 1, 1,25, 1,5 ou 2 | 1,5 |
| `graphics.resolution` | 50, 75 ou 100% da resolução após aplicar o DPR | 100% |
| `graphics.background` | `adaptive` (até 20 FPS), `pause` ou `continue` quando visível sem foco. Uma janela oculta pausa o desenho. | `adaptive` |
| `modules` | Preferências para `board`, `control`, `nexus` e `lens` | Quatro entradas |
| `modules.<id>.opening` | `launch-or-reuse`, `running-only` | `launch-or-reuse` |
| `modules.<id>.focusExisting` | Booleano | `true` |
| `modules.<id>.preferredMonitor` | ID hexadecimal minúsculo de 64 caracteres ou nulo. Control usa posicionamento próprio. | Nulo |

As alterações de visualização inicial entram em vigor ao remontar a home, inclusive ao reiniciar o aplicativo. Os modos existentes continuam acessíveis pelos atalhos. O movimento reduzido acompanha a preferência do sistema e pode ser forçado no painel. Ele pausa a animação do núcleo e remove o pulso e as transições orbitais.

## Settings Manager

- `settings_snapshot` retorna a configuração validada, o estado do armazenamento e uma revisão da sessão. `settings_save` recebe a revisão esperada e a configuração completa. Revisões obsoletas são recusadas. Os comandos são exclusivos da WebView local `main`.
- O Settings Manager e o launcher compartilham o mutex do estado desktop e o lock exclusivo do perfil. O mesmo lock protege a migração e mantém a exclusão mútua com versões anteriores. A rotina de disco compartilhada grava em arquivo temporário no mesmo diretório, sincroniza o conteúdo e o substitui atomicamente. Em Unix, tenta sincronizar o diretório. A revisão e o snapshot só mudam após o sucesso da substituição.
- Na ausência de `settings.json`, o migrador lê o monitor associado à autorização legada da plataforma em `launcher-v1.json` e grava as preferências migradas. Os IDs já salvos podem sobreviver à desconexão. Novas seleções exigem um monitor elegível no Windows. O arquivo legado continua legível durante atualizações.
- Conteúdo inválido é substituído por padrões validados e o painel informa a recuperação. Falha de acesso ou lock deixa a prévia disponível. Um arquivo legível que indica versão superior é preservado e o armazenamento fica em modo de leitura. Este é o primeiro schema próprio de preferências. Versões futuras podem acrescentar conversões no ponto de leitura, antes da validação do schema atual.
- O arquivo comum contém preferências. Autorizações continuam no registro nativo e passam pela seleção, confirmação e revalidação de arquivo do Ciclo 04. **Restaurar padrões** redefine preferências por módulo. **Remover** em Aplicativos revoga uma autorização específica. Novas preferências são consumidas nas aberturas seguintes. O registro nativo depende da fronteira de confiança do usuário local já documentada. Credenciais, tokens, áudio, transcrições e histórico ficam fora do schema. Credenciais de integrações futuras exigirão armazenamento seguro próprio. [Fronteiras IPC e privacidade](security.md)

## Renderização e compatibilidade

A prévia atualiza matrizes de paleta, uniformes, faixa de desenho e tamanho do buffer no renderizador existente. A geometria mantém 100.000 posições determinísticas em um único buffer. O perfil muda quantas posições são submetidas. O tamanho do buffer é limitado a 4.096 pixels por eixo e 8.388.608 pixels no total. Perfil, qualidade, movimentos e cadência podem ser testados sem fechar o painel. O runtime desfaz observadores, listeners e recursos Three.js ao desmontar o núcleo.

O Windows aplica as preferências de foco e de monitor quando existe uma janela elegível. O Linux usa a descoberta de processos existente. O gerenciamento de posição e foco continua sob responsabilidade do ambiente gráfico nessas sessões. A versão web permite prévia e aplicação durante a sessão. [Integração por plataforma](application-integration.md)
