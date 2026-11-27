# Changelog

## v0.1.0 — Primeira versão funcional

- Home desktop com núcleo volumétrico WebGL 2, quatro módulos orbitais e modos Central, Imersivo e Ambiental.
- Launcher nativo para executáveis autorizados por módulo. No Windows, solicita foco de janelas elegíveis e aplica preferências de monitor a novas janelas compatíveis.
- Configurações locais versionadas com prévia ao vivo, ajustes gráficos, movimento reduzido, restauração de padrões e recuperação após corrupção.
- Conversa opcional com **Simulação local**, confirmação explícita de abertura e voz local quando disponível. As portas tipadas de Aurora AI e Aurora Nexus permanecem disponíveis para integração futura.
- Instalador NSIS x64 por usuário com verificação do WebView2. O pacote é acompanhado de um SHA-256.
- A WebView2 acompanha a visibilidade da janela no Windows para pausar o núcleo e aplicar as regras de cancelamento da conversa ao minimizar.
- A perda de contexto WebGL mantém o fundo escuro durante a recuperação do núcleo.

[Instalação e limitações](README.md) · [Relatório de implementação](docs/implementation-report.md)
