# Integração de aplicativos

Em **Aplicativos**, selecione o módulo, escolha o binário instalado e confirme a autorização no diálogo nativo. O Central valida o arquivo e usa a pasta do executável como diretório de trabalho. **Testar abertura** usa a mesma operação da órbita. **Trocar executável** atualiza a autorização e **Remover** revoga o executável. Use **Aplicar** para salvar o modo de abertura, a preferência de foco e o monitor escolhido na categoria **Monitores**. [Configurações do Ciclo 06](cycle-06.md)

| Módulo | Distribuição observada | Integração neste ciclo |
| --- | --- | --- |
| Aurora Board | Frontend web, build estático e execução de desenvolvimento com Vite e servidor local de integração | Aguarda binário desktop compatível. O servidor de desenvolvimento e as APIs internas da aplicação ficam sob responsabilidade do Board. |
| Aurora Control | Binário Tauri Windows e instalador NSIS por usuário. Possui mutex nativo por sessão e barra com posicionamento próprio. | Selecionar `aurora-control.exe`, com lista de argumentos vazia. Central preserva a posição da barra. O foco só é elegível para janelas comuns que estejam abertas. |
| Aurora Nexus | Distribuição nativa não confirmada | Registro disponível para configuração futura. |
| Aurora Lens | Distribuição nativa não confirmada | Registro disponível para configuração futura. |

Fontes consultadas para distribuição, inicialização e contratos locais. [Aurora Board](https://github.com/LeonardoSSm/aurora-board) · [Aurora Control](https://github.com/LeonardoSSm/aurora-control)

O protocolo do Board entre navegador, widgets e servidor e os comandos locais da WebView do Control pertencem às respectivas aplicações. O mutex do Control descarta a segunda instância. A análise do código disponível não identificou contrato público de deep link ou IPC entre esses processos e o Central.

## Contrato do launcher

| Comando | Entrada | Resultado |
| --- | --- | --- |
| `launcher_snapshot` | Nenhuma | Estado, configuração e capacidades por módulo, monitores e tipo de sessão |
| `launcher_choose_executable` | ID de módulo | Autorização salva, cancelamento ou erro tipado |
| `launcher_remove_executable` | ID de módulo | Remoção salva ou erro tipado |
| `launcher_choose_monitor` | ID de módulo e ID estável do monitor ou nulo | Preferência salva ou erro tipado |
| `launcher_open` | ID de módulo | Disponibilidade, inicialização, execução, foco ou erro tipado |

A descoberta usa a imagem do processo na sessão Windows ou `/proc/<pid>/exe` do usuário no Linux. No Windows, a janela precisa ser visível, pertencer ao processo verificado e ser elegível para ativação. A abertura ganha o estado **Inicializando** após o spawn. Após até 8 s sem janela no Windows, um filho ainda vivo aparece como **Em execução**, com janela ainda não identificada. A estratégia de posicionamento próprio reduz a espera para 2 s quando o processo já foi verificado. A confirmação de foco exige observação da janela no primeiro plano. A prontidão dos recursos internos do aplicativo depende do destino.

O Central pode observar aplicativos abertos externamente e solicitar foco. Ele acompanha os filhos iniciados para detectar saída, inclusive após remoção de uma autorização. A saída do Central libera seus handles e os aplicativos seguem em execução.

## Monitores e plataformas

| Plataforma | Processos | Monitores e janelas |
| --- | --- | --- |
| Windows | Toolhelp, sessão do Central e caminho canônico da imagem | Enumeração Win32 de área e escala, seleção com ID derivado da interface do dispositivo, pedido de foco sujeito às regras do Windows |
| Linux com X11 | Inicialização ELF e inspeção de `/proc` | Lista reportada pelo Tauri/GTK. Associação confiável a processos por XRes/EWMH fica pendente. |
| Linux com Wayland | Inicialização ELF e inspeção de `/proc` | Lista reportada pelo Tauri/GTK. Foco e posicionamento permanecem com o compositor. |
| macOS | Estado indisponível | Fronteira de adaptação reservada. Compatibilidade de execução pendente. |

O resultado distingue sessões Linux usando o tipo de sessão e as variáveis de display. No Windows, a lista inclui monitores com identificação ausente ou ambígua. A seleção persistente fica disponível para monitores com identificador único. A lista é atualizada a cada consulta. Ao lançar uma janela com preferência, o Central consulta a topologia e tenta o principal ou outro monitor disponível se o alvo tiver sido desconectado. O posicionamento usa a área útil, admite coordenadas negativas e preserva o tamanho da janela. A tentativa se aplica a novas janelas comuns de processos iniciados pelo Central. O resultado depende do estado da janela, do aplicativo e das restrições do Windows. [EnumDisplayDevicesW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumdisplaydevicesw) · [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)

## Extensão

`Launcher` coordena descoberta, validação e abertura. `Processes` e `Process` fornecem identidade. `Window` encapsula o HWND verificado. `Display` fornece topologia. Os módulos em `platform` implementam a mesma superfície em cada sistema. O registro compilado de `AppId` fornece a política e reserva o ponto de extensão para um adaptador de integração com argumentos revisados e canal suportado pelo destino. Uma futura integração com a Aurora pode solicitar ações via ID, com política explícita para cada aplicativo e operação.
