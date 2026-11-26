# Ciclo 04 — Launcher desktop, processos e monitores

O Central abre executáveis autorizados para os quatro módulos, detecta instâncias em execução e observa o encerramento dos próprios filhos. No Windows, solicita foco para janelas elegíveis e aplica a preferência de monitor a novas janelas de processos que iniciou. O Control mantém o posicionamento próprio da barra. O Board é distribuído como aplicação web no código consultado. Nexus e Lens permanecem disponíveis para configuração futura. [Issue #5](https://github.com/LeonardoSSm/aurora-central/issues/5) · [Integração e plataformas](application-integration.md)

## Interface

A configuração fica no diálogo **Aplicativos**, acessível pelo rodapé do modo Central. O pulso antecede o pedido ao Rust e uma região de status anuncia o resultado. A captura da WebView de produção foi comparada com a referência fornecida no repositório. A home conserva o fundo escuro, o núcleo volumétrico e os quatro botões com as cores e posições da órbita. O rodapé acrescenta o acesso ao diálogo e a resposta da abertura. [Referência visual](visual-identity.md) · [Home Windows](evidence/cycle-04/home-windows.jpg)

## Verificação local

| Comando | Resultado |
| --- | --- |
| `npm run lint` e `npm run typecheck` | Aprovados |
| `npm test` | 17 testes aprovados |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Aprovado |
| `npm run tauri build -- --no-bundle -- --locked` | Binário Windows de produção gerado e aberto. Vite sinalizou o tamanho do bundle. |
| `cargo test --manifest-path src-tauri/Cargo.toml --release --locked --features tauri/custom-protocol` | 10 testes aprovados no Windows |

## Validação Windows

| Cenário | Observação |
| --- | --- |
| Autorização e abertura | Diálogo nativo e abertura de uma janela de teste autorizada em um caminho com acentos, espaços, colchetes e `&`. |
| Cliques consecutivos | Pulso observado antes da abertura. Dois cliques mantiveram um processo. |
| Foco de instância existente | A primeira execução registrou pedido aceito sem confirmação imediata. Na versão final, o Windows confirmou o primeiro plano da janela de teste, que já existia quando o Central foi reiniciado. |
| Aurora Control | A instância instalada foi reconhecida pelo caminho e permaneceu única ao acionar o módulo. O launcher também iniciou a cópia de desenvolvimento com dados de demonstração, mutex próprio e sem depuração da WebView. A instância instalada continuou em execução. |
| Caminho inválido e falha | Arquivo texto com extensão `.exe` recusado pelo seletor do launcher. Um binário autorizado com saída 42 resultou em erro de inicialização. |
| Persistência e encerramento | O processo de teste permaneceu vivo após fechar o Central. A autorização e o monitor voltaram no reinício. Ao fechar a janela de teste pelo Windows, o estado voltou a disponível. |
| Executável ausente | Com o binário de teste renomeado, a abertura e a consulta de estado retornaram `not-installed`. |
| Preferência de monitor | Um monitor Windows de 1920 × 1080, escala 100%, origem (0, 0), marcado como principal. A preferência foi salva e a janela detectada nesse monitor. |
| IPC malformado e comandos não autorizados | IDs inválidos, caminho e argumentos extras, ID de monitor inválido e chamadas diretas a diálogo, filesystem e shell foram rejeitados na WebView de produção. |

- [Configuração do monitor](evidence/cycle-04/configuracao-monitor.jpg)
- [Resultado de abertura](evidence/cycle-04/abertura-windows.jpg)
- [Solicitação de foco](evidence/cycle-04/foco-windows.jpg)
- [Foco confirmado](evidence/cycle-04/foco-confirmado.jpg)
- [Arquivo inválido](evidence/cycle-04/arquivo-invalido.jpg)
- [Falha observada ao iniciar](evidence/cycle-04/falha-inicializacao.jpg)
- [Código da janela de teste](evidence/cycle-04/JanelaDeTeste.cs)

## Limites

- O teste interativo usou a WebView2 do Windows e um único monitor. Fallback para o principal, coordenadas negativas e geometria de monitor vertical têm cobertura unitária. Movimentação entre telas, escalas diferentes e desconexão de hardware aguardam um ambiente com mais monitores.
- Linux X11 e Wayland possuem abertura de processos e descoberta de monitores, com foco e posicionamento externos indisponíveis no adaptador deste ciclo. A execução interativa em Linux e macOS permanece pendente.
- O Board permanece sem binário desktop disponível no ambiente de teste. A janela de teste foi configurada temporariamente em Lens e Nexus para exercitar os fluxos nativos.

A primeira tentativa com a cópia de desenvolvimento do Control herdou a configuração de depuração da WebView2 usada para coletar evidências. Ela encerrou com erro. O teste pelo botão orbital passou com a depuração desativada.

[Segurança e fronteiras de confiança](security.md)
