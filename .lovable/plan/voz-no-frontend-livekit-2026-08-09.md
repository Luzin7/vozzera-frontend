# Voz no frontend (LiveKit)

Ligar os canais de voz que hoje só aparecem desabilitados na sidebar: clicar num canal entra no áudio, clicar de novo sai, e a barra lateral mostra quem está dentro e o estado do microfone.

## O que muda para você

- Canais de voz deixam de ser "em breve": ficam clicáveis.
- Ao entrar: pede permissão de microfone, mostra "conectando…" e depois lista os participantes embaixo do canal.
- Barra de status no rodapé da sidebar quando você está num canal: nome do canal, botão de mudo (mic on/off) e botão de sair.
- Erros de voz (401, sala inválida, microfone negado) aparecem no mesmo banner já usado pelo chat.
- Chat de texto continua funcionando normalmente enquanto você está em voz.

## Fluxo

```text
clique num canal de voz
  POST /api/voice/token { room_id }
    200 -> { token, url, room_name }
  import dinâmico do livekit-client
  room.connect(url, token)
  microfone ligado
  participantes listados sob o canal
clique de novo no mesmo canal -> disconnect
clique em outro canal de voz -> troca de canal
```

## Detalhes técnicos

- `bun add livekit-client` (v2).
- `src/lib/vozzera/types.ts`: adicionar `VoiceTokenResponse { token; url; room_name }`.
- Novo `src/lib/vozzera/useVoice.ts`, conforme o contrato: estados `idle | connecting | connected`, `activeRoomId`, `participants`, `error`, e ações `connect`, `disconnect`, `setMicEnabled`. `import("livekit-client")` dinâmico dentro do `connect` (o app faz SSR e o pacote é browser-only). Handlers de `TrackSubscribed`/`TrackUnsubscribed` para anexar/remover os elementos de áudio ocultos no `document.body`, `ParticipantConnected/Disconnected` para sincronizar a lista, e cleanup no unmount.
- `RoomSidebar.tsx`: canais de voz viram `<button>`, com destaque quando ativo, indicador de "conectando…", lista de participantes indentada sob o canal ativo, e uma faixa de controle (mudo / desconectar) acima do bloco de usuário.
- `src/routes/index.tsx`: instanciar `useVoice()`, passar `onSelectVoiceRoom` (toggle), `voiceStatus`, `voiceRoomId`, `voiceParticipants`, `micEnabled` para a sidebar, e enviar `voice.error` para o banner existente.
- `connect()` sempre sai de um clique (autoplay policy); nunca de `useEffect`.
- Sem mudanças de backend, sem Lovable Cloud.

## Limitações conhecidas

- Microfone exige contexto seguro: funciona em `localhost` e HTTPS, não em `http://IP-da-rede`.
- Mesma conta em duas abas derruba a primeira conexão (identity duplicada no LiveKit).
