# UNIVERSO CHAT

Chat em planetas com avatares, sistema VIP, baús, autoridade, **Boliche** e **Canhão**.
Precisa do Node 18+ e de `npm install` (instala só o `three`, usado no visual 3D). Se o `three` não estiver instalado, o servidor usa a CDN jsDelivr e o app continua abrindo.

## Rodar
    npm install
    node server.js        # abre em http://localhost:3000

Capacidade: cada planeta aceita até 50 jogadores online (staff Moderador+ entra mesmo lotado).

Variáveis: `DISCORD_URL` (link do Discord), `DEV_NAME` (padrão Ibertox), `DEV_PASS` (senha do /dev; se faltar, é sorteada e aparece no log), `PIX_KEY`, `DATA_FILE`.
No Render, defina `DEV_PASS` no painel. Contas ficam em `data.json`
(no plano grátis do Render o disco é apagado a cada deploy; use um Disk e aponte `DATA_FILE` para ele).

## Virar Desenvolvedor
Entre no app e digite `/dev SUASENHA` no chat. Você vira Desenvolvedor e seu nome passa a ser DEV_NAME.

## Comandos (/ajuda mostra os do seu cargo)
- Moderador+: `/prender nome [motivo]`, `/soltar nome`, `/expulsar nome` (também pelo ✋: toque no avatar na sala) (Imperador+ não pode ser preso)
- Imperador+: `/rebaixar nome`
- Soberano+: `/vip nome [off]`, `/autoridade nome cargo`, `/bau nome [qtd]`
- Desenvolvedor: `/criarplaneta nome [chat|prison|vip|bowling|cannon]`, `/prisoes` (Prisão 1–10), `/novatos` (Novato 1–4), `/apagarplaneta nome`, `/dar nome valor`

## APK
Publique no Render e gere o APK em https://www.pwabuilder.com com a URL do app (o manifest e os ícones já estão prontos).

## Correio com voz
Na aba ✉️ Correio dá para enviar texto e/ou áudio (🎤 Gravar → ⏹ Parar → Enviar) para outro jogador pelo nome. O chat das salas é só texto.
Máx. 30s por áudio e 1 envio a cada 3s. Cada pessoa guarda os 5 áudios mais recentes (os antigos viram "áudio expirado"). Só o destinatário consegue ouvir.
Os áudios ficam na pasta `voices/` ao lado do `DATA_FILE` (use um Disk no Render para não perder). Precisa de HTTPS e permissão do microfone.

## Derrubar os Zumbis (planeta "Zumbis")
Jogo por turnos: toque num zumbi para atirar; quando é derrubado, toca uma animação curta de queda com brilho e partículas (sem detalhes gráficos); a cada tiro todos avançam 1 casa e, se chegarem na 🏠, você perde ❤️ (3 vidas). Vença ondas para ganhar 3U.co; a cada 5 ondas há um chefe 👹 que dá estrela. Armas melhores (espingarda 40, metralhadora 100) na loja do Menu. Tudo é calculado no servidor. Recorde = maior onda vencida. Crie outro com `/criarplaneta nome zombie`.

## Recarga de UC via Pix (R$ 1,00 = 1 UC)
No Menu, o jogador escolhe 1, 2, 3, 5, 10 ou 20 UC. O app mostra a chave Pix e o "Pix copia e cola" já com o valor. Você confere se o Pix caiu e credita:
- `/pixchave SUA_CHAVE` e `/pixnome Seu Nome` (Desenvolvedor): definem a chave e o nome do recebedor. Telefone no formato `+5511999999999`. Também dá para usar as variáveis `PIX_KEY`, `PIX_NAME`, `PIX_CITY`.
- `/pedidos`: lista as recargas pendentes (você também recebe um aviso no Correio a cada pedido novo).
- `/dar nome 5`: credita 5 UC, avisa o jogador no Correio e conclui o pedido. Valor negativo remove UC.
- `/recusar nº`: recusa um pedido. `/darmoedas nome valor`: dá 3U.co (o antigo `/dar`).
Os pedidos e saldos ficam no `data.json` (use um Disk no Render, senão o plano grátis apaga tudo a cada deploy).

