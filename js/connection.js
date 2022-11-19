import { documentEvent } from './shorthands.js';

const dummyBugout = new Bugout('', {announce: [''], wt: {}, torrent: {on: () => {}, wires: []}});
const { nacl, bs58 } = dummyBugout;

function getRoom() {
  let roomKeyRaw;
  let roomKeyEncoded;
  if (window.location.hash.includes('list')) {
    roomKeyEncoded = window.location.hash.split('list/').pop();
    roomKeyRaw = bs58.decode(roomKeyEncoded);
  }
  else {
    roomKeyRaw = nacl.randomBytes(32);
    roomKeyEncoded = bs58.encode(roomKeyRaw);
    history.replaceState(null, '', '#/list/' + roomKeyEncoded);
  }
  const roomIdRaw = nacl.hash(roomKeyRaw);
  const roomIdEncoded = bs58.encode(roomIdRaw);
  return {
    keyRaw: roomKeyRaw,
    key: roomKeyEncoded,
    idRaw: roomIdRaw,
    id: roomIdEncoded,
  };
}

let knownAddresses = [];

export async function connection() {
  documentEvent('connection.progress', {status: connection.STATUS.LOADING, count: 0});
  async function fetchTrackers() {
    try {
      const response = await fetch('https://ngosang.github.io/trackerslist/trackers_all_ws.txt');
      const text = await response.text();
      const trackers = text.split('\n\n');
      return trackers.filter(tracker => tracker.startsWith('wss://'));
    } catch(err) {
      return [];
    }
  }
  const initialTrackers = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
  ];
  const extraTrackers = await fetchTrackers();
  documentEvent('connection.progress', {status: connection.STATUS.CONNECTING, count: 0});
  const trackers = [...new Set(initialTrackers.concat(extraTrackers))];
  const room = getRoom();
  const bugout = new Bugout(`hajalista-${room.id}`, {
    'announce': trackers,
  });
  bugout.on('connections', function(count) {
    if (count == 0) {
      documentEvent('connection.progress', {status: connection.STATUS.WAITING_PEERS, count});
    }
    else {
      documentEvent('connection.progress', {status: connection.STATUS.CONNECTED, count});
    }
  });

  bugout.on('message', function(address, message) {
    console.log('message', message, knownAddresses);
    const isKnown = knownAddresses.includes(address);
    if (message.type === 'id?') {
      const text = room.id + bugout.address();
      const hash = nacl.hash(Uint8Array.from(text.split('').map(c => c.charCodeAt())));
      const hashEncoded = bs58.encode(hash);
      bugout.send(address, {
        type: 'id',
        content: hashEncoded,
        isKnown: isKnown,
      });
      return;
    }
    else if (message.type === 'id') {
      const text = room.id + address;
      const hash = nacl.hash(Uint8Array.from(text.split('').map(c => c.charCodeAt())));
      const hashEncoded = bs58.encode(hash);
      if (hashEncoded == message.content) {
        if ( ! isKnown) {
          knownAddresses.push(address);
          documentEvent('connection.peer.connected', {address: address});
        }
        if ( ! message.isKnown) {
          const text = room.id + bugout.address();
          const hash = nacl.hash(Uint8Array.from(text.split('').map(c => c.charCodeAt())));
          const hashEncoded = bs58.encode(hash);
          bugout.send(address, {
            type: 'id',
            content: hashEncoded,
            isKnown: true,
          });
        }
      }
      return;
    }
    else if ( ! isKnown) {
      bugout.send(address, {type: 'id?'});
      return;
    }
    else if (message.type !== undefined) {
      documentEvent(`connection.receive.${message.type}`, {message: message});
    }
  });

  bugout.on('seen', function(address) { console.log('seen', address); });
  bugout.on('ping', function(address) { if (address !== bugout.address()) console.log('ping', address); });
  bugout.on('left', function(address) { console.log('left', address); });
  bugout.on('timeout', function(address) { console.log('timeout', address); });
  bugout.on('ping', function(address) {
    if ( ! knownAddresses.includes(address) && address !== bugout.address()) {
      bugout.send(address, {type: 'id?'});
    }
  });
  function removeKnownAddress(address) {
    if (knownAddresses.includes(address)) {
      knownAddresses.splice(knownAddresses.indexOf(address), 1);
    }
  }
  bugout.on('left', removeKnownAddress);
  bugout.on('timeout', removeKnownAddress);

  bugout.send({type: 'hello'});
  bugout.heartbeat();

  document.addEventListener('connection.send', function sendMessage(event) {
    if (event.detail.address) {
      bugout.send(event.detail.address, event.detail.message);
    }
    else {
      for (const address of knownAddresses) {
        bugout.send(address, event.detail.message);
      }
    }
  });
}

connection.STATUS = {
  LOADING: 'loading',
  CONNECTING: 'connecting',
  WAITING_PEERS: 'waiting-peers',
  CONNECTED: 'connected',
};

connection();
