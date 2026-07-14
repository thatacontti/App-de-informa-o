# Sistema de Gestão Orçamentária
## Como rodar e publicar fora do Claude

Este pacote contém o aplicativo completo, pronto para rodar em qualquer computador ou ser publicado na internet. Fora do Claude, os dados são gravados no banco interno do navegador (IndexedDB), que comporta os lançamentos e os anexos em PDF. Dentro do Claude, o mesmo código continua usando o armazenamento do artifact. Nenhuma configuração é necessária para essa troca: o sistema detecta o ambiente sozinho.

## 1. Rodar no seu computador

Pré-requisito: instalar o Node.js (versão LTS) em nodejs.org. A instalação é do tipo avançar e concluir.

Depois, na pasta deste projeto, abra o terminal (no Windows: botão direito na pasta, "Abrir no Terminal") e execute dois comandos:

    npm install
    npm run dev

O terminal mostra um endereço local, normalmente http://localhost:5173. Abra no navegador e o sistema está no ar. O comando npm install só precisa ser executado na primeira vez.

## 2. Publicar na internet (para acessar de qualquer lugar)

O caminho mais simples é a Vercel, gratuita para este uso:

1. Crie uma conta em vercel.com
2. Instale a ferramenta: npm install -g vercel
3. Na pasta do projeto, execute: vercel
4. Aceite as opções sugeridas. Ao final, você recebe um endereço https público e permanente.

Alternativa sem terminal: execute npm run build, que gera a pasta dist, e arraste essa pasta para app.netlify.com/drop. O site fica no ar em segundos.

Importante sobre acesso: o endereço publicado é aberto para quem tiver o link. Se o conteúdo for sensível, prefira rodar localmente ou ative a proteção por senha da própria Vercel/Netlify (recurso pago) até a versão com login.

## 3. Onde ficam os dados nesta versão

Os dados ficam gravados no navegador de quem usa, por dispositivo. Isso significa: o que você lança no seu notebook não aparece no seu celular, e outra pessoa que abrir o mesmo link começa com a base dela. Não há servidor nem banco central nesta versão.

Por isso o sistema tem, no rodapé do menu, Exportar backup (JSON) e Importar backup. Use o backup para: guardar uma cópia de segurança semanal, transferir os dados entre computadores, ou passar a base para outra pessoa. Atenção: o backup JSON leva os dados e cadastros, mas não leva os arquivos PDF anexados, que permanecem apenas no navegador onde foram anexados.

Limpar os dados de navegação do navegador (cookies e dados de sites) apaga a base. Mantenha o hábito do backup.

## 4. Quando evoluir para a versão corporativa

Esta versão atende um usuário por vez, sem login. Quando o uso validar as regras, a versão corporativa (descrita em arquitetura.md, com o banco do schema.sql) adiciona: banco de dados PostgreSQL central, vários usuários com perfis e alçadas de aprovação, anexos em armazenamento dedicado sem limite do navegador, e acesso simultâneo de qualquer dispositivo com os mesmos dados.

## Estrutura do projeto

    index.html          página base
    vite.config.js      configuração de build
    package.json        dependências
    src/App.jsx         o sistema completo (mesmo arquivo do artifact)
    src/main.jsx        ponto de entrada
    src/index.css       estilos (Tailwind)

Para atualizar o sistema com uma nova versão gerada no Claude, basta substituir o arquivo src/App.jsx e rodar npm run dev de novo.