## Ferramentas de manutenção

- No menu da conta, use **Desbugar** para reinicializar o estado local do personagem/sala e reconectar à sala atual.
- No menu da conta, use **Atualizar APK** para limpar o cache do aplicativo e recarregar a versão publicada.
- Desenvolvedor: `/desbugar nome` corrige o estado de um jogador online; `/desbugar todos` envia o comando a todos os jogadores online.
- Desenvolvedor: `/atualizarapk 3.1.0 [nota]` avisa os jogadores online que há uma nova versão. O aviso aparece no aplicativo e cada jogador pode tocar em **Atualizar**.

A atualização do APK/instalador Android em si ainda precisa ser publicada e disponibilizada pelo responsável pelo app. O comando acima atualiza o aplicativo web/PWA hospedado e mostra o aviso; ele não compila nem instala um APK Android automaticamente.


## GitHub
Nunca envie senhas ou chaves: use variáveis de ambiente (veja `.env.example`). `data.json`, `voices/` e `node_modules/` já estão no `.gitignore`.

## Editor de código dentro do jogo (só Dono)
Menu → **🛠️ Editor de Código**. Precisa da variável `DEV_PASS` (mín. 6 caracteres) no servidor; ao abrir, digite essa senha (libera por 30 min).
- Edita `index.html`, `app.js`, os `*3d.js`, `music.js`, `style.css`, `sw.js` e `manifest.webmanifest`. `server.js`, `package.json` e `README.md` aparecem só para leitura (estudo).
- Só salva se não houver erro de sintaxe (mostra a linha do erro). Cada salvamento cria backup (guarda os 15 últimos) — botões **🕘 Versões** e **♻️ Voltar ao original**.
- As edições ficam na pasta `codeedits/` ao lado do `DATA_FILE` e têm prioridade sobre os arquivos do GitHub. No plano grátis do Render o disco é apagado em deploy/reinício: baixe o `.zip` (já sai com suas edições) e copie para o GitHub para não perder.
- Se o jogo quebrar depois de uma edição, abra `/recuperar` no navegador (não depende do `app.js`) e volte a uma versão que funcionava.

## Recuperar senha por e-mail
- No Menu, cada jogador cadastra e **confirma** um e-mail (recebe um código de 6 dígitos).
- No login: **Esqueci minha senha** → nome da conta → código no e-mail → nova senha. Códigos valem 10 min, no máx. 5 tentativas, 1 pedido por minuto.
- O Render grátis bloqueia SMTP, então o envio é por API HTTPS. Configure `MAIL_FROM` (e-mail remetente) e **uma** chave: `BREVO_API_KEY` (recomendado: permite verificar só um e-mail remetente, sem domínio) ou `RESEND_API_KEY` (exige domínio próprio verificado). `MAIL_FROM_NAME` é opcional.


## Minijogo Caverna do Guardião

O planeta **Caverna do Guardião** oferece um jogo de fuga: explorar, achar chave ou relicário, abrir o portão, escapar do guardião e ganhar recompensas virtuais. A vitória pode conceder Cosmos, estrela de autoridade, UniGema, chave/baú, item para o Canhão e um código individual de resgate. O código individual é resgatado no Menu e não pode ser usado por outra conta.

## Caverna do Guardião 3D
Planeta "Caverna do Guardião": túnel 3D (`cave3d.js`) com tochas, portão, saída e o Guardião que se aproxima a cada ação.
Procure a chave ou o relicário, abra o portão e corra para a saída. Arraste para girar a câmera.

## Loja de UniGemas (aba 💎 UniGemas)
- Pets super épicos: Alien Cristalino, Pavão Aurora, Lobo Lunar, Kraken Estelar, Rex Nebuloso, Dragão Cósmico.
- Planetas pessoais (até 3 por jogador): Cristal, Gelo e Vulcão — criam um planeta de chat só seu na lista de Planetas.
- Preços em `UG_SHOP` (server.js e app.js); mantenha os dois iguais.


