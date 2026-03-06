/**
 * peer-manager.js
 * PeerJS wrapper – Host/Guest star topology
 *
 * The Admin browser acts as Host: all guests connect directly to the Admin.
 * The Admin manages the authoritative state and broadcasts to all guests.
 */

const PeerManager = (() => {
  let peer = null;
  let connections = new Map(); // peerId → DataConnection (host only)
  let hostConnection = null;   // DataConnection to host (guest only)
  let isHost = false;
  let myPeerId = null;

  // Callbacks (prefixed to avoid shadowing)
  let _onMessage = null;
  let _onPeerOpen = null;
  let _onPeerError = null;
  let _onGuestConnected = null;
  let _onGuestDisconnected = null;
  let _onConnectionStatus = null;

  const CONNECTION_TIMEOUT = 15000;
  const DEBUG = true;

  function log(...args) {
    if (DEBUG) console.log('[PeerManager]', ...args);
  }

  function _setStatus(status) {
    log('Status →', status);
    if (_onConnectionStatus) _onConnectionStatus(status);
  }

  // ─── HOST ───

  function initHost() {
    isHost = true;
    return new Promise((resolve, reject) => {
      _setStatus('connecting');

      try {
        peer = new Peer();
      } catch (e) {
        log('Failed to create Peer:', e);
        _setStatus('disconnected');
        return reject(e);
      }

      peer.on('open', (id) => {
        log('Host peer open:', id);
        myPeerId = id;
        _setStatus('connected');
        if (_onPeerOpen) _onPeerOpen(id);
        resolve(id);
      });

      peer.on('connection', (conn) => {
        log('Incoming guest connection:', conn.peer);
        _setupGuestConnection(conn);
      });

      peer.on('error', (err) => {
        log('Host error:', err.type, err.message);
        if (_onPeerError) _onPeerError(err);
        if (!myPeerId) {
          _setStatus('disconnected');
          reject(err);
        }
      });

      peer.on('disconnected', () => {
        log('Host lost signaling server');
        if (peer && !peer.destroyed) {
          setTimeout(() => {
            if (peer && !peer.destroyed && peer.disconnected) {
              log('Host reconnecting to signaling...');
              peer.reconnect();
            }
          }, 1000);
        }
      });

      peer.on('close', () => {
        log('Host peer destroyed');
        _setStatus('disconnected');
      });
    });
  }

  // ─── GUEST ───

  function initGuest(hostPeerId) {
    isHost = false;
    return new Promise((resolve, reject) => {
      _setStatus('connecting');

      try {
        peer = new Peer();
      } catch (e) {
        log('Failed to create Peer:', e);
        _setStatus('disconnected');
        return reject(e);
      }

      let settled = false;
      let timeoutId = null;

      function settle(success, error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        success ? resolve() : reject(error || new Error('Connection failed'));
      }

      peer.on('open', (id) => {
        log('Guest peer open:', id, '→ connecting to host:', hostPeerId);
        myPeerId = id;

        try {
          hostConnection = peer.connect(hostPeerId, {
            reliable: true,
            serialization: 'json',
          });
        } catch (e) {
          log('peer.connect() threw:', e);
          _setStatus('disconnected');
          return settle(false, e);
        }

        // Timeout
        timeoutId = setTimeout(() => {
          log('Connection timeout after', CONNECTION_TIMEOUT, 'ms');
          _setStatus('disconnected');
          settle(false, new Error('Timeout'));
        }, CONNECTION_TIMEOUT);

        hostConnection.on('open', () => {
          log('DataChannel to host OPEN');
          _setStatus('connected');
          settle(true);
        });

        hostConnection.on('data', (data) => {
          log('← Host:', data.type);
          if (_onMessage) _onMessage(data, hostPeerId);
        });

        hostConnection.on('close', () => {
          log('DataChannel to host closed');
          _setStatus('disconnected');
          hostConnection = null;
        });

        hostConnection.on('error', (err) => {
          log('DataChannel error:', err);
          _setStatus('disconnected');
          settle(false, err);
        });
      });

      peer.on('error', (err) => {
        log('Guest peer error:', err.type, err.message);
        if (_onPeerError) _onPeerError(err);
        _setStatus('disconnected');
        settle(false, err);
      });

      peer.on('disconnected', () => {
        log('Guest lost signaling server');
        // DataChannel may still be alive — only reconnect if it isn't
        if (hostConnection && hostConnection.open) {
          log('DataChannel still open, ignoring signaling loss');
        } else if (peer && !peer.destroyed) {
          setTimeout(() => {
            if (peer && !peer.destroyed && peer.disconnected) {
              log('Guest reconnecting signaling...');
              peer.reconnect();
            }
          }, 2000);
        }
      });

      peer.on('close', () => {
        log('Guest peer destroyed');
        _setStatus('disconnected');
      });
    });
  }

  // ─── Guest connection handler (host side) ───

  function _setupGuestConnection(conn) {
    conn.on('open', () => {
      log('Guest DataChannel open:', conn.peer);
      connections.set(conn.peer, conn);
      if (_onGuestConnected) _onGuestConnected(conn.peer);
    });

    conn.on('data', (data) => {
      log('← Guest', conn.peer.slice(0, 8), ':', data.type);
      if (_onMessage) _onMessage(data, conn.peer);
    });

    conn.on('close', () => {
      log('Guest disconnected:', conn.peer);
      connections.delete(conn.peer);
      if (_onGuestDisconnected) _onGuestDisconnected(conn.peer);
    });

    conn.on('error', (err) => {
      log('Guest conn error:', conn.peer, err);
      connections.delete(conn.peer);
      if (_onGuestDisconnected) _onGuestDisconnected(conn.peer);
    });
  }

  // ─── Messaging ───

  function sendToHost(message) {
    if (!hostConnection || !hostConnection.open) {
      log('WARN: sendToHost failed — no open connection');
      return false;
    }
    log('→ Host:', message.type);
    hostConnection.send(message);
    return true;
  }

  function sendToGuest(peerId, message) {
    const conn = connections.get(peerId);
    if (!conn || !conn.open) {
      log('WARN: sendToGuest failed —', peerId.slice(0, 8), 'not connected');
      return false;
    }
    log('→ Guest', peerId.slice(0, 8), ':', message.type);
    conn.send(message);
    return true;
  }

  function broadcast(message) {
    let sent = 0;
    connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(message);
        sent++;
      }
    });
    log('Broadcast', message.type, 'to', sent, '/', connections.size, 'guests');
  }

  // ─── Utilities ───

  function getGuestCount() { return connections.size; }
  function getMyPeerId() { return myPeerId; }
  function getIsHost() { return isHost; }

  function isConnected() {
    if (isHost) return peer && !peer.destroyed && !peer.disconnected;
    return hostConnection != null && hostConnection.open;
  }

  function destroy() {
    log('Destroying peer...');
    if (peer && !peer.destroyed) peer.destroy();
    connections.clear();
    hostConnection = null;
    peer = null;
    myPeerId = null;
    _setStatus('disconnected');
  }

  // ─── Public API ───
  return {
    initHost,
    initGuest,
    sendToHost,
    sendToGuest,
    broadcast,
    getGuestCount,
    getMyPeerId,
    getIsHost,
    isConnected,
    destroy,

    set onMessage(fn) { _onMessage = fn; },
    set onPeerOpen(fn) { _onPeerOpen = fn; },
    set onPeerError(fn) { _onPeerError = fn; },
    set onGuestConnected(fn) { _onGuestConnected = fn; },
    set onGuestDisconnected(fn) { _onGuestDisconnected = fn; },
    set onConnectionStatus(fn) { _onConnectionStatus = fn; },
  };
})();
