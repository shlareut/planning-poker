/**
 * app.js
 * Planning Poker – State Management, UI Logic, Event Handlers
 */

(function () {
  'use strict';

  const CARDS = ['1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'];
  const PHASE = { LOBBY: 'lobby', VOTING: 'voting', REVEALED: 'revealed' };

  // ═══ State ═══
  const state = {
    role: null,          // 'admin' | 'guest'
    phase: PHASE.LOBBY,
    sessionId: '',
    sessionName: '',
    storyTitle: '',
    myId: '',
    myName: '',
    myVote: null,
    participants: [],    // [{ id, name, peerId, hasVoted, vote, isAdmin }]
    adminPwHash: null,
    connected: false,
  };

  // ═══ DOM Refs ═══
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    screenHome: $('#screen-home'),
    screenSession: $('#screen-session'),
    modalCreate: $('#modal-create'),
    modalJoin: $('#modal-join'),
    btnCreate: $('#btn-create'),
    btnJoinOpen: $('#btn-join-open'),
    btnCreateConfirm: $('#btn-create-confirm'),
    btnJoinConfirm: $('#btn-join-confirm'),
    inputSessionName: $('#input-session-name'),
    inputAdminPw: $('#input-admin-pw'),
    inputJoinId: $('#input-join-id'),
    inputDisplayName: $('#input-display-name'),
    sessionTitle: $('#session-title'),
    sessionIdDisplay: $('#session-id-display'),
    statusDot: $('#status-dot'),
    connectionStatus: $('#connection-status'),
    btnCopyLink: $('#btn-copy-link'),
    storyBanner: $('#story-banner'),
    storyTitleDisplay: $('#story-title-display'),
    adminPanel: $('#admin-panel'),
    adminLobby: $('#admin-lobby'),
    adminVoting: $('#admin-voting'),
    adminRevealed: $('#admin-revealed'),
    inputStory: $('#input-story'),
    btnSetStory: $('#btn-set-story'),
    btnReveal: $('#btn-reveal'),
    btnNextRound: $('#btn-next-round'),
    btnEndSession: $('#btn-end-session'),
    participantList: $('#participant-list'),
    participantCount: $('#participant-count'),
    statsGrid: $('#stats-grid'),
    statAvg: $('#stat-avg'),
    statMin: $('#stat-min'),
    statMax: $('#stat-max'),
    statMode: $('#stat-mode'),
    revealedSection: $('#revealed-section'),
    revealedCards: $('#revealed-cards'),
    lobbyHint: $('#lobby-hint'),
    cardDock: $('#card-dock'),
    cardDeck: $('#card-deck'),
  };

  // ═══ Utility ═══
  function generateId() {
    return Math.random().toString(36).slice(2, 10);
  }

  async function sha256(msg) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══ Toast ═══
  function toast(text) {
    const container = $('#toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast--exit');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ═══ Screen Switching ═══
  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    $(`#screen-${name}`).classList.add('active');
  }

  function openModal(id) { $(id).classList.add('active'); }
  function closeModal(id) { $(id).classList.remove('active'); }

  // ═══ Connection Status ═══
  function setConnectionStatus(status) {
    state.connected = status === 'connected';
    if (status === 'connected') {
      dom.statusDot.classList.add('connected');
      dom.connectionStatus.textContent = 'Verbunden';
    } else if (status === 'connecting') {
      dom.statusDot.classList.remove('connected');
      dom.connectionStatus.textContent = 'Verbinde...';
    } else {
      dom.statusDot.classList.remove('connected');
      dom.connectionStatus.textContent = 'Getrennt';
    }
  }

  // ═══ Render ═══
  function renderParticipants() {
    dom.participantCount.textContent = state.participants.length;
    dom.participantList.innerHTML = '';

    state.participants.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'participant-row';
      const isAdmin = p.isAdmin;
      const avatarClass = isAdmin ? 'participant-avatar participant-avatar--admin' : 'participant-avatar';

      let voteHTML = '';
      if (state.phase === PHASE.REVEALED && p.vote) {
        voteHTML = `<div class="participant-vote-badge">${escapeHtml(p.vote)}</div>`;
      } else if (p.hasVoted) {
        voteHTML = '<div class="vote-status">✅</div>';
      } else {
        voteHTML = '<div class="vote-status" style="opacity:0.4">⬜</div>';
      }

      row.innerHTML = `
        <div class="participant-row__left">
          <div class="${avatarClass}">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
          <div>
            <div class="participant-name">${escapeHtml(p.name)}</div>
            ${isAdmin ? '<div class="participant-badge">Admin</div>' : ''}
          </div>
        </div>
        ${voteHTML}
      `;
      dom.participantList.appendChild(row);
    });
  }

  function renderAdminPanel() {
    if (state.role !== 'admin') {
      dom.adminPanel.style.display = 'none';
      return;
    }
    dom.adminPanel.style.display = '';
    dom.adminLobby.style.display = state.phase === PHASE.LOBBY ? '' : 'none';
    dom.adminVoting.style.display = state.phase === PHASE.VOTING ? '' : 'none';
    dom.adminRevealed.style.display = state.phase === PHASE.REVEALED ? '' : 'none';
  }

  function renderStory() {
    if (state.storyTitle) {
      dom.storyBanner.style.display = '';
      dom.storyTitleDisplay.textContent = state.storyTitle;
    } else {
      dom.storyBanner.style.display = 'none';
    }
  }

  function renderCardDeck() {
    if (state.phase !== PHASE.VOTING) {
      dom.cardDock.style.display = 'none';
      return;
    }
    dom.cardDock.style.display = '';
    dom.cardDeck.innerHTML = '';

    CARDS.forEach((card) => {
      const el = document.createElement('div');
      el.className = 'poker-card' + (state.myVote === card ? ' selected' : '');
      const isEmoji = card === '☕' || card === '?';
      el.innerHTML = `
        <div class="poker-card__inner">
          <div class="poker-card__front${isEmoji ? ' emoji' : ''}">${escapeHtml(card)}</div>
          <div class="poker-card__back">${escapeHtml(card)}</div>
        </div>
      `;
      el.addEventListener('click', () => handleVote(card));
      dom.cardDeck.appendChild(el);
    });
  }

  function renderRevealedCards() {
    if (state.phase !== PHASE.REVEALED) {
      dom.revealedSection.style.display = 'none';
      dom.statsGrid.style.display = 'none';
      return;
    }

    const voted = state.participants.filter((p) => p.vote);
    if (voted.length === 0) {
      dom.revealedSection.style.display = 'none';
      dom.statsGrid.style.display = 'none';
      return;
    }

    dom.revealedSection.style.display = '';
    dom.revealedCards.innerHTML = '';
    voted.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'revealed-card-item';
      item.style.animationDelay = `${i * 0.1}s`;
      item.innerHTML = `
        <div class="poker-card flipped disabled" style="width:64px;height:88px">
          <div class="poker-card__inner">
            <div class="poker-card__front">?</div>
            <div class="poker-card__back">${escapeHtml(p.vote)}</div>
          </div>
        </div>
        <div class="revealed-card-name">${escapeHtml(p.name)}</div>
      `;
      dom.revealedCards.appendChild(item);
    });

    const numericVotes = voted.filter((p) => !isNaN(Number(p.vote))).map((p) => Number(p.vote));
    if (numericVotes.length > 0) {
      dom.statsGrid.style.display = '';
      const avg = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
      const min = Math.min(...numericVotes);
      const max = Math.max(...numericVotes);
      const freq = {};
      numericVotes.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
      const maxFreq = Math.max(...Object.values(freq));
      const mode = Object.entries(freq)
        .filter(([, c]) => c === maxFreq)
        .map(([v]) => v)
        .join(', ');
      dom.statAvg.textContent = avg;
      dom.statMin.textContent = min;
      dom.statMax.textContent = max;
      dom.statMode.textContent = mode;
    } else {
      dom.statsGrid.style.display = 'none';
    }
  }

  function renderLobbyHint() {
    if (state.phase === PHASE.LOBBY && !state.storyTitle) {
      dom.lobbyHint.style.display = '';
      if (state.role === 'admin') {
        dom.lobbyHint.textContent = 'Gib einen Story-Titel ein, um die Runde zu starten.';
      } else if (!state.connected) {
        dom.lobbyHint.textContent = 'Verbindung wird aufgebaut...';
      } else {
        dom.lobbyHint.textContent = 'Verbunden! Warte auf den Admin...';
      }
    } else {
      dom.lobbyHint.style.display = 'none';
    }
  }

  function renderAll() {
    renderParticipants();
    renderAdminPanel();
    renderStory();
    renderCardDeck();
    renderRevealedCards();
    renderLobbyHint();
  }

  // ═══ PeerJS Event Wiring ═══
  PeerManager.onConnectionStatus = setConnectionStatus;

  PeerManager.onGuestConnected = (peerId) => {
    console.log('[App] Guest connected (waiting for USER_JOIN):', peerId);
  };

  PeerManager.onGuestDisconnected = (peerId) => {
    const p = state.participants.find((x) => x.peerId === peerId);
    if (p) {
      state.participants = state.participants.filter((x) => x.peerId !== peerId);
      toast(`${p.name} hat die Session verlassen`);
      broadcastParticipantUpdate();
      renderAll();
    }
  };

  PeerManager.onMessage = (msg, fromPeerId) => {
    console.log('[App] Message received:', msg.type, 'from', fromPeerId?.slice(0, 8));
    if (state.role === 'admin') {
      handleHostMessage(msg, fromPeerId);
    } else {
      handleGuestMessage(msg);
    }
  };

  PeerManager.onPeerError = (err) => {
    console.error('[App] Peer error:', err.type, err.message);
    if (err.type === 'peer-unavailable') {
      toast('Session nicht gefunden. Prüfe die Session-ID.');
    } else if (err.type === 'network') {
      toast('Netzwerkfehler — prüfe deine Internetverbindung.');
    } else if (err.type === 'server-error') {
      toast('PeerJS-Server nicht erreichbar. Versuche es erneut.');
    } else {
      toast('Verbindungsfehler: ' + (err.message || err.type));
    }
  };

  // ═══ HOST Message Handling ═══
  function handleHostMessage(msg, fromPeerId) {
    switch (msg.type) {
      case 'USER_JOIN': {
        if (state.participants.find((p) => p.peerId === fromPeerId)) {
          // Already joined — resend SYNC_STATE in case they missed it
          console.log('[App] Duplicate USER_JOIN, resending SYNC_STATE');
          sendSyncState(fromPeerId);
          return;
        }

        const participant = {
          id: msg.userId || generateId(),
          name: msg.name,
          peerId: fromPeerId,
          hasVoted: false,
          vote: null,
          isAdmin: false,
        };
        state.participants.push(participant);
        toast(`${participant.name} ist beigetreten`);

        // Send full state to the new guest
        sendSyncState(fromPeerId);

        // Notify all other guests
        broadcastParticipantUpdate();
        renderAll();
        break;
      }

      case 'VOTE': {
        const p = state.participants.find((x) => x.peerId === fromPeerId);
        if (p && state.phase === PHASE.VOTING) {
          p.hasVoted = true;
          p.vote = msg.vote;
          broadcastParticipantUpdate();
          renderAll();
        }
        break;
      }

      default:
        console.log('[App] Unknown message from guest:', msg.type);
    }
  }

  function sendSyncState(peerId) {
    PeerManager.sendToGuest(peerId, {
      type: 'SYNC_STATE',
      story: state.storyTitle,
      phase: state.phase,
      sessionName: state.sessionName,
      participants: state.participants.map((p) => ({
        id: p.id,
        name: p.name,
        hasVoted: p.hasVoted,
        isAdmin: p.isAdmin,
        vote: state.phase === PHASE.REVEALED ? p.vote : null,
      })),
    });
  }

  // ═══ GUEST Message Handling ═══
  function handleGuestMessage(msg) {
    switch (msg.type) {
      case 'SYNC_STATE': {
        console.log('[App] Received SYNC_STATE:', msg);
        state.storyTitle = msg.story || '';
        state.phase = msg.phase || PHASE.LOBBY;
        state.sessionName = msg.sessionName || state.sessionName;
        state.participants = msg.participants || [];

        // Ensure self is in the list
        if (!state.participants.find((p) => p.id === state.myId)) {
          state.participants.push({
            id: state.myId,
            name: state.myName,
            hasVoted: false,
            isAdmin: false,
            vote: null,
          });
        }

        dom.sessionTitle.textContent = state.sessionName || 'Planning Poker';
        state.myVote = null;
        renderAll();
        toast('Mit Session verbunden!');
        break;
      }

      case 'PARTICIPANT_UPDATE': {
        if (msg.participants) {
          state.participants = msg.participants.map((p) => {
            // Preserve own local vote
            if (p.id === state.myId) {
              return { ...p, vote: state.myVote || p.vote };
            }
            return p;
          });
        }
        renderAll();
        break;
      }

      case 'SET_STORY':
        state.storyTitle = msg.title || '';
        state.phase = PHASE.VOTING;
        state.myVote = null;
        state.participants = state.participants.map((p) => ({
          ...p, hasVoted: false, vote: null,
        }));
        toast(`Neue Story: ${msg.title}`);
        renderAll();
        break;

      case 'REVEAL_VOTES':
        state.phase = PHASE.REVEALED;
        if (msg.votes) {
          msg.votes.forEach((v) => {
            const p = state.participants.find((x) => x.id === v.userId);
            if (p) { p.vote = v.vote; p.hasVoted = true; }
          });
        }
        toast('Karten aufgedeckt!');
        renderAll();
        break;

      case 'RESET_ROUND':
        state.phase = PHASE.LOBBY;
        state.storyTitle = '';
        state.myVote = null;
        state.participants = state.participants.map((p) => ({
          ...p, hasVoted: false, vote: null,
        }));
        toast('Neue Runde gestartet');
        renderAll();
        break;

      case 'END_SESSION':
        toast('Session wurde beendet');
        PeerManager.destroy();
        showScreen('home');
        break;

      default:
        console.log('[App] Unknown message from host:', msg.type);
    }
  }

  // ═══ Broadcast Helpers (Host) ═══
  function broadcastParticipantUpdate() {
    PeerManager.broadcast({
      type: 'PARTICIPANT_UPDATE',
      participants: state.participants.map((p) => ({
        id: p.id,
        name: p.name,
        hasVoted: p.hasVoted,
        isAdmin: p.isAdmin,
        vote: state.phase === PHASE.REVEALED ? p.vote : null,
      })),
    });
  }

  // ═══ Actions ═══
  function handleVote(card) {
    if (state.phase !== PHASE.VOTING) return;
    state.myVote = card;

    if (state.role === 'admin') {
      const me = state.participants.find((p) => p.isAdmin);
      if (me) { me.hasVoted = true; me.vote = card; }
      broadcastParticipantUpdate();
      renderAll();
    } else {
      const sent = PeerManager.sendToHost({
        type: 'VOTE',
        userId: state.myId,
        vote: card,
      });
      if (!sent) {
        toast('Verbindung unterbrochen — Vote konnte nicht gesendet werden.');
      }
      // Optimistic local update
      const me = state.participants.find((p) => p.id === state.myId);
      if (me) { me.hasVoted = true; me.vote = card; }
      renderAll();
    }
  }

  function handleSetStory() {
    const title = dom.inputStory.value.trim();
    if (!title || state.role !== 'admin') return;

    state.storyTitle = title;
    state.phase = PHASE.VOTING;
    state.myVote = null;
    state.participants = state.participants.map((p) => ({
      ...p, hasVoted: false, vote: null,
    }));
    dom.inputStory.value = '';

    PeerManager.broadcast({ type: 'SET_STORY', title });
    toast(`Story gesetzt: ${title}`);
    renderAll();
  }

  function handleReveal() {
    if (state.role !== 'admin') return;
    state.phase = PHASE.REVEALED;

    const votes = state.participants
      .filter((p) => p.vote)
      .map((p) => ({ userId: p.id, name: p.name, vote: p.vote }));

    PeerManager.broadcast({ type: 'REVEAL_VOTES', votes });
    broadcastParticipantUpdate();
    toast('Karten aufgedeckt!');
    renderAll();
  }

  function handleNewRound() {
    if (state.role !== 'admin') return;
    state.phase = PHASE.LOBBY;
    state.storyTitle = '';
    state.myVote = null;
    state.participants = state.participants.map((p) => ({
      ...p, hasVoted: false, vote: null,
    }));

    PeerManager.broadcast({ type: 'RESET_ROUND' });
    toast('Neue Runde gestartet');
    renderAll();
  }

  function handleEndSession() {
    PeerManager.broadcast({ type: 'END_SESSION' });
    PeerManager.destroy();
    state.role = null;
    state.phase = PHASE.LOBBY;
    state.participants = [];
    state.myVote = null;
    state.storyTitle = '';
    state.sessionId = '';
    localStorage.removeItem('pp_admin_hash');
    localStorage.removeItem('pp_session_id');
    showScreen('home');
    toast('Session beendet');
  }

  // ═══ Session Create ═══
  async function createSession() {
    const pw = dom.inputAdminPw.value;
    const name = dom.inputSessionName.value.trim();
    if (!pw) return;

    state.role = 'admin';
    state.myId = generateId();
    state.myName = 'Admin';
    state.sessionName = name || 'Planning Poker';
    state.phase = PHASE.LOBBY;
    state.participants = [
      { id: state.myId, name: 'Admin (Du)', peerId: null, hasVoted: false, vote: null, isAdmin: true },
    ];

    state.adminPwHash = await sha256(pw);
    localStorage.setItem('pp_admin_hash', state.adminPwHash);

    closeModal('#modal-create');
    showScreen('session');
    renderAll();

    try {
      const peerId = await PeerManager.initHost();
      state.sessionId = peerId;
      localStorage.setItem('pp_session_id', peerId);
      dom.sessionTitle.textContent = state.sessionName;
      dom.sessionIdDisplay.textContent = `ID: ${peerId.slice(0, 12)}`;
      toast('Session erstellt! Teile den Link mit deinem Team.');
    } catch (err) {
      toast('Fehler beim Erstellen: ' + (err.message || 'Unbekannt'));
      console.error('[App] Create session error:', err);
    }
  }

  // ═══ Session Join ═══
  async function joinSession() {
    const displayName = dom.inputDisplayName.value.trim();
    const joinId = dom.inputJoinId.value.trim();
    if (!displayName || !joinId) return;

    state.role = 'guest';
    state.myId = generateId();
    state.myName = displayName;
    state.sessionId = joinId;
    state.sessionName = 'Planning Poker';
    state.phase = PHASE.LOBBY;
    state.participants = [];

    dom.sessionTitle.textContent = state.sessionName;
    dom.sessionIdDisplay.textContent = `ID: ${joinId.slice(0, 12)}`;

    closeModal('#modal-join');
    showScreen('session');
    setConnectionStatus('connecting');
    renderAll();

    try {
      await PeerManager.initGuest(joinId);
      console.log('[App] PeerJS connected, sending USER_JOIN...');

      // Small delay to ensure the DataChannel is fully ready
      await new Promise((r) => setTimeout(r, 200));

      const sent = PeerManager.sendToHost({
        type: 'USER_JOIN',
        userId: state.myId,
        name: displayName,
      });

      if (sent) {
        console.log('[App] USER_JOIN sent successfully');
      } else {
        console.warn('[App] USER_JOIN could not be sent, retrying...');
        // Retry after 1s
        setTimeout(() => {
          const retry = PeerManager.sendToHost({
            type: 'USER_JOIN',
            userId: state.myId,
            name: displayName,
          });
          if (!retry) {
            toast('Verbindung fehlgeschlagen. Lade die Seite neu und versuche es erneut.');
          }
        }, 1000);
      }
    } catch (err) {
      console.error('[App] Join error:', err);
      if (err.message === 'Timeout') {
        toast('Verbindung dauert zu lange. Ist die Session noch aktiv?');
      } else {
        toast('Verbindung fehlgeschlagen. Prüfe die Session-ID.');
      }
    }
  }

  // ═══ URL Hash ═══
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#join/')) {
      const peerId = hash.slice(6);
      if (peerId) {
        dom.inputJoinId.value = peerId;
        openModal('#modal-join');
        // Focus the name field since ID is pre-filled
        setTimeout(() => dom.inputDisplayName.focus(), 100);
      }
    }
  }

  // ═══ Copy Link ═══
  function copyJoinLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}#join/${state.sessionId}`;
    navigator.clipboard.writeText(link).then(() => {
      dom.btnCopyLink.textContent = '✓ Kopiert';
      dom.btnCopyLink.classList.add('copied');
      setTimeout(() => {
        dom.btnCopyLink.textContent = 'Link kopieren';
        dom.btnCopyLink.classList.remove('copied');
      }, 2000);
      toast('Link kopiert!');
    }).catch(() => {
      prompt('Link kopieren:', link);
    });
  }

  // ═══ Init ═══
  function init() {
    // Clean up stale localStorage
    localStorage.removeItem('pp_admin_hash');
    localStorage.removeItem('pp_session_id');

    // Home buttons
    dom.btnCreate.addEventListener('click', () => openModal('#modal-create'));
    dom.btnJoinOpen.addEventListener('click', () => openModal('#modal-join'));

    // Modal close on overlay click
    dom.modalCreate.addEventListener('click', () => closeModal('#modal-create'));
    dom.modalJoin.addEventListener('click', () => closeModal('#modal-join'));

    // Create session
    dom.inputAdminPw.addEventListener('input', () => {
      dom.btnCreateConfirm.disabled = !dom.inputAdminPw.value;
    });
    dom.inputAdminPw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createSession();
    });
    dom.btnCreateConfirm.addEventListener('click', createSession);

    // Join session
    function updateJoinBtn() {
      dom.btnJoinConfirm.disabled = !(dom.inputDisplayName.value.trim() && dom.inputJoinId.value.trim());
    }
    dom.inputDisplayName.addEventListener('input', updateJoinBtn);
    dom.inputJoinId.addEventListener('input', updateJoinBtn);
    dom.inputDisplayName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinSession();
    });
    dom.inputJoinId.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.inputDisplayName.focus();
    });
    dom.btnJoinConfirm.addEventListener('click', joinSession);

    // Session actions
    dom.btnCopyLink.addEventListener('click', copyJoinLink);
    dom.btnSetStory.addEventListener('click', handleSetStory);
    dom.inputStory.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSetStory();
    });
    dom.btnReveal.addEventListener('click', handleReveal);
    dom.btnNextRound.addEventListener('click', handleNewRound);
    dom.btnEndSession.addEventListener('click', handleEndSession);

    // Check URL hash for #join/PEER-ID
    checkUrlHash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