## Ativar e-mail sem mexer no Render
Como Desenvolvedor, no chat: `/emailchave CHAVE_API_BREVO`, `/emailde remetente@email.com` e `/emailteste`. A config fica no `data.json` (use um Disk no Render ou prefira as variáveis `BREVO_API_KEY` e `MAIL_FROM`, que têm menos risco de se perder).

## Salvar as contas no GitHub (sem Firebase)

O Render grátis apaga o disco quando reinicia, então sem backup as contas somem. Se o Firebase não funcionar, use o GitHub:

1. No GitHub, crie um repositório **privado** chamado `universo-dados` (marque "Add a README file").
2. Vá em Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
3. Em "Repository access", escolha **Only select repositories** e marque só o `universo-dados`.
4. Em "Permissions → Repository permissions", coloque **Contents: Read and write**. Gere e copie o token.
5. No Render, abra o serviço → Environment e crie duas variáveis: `GITHUB_TOKEN` (o token) e `GITHUB_REPO` (`seu-usuario/universo-dados`).
6. Salve (o Render faz novo deploy). Nos logs deve aparecer `GitHub conectado` e depois `[GitHub] backup salvo.`

O servidor junta os salvamentos e envia no máximo uma vez a cada 90 s (15 s quando uma conta é criada ou muda de senha), e envia tudo ao desligar. Ao ligar, ele restaura as contas sozinho. Se o Firebase estiver ativo, o GitHub fica desligado.

## Firebase Firestore (contas)

O Firebase é opcional: sem credenciais, o app continua usando `DATA_FILE` local.
Este projeto já tem integração do servidor com Firestore usando `firebase-admin`; não é necessário colar o `firebaseConfig` do app Web no `app.js` nem executar `npm install firebase` no navegador.

Para sincronizar o banco de contas no Firestore:

1. No Firebase Console, abra Configurações do projeto → Contas de serviço e gere uma nova chave privada JSON.
2. No Render, abra o serviço → Environment e configure `FIREBASE_PROJECT_ID` com `universo-chat-3d-3d2b5`.
3. Crie `FIREBASE_SERVICE_ACCOUNT_JSON` e cole nela o conteúdo completo do arquivo JSON baixado, sem publicar esse conteúdo no GitHub.
4. Salve as variáveis e faça um novo deploy. Confira os logs para a mensagem `Firebase Firestore conectado`.

A configuração Web (`apiKey`, `authDomain`, `appId` etc.) identifica o app no navegador, mas não autoriza o servidor a gravar contas. A chave privada da conta de serviço é secreta: nunca a envie no chat, no frontend ou em repositórios públicos.

O servidor usa Firebase Admin no backend. O documento `universoChat/database` guarda os dados gerais e a subcoleção `accounts` mantém cada conta em um documento separado. As gravações continuam fazendo cópia local em `DATA_FILE`.

## Item novo da Loja

O traje **Fantasma Noel** foi adicionado à Loja → UniGemas por **300 UG**. Após a compra ele é equipado automaticamente e pode ser removido/vestido na Mochila → Trajes.

## Caverna do Guardião 3D e Futebol 3D
- `cave3d.js`: cena 3D da caverna (herói com lanterna, Guardião de pedra que se aproxima conforme a ameaça, portão e saída). Antes esse arquivo não existia e a caverna ficava vazia/preta.
- `soccer3d.js` + planeta **Futebol**: disputa de pênaltis (5 chutes). Toque no gol para mirar, ajuste a força e chute. Resultado calculado no servidor. Crie outro com `/criarplaneta nome soccer`.


## Atualização v29 — menu e proprietários de planetas
- Música e efeitos sonoros reunidos no menu superior de três pontos.
- Donos de planetas pessoais podem adicionar/remover uma estrela, prender e soltar jogadores presentes no próprio planeta.
- Novos planetas sociais: Lar Feliz, Raio de Sol e Bate-papo Universo.
- Ações de dono são validadas no servidor e só funcionam no planeta pertencente à conta.
