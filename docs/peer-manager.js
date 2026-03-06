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
  let onMessage = null;        // callback(message, fromPeerId)
  let onPeerOpen = null;       // callback(peerId)
  let onPeerError = null;      // callback(error)
  let onGuestConnected = null; // callback(peerId)
  let onGuestDisconnected = null; // callback(peerId)
  let onConnectionStatus = null;  // callback(status: 'connecting'|'connected'|'disconnected')

  /**
   * Initialize as HOST (Admin)
   * Creates a new Peer and listens for incoming connections.
   * @param {string} [customId] Optional custom peer ID
   * @returns {Promise<string>} The peer ID (= session ID)
   */
  function initHost(customId) {
    isHost = true;
    return new Promise((resolve, reject) => {
      const opts = customId ? undefined : undefined;
      peer = customId ? new Peer(customId) : new Peer();

      peer.on('open', (id) => {
        myPeerId = id;
        _setStatus('connected');
        if (onPeerOpen) onPeerOpen(id);
        resolve(id);
      });

      peer.on('connection', (conn) => {
        _handleIncomingConnection(conn);
      });

      peer.on('error', (err) => {
        console.error('[PeerManager] Host error:', err);
        if (err.type === 'unavailable-id') {
          // ID taken, retry without custom ID
          peer.destroy();
          peer = new Peer();
          peer.on('open', (id) => {
            myPeerId = id;
            _setStatus('connected');
            if (onPeerOpen) onPeerOpen(id);
            resolve(id);
          });
          peer.on('connection', (conn) => _handleIncomingConnection(conn));
          peer.on('error', (e) => {
            if (onPeerError) onPeerError(e);
            reject(e);
          });
        } else {
          if (onPeerError) onPeerError(err);
          reject(err);
        }
      });

      peer.on('disconnected', () => {
        _setStatus('disconnected');
        // Try to reconnect
        if (!peer.destroyed) peer.reconnect();
      });
    });
  }

  /**
   * Initialize as GUEST and connect to the host.
   * @param {string} hostPeerId The session ID / host peer ID
   * @returns {Promise<void>}
   */
  function initGuest(hostPeerId) {
    isHost = false;
    return new Promise((resolve, reject) => {
      peer = new Peer();

      peer.on('open', (id) => {
        myPeerId = id;
        _setStatus('connecting');

        hostConnection = peer.connect(hostPeerId, { reliable: true });

        hostConnection.on('open', () => {
          _setStatus('connected');
          resolve();
        });

        hostConnection.on('data', (data) => {
          if (onMessage) onMessage(data, hostPeerId);
        });

        hostConnection.on('close', () => {
          _setStatus('disconnected');
          hostConnection = null;
        });

        hostConnection.on('error', (err) => {
          console.error('[PeerManager] Guest connection error:', err);
          _setStatus('disconnected');
        });
      });

      peer.on('error', (err) => {
        console.error('[PeerManager] Guest error:', err);
        if (onPeerError) onPeerError(err);
        _setStatus('disconnected');
        reject(err);
      });

      peer.on('disconnected', () => {
        _setStatus('disconnected');
        if (!peer.destroyed) peer.reconnect();
      });
    });
  }

  /**
   * Handle an incoming connection from a guest (host only).
   */
  function _handleIncomingConnection(conn) {
    conn.on('open', () => {
      connections.set(conn.peer, conn);
      if (onGuestConnected) onGuestConnected(conn.peer);
    });

    conn.on('data', (data) => {
      if (onMessage) onMessage(data, conn.peer);
    });

    conn.on('close', () => {
      connections.delete(conn.peer);
      if (onGuestDisconnected) onGuestDisconnected(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error with', conn.peer, err);
      connections.delete(conn.peer);
      if (onGuestDisconnected) onGuestDisconnected(conn.peer);
    });
  }

  /**
   * Send a message to the host (guest only).
   */
  function sendToHost(message) {
    if (!hostConnection || !hostConnection.open) {
      console.warn('[PeerManager] No open connection to host.');
      return;
    }
    hostConnection.send(message);
  }

  /**
   * Send a message to a specific guest (host only).
   */
  function sendToGuest(peerId, message) {
    const conn = connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  /**
   * Broadcast a message to ALL connected guests (host only).
   */
  function broadcast(message) {
    connections.forEach((conn) => {
      if (conn.open) conn.send(message);
    });
  }

  /**
   * Get the number of connected guests.
   */
  function getGuestCount() {
    return connections.size;
  }

  /**
   * Destroy the peer, close all connections.
   */
  function destroy() {
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    connections.clear();
    hostConnection = null;
    peer = null;
    myPeerId = null;
  }

  function _setStatus(status) {
    if (onConnectionStatus) onConnectionStatus(status);
  }

  /**
   * Get my peer ID.
   */
  function getMyPeerId() {
    return myPeerId;
  }

  /**
   * Check if this instance is the host.
   */
  function getIsHost() {
    return isHost;
  }

  // Public API
  return {
    initHost,
    initGuest,
    sendToHost,
    sendToGuest,
    broadcast,
    getGuestCount,
    getMyPeerId,
    getIsHost,
    destroy,

    // Event setters
    set onMessage(fn) { onMessage = fn; },
    set onPeerOpen(fn) { onPeerOpen = fn; },
    set onPeerError(fn) { onPeerError = fn; },
    set onGuestConnected(fn) { onGuestConnected = fn; },
    set onGuestDisconnected(fn) { onGuestDisconnected = fn; },
    set onConnectionStatus(fn) { onConnectionStatus = fn; },
  };
})();
