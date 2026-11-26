# Segurança do launcher

## Capabilities e entradas

- `main-local` vincula tela cheia e cinco comandos específicos à janela local `main`. `AppManifest` inclui cada comando próprio no ACL. A WebView recebe IDs registrados e resultados tipados. O acesso ao diálogo nativo fica no Rust. [Capabilities do Tauri](https://v2.tauri.app/security/capabilities/)
- A CSP mantém scripts e assets locais e restringe conexões ao IPC interno do Tauri. Origens remotas, plugins de execução de comandos e comandos genéricos de sistema ficam fora da capability.
- O Rust recebe objetos de solicitação que rejeitam campos extras, incluindo argumentos, executável e diretório de trabalho. Um ID desconhecido ou um identificador de monitor fora do formato é rejeitado. A preferência de monitor exige um alvo disponível na topologia atual.

## Autorização e execução

O usuário escolhe o arquivo em diálogo nativo e confirma o nome do módulo e o caminho resolvido em outro diálogo nativo. No Windows a confirmação começa em **Não**. O backend valida caminho absoluto e arquivo regular. No Windows aceita PE executável em unidade local. No Linux aceita ELF com permissão de execução e rejeita set-ID. O próprio binário do Central e arquivos já cadastrados em outro módulo são rejeitados. A escolha grava o caminho canônico, metadados e SHA-256. Alterações exigem nova autorização.

A abertura revalida o binário e seus bytes. O Windows mantém o arquivo aberto com compartilhamento de leitura até o spawn. No Linux, a abertura usa o descritor verificado do ELF e aplica `no_new_privs`. `Command` usa executável explícito, argumentos separados e diretório de trabalho derivado. Os quatro módulos têm lista de argumentos vazia. O processo recebe o contexto normal do usuário e as variáveis da sessão.

O registro versionado é local ao perfil do aplicativo. A escrita usa arquivo temporário, sincronização e substituição atômica. Um lock exclusivo protege o perfil contra duas instâncias do Central executarem ou gravarem em paralelo. Falha ao ler, bloquear ou interpretar o registro bloqueia o acesso ao launcher e mantém disponível a interface gráfica.

## Processos, janelas e dados

- O nome do processo no Toolhelp serve de filtro. A decisão usa caminho canônico, identidade de arquivo e sessão. O handle de consulta é preservado enquanto se busca a janela. O PID é conferido novamente antes de solicitar foco ou posição.
- A descoberta Linux verifica o proprietário e a imagem do processo exportada pelo kernel. Restrições de acesso do sistema podem ocultar processos. No Windows, uma inicialização externa pode disputar com a do Central. O Central serializa as próprias decisões e evita duplicação entre pedidos concorrentes. A proteção entre processos independentes depende do aplicativo alvo.
- A API retorna erros tipados. Saída padrão e saída de erros de processos iniciados são descartadas. A configuração local contém o caminho necessário à operação. Os resultados de execução omitem PID, handles, argumentos e dados de conta.
- Processos externos e filhos seguem seu próprio ciclo de vida. O posicionamento exige uma janela de processo iniciado pelo Central e fica restrito às primeiras tentativas de abertura.

A autorização vincula o arquivo do aplicativo. A integridade de bibliotecas, recursos adjacentes, variáveis de ambiente e diretórios depende do ambiente local. Uma conta capaz de editar a instalação ou o registro do Central está dentro dessa fronteira de confiança. No Linux, o descritor evita a troca de caminho após a verificação. O filesystem ainda pode permitir que a mesma conta escreva no inode antes do exec.

## Propostas da conversa

- O Command Registry aceita somente `module.describe` e `module.open`, com um ID exato do registro compartilhado. Campos extras, comandos de shell, caminhos, argumentos e permissões fornecidas na proposta são rejeitados. Texto do assistente é exibido como texto.
- A abertura exige a permissão `modules:open` atribuída pela composição local a esse provedor e um clique confiável na confirmação da solicitação atual. A aprovação tem uso único e expira. Recusar, fechar, mudar de modo ou iniciar uma seleção orbital descarta a aprovação pendente.
- Depois da aprovação, o launcher recebe somente o ID tipado e revalida o executável previamente autorizado no Rust. O ACL e a CSP continuam restritos à WebView local. A confirmação é da sessão conversacional. A WebView local já possui acesso ao mesmo launcher para acionar a órbita.
- O microfone é acionado por interação e usa reconhecimento local se disponível. O aplicativo encerra a captura, a medição e a reprodução ao cancelar a operação ou esconder a janela. Áudio, transcrições e histórico ficam em memória durante a sessão. [Ciclo 05](cycle-05.md)
