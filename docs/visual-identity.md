# Identidade visual

A referência oficial é a imagem [Painel Futurista Aurora Ecosystem](../Painel%20Futurista%20Aurora%20Ecosystem.png) fornecida no repositório.

A home tem fundo preto quase uniforme, assinatura Aurora compacta no topo e um núcleo central sem rosto, com contorno irregular e profundidade obtida pela sobreposição de partículas. A luz fica concentrada nos pontos, com halo suave próximo ao núcleo e às âncoras. O fundo e as áreas entre elementos conservam espaço negativo.

| Elemento | Direção |
| --- | --- |
| Fundo | Preto `#030205` |
| Núcleo | Azul `#476BFF`, violeta `#9133FF`, magenta `#FF29AD`, coral `#FF755C` e destaques rosa/lilás |
| Board | Rosa `#EB75B7`, quadrantes, superior esquerdo |
| Control | Azul `#A1BCFF`, controles verticais, inferior esquerdo |
| Nexus | Lilás `#D090FF`, três nós, superior direito |
| Lens | Coral `#FFA993`, abertura de lente, inferior direito |

Uma órbita de traço fino agrupa os quatro módulos. A projeção separa os arcos traseiro e frontal em camadas em torno do canvas. A luz diminui na região central para preservar a leitura das partículas. Cada cápsula translúcida tem ícone, nome e uma âncora que usa a cor do módulo. A geometria dos botões permanece fixa durante as interações. Hover e foco elevam a luz da conexão e atraem parte das partículas do núcleo na direção da âncora. A seleção envia um pulso pela conexão antes de exibir o resultado da abertura no rodapé.

As posições vêm de ângulos no registry. Para incluir um módulo, escolha nome, ícone, cor, ângulo com espaçamento para os vizinhos, disponibilidade e estratégia de abertura. A geometria usa a área da cena, limita a extensão lateral em ultrawide e mantém o canvas quadrado. Em janelas curtas ou estreitas, reduz o núcleo e mantém a área útil dos botões.

**Central** mostra marca, órbita, módulos e controles. **Imersivo** mantém o núcleo e os módulos em baixa intensidade e preserva um controle de retorno. **Ambiental** mantém o núcleo sobre preto puro e revela a saída ao mover o ponteiro, tocar ou focar o botão. Os atalhos são `Alt+1`, `Alt+2`, `Alt+3`, `Esc` e `F11`. Movimento reduzido mantém o núcleo estático, conserva foco e destaque instantâneo e dispensa o pulso.

A assinatura é desenhada em CSS e a janela usa controles nativos do sistema. A tela cheia é um modo da janela. A experiência Ambiental funciona dentro da aplicação. A distribuição volumétrica, as dobras animadas e os estados do núcleo vêm do Ciclo 02. [Comparação e capturas do Ciclo 03](cycle-03.md)
