require('mocha');
const { expect } = require('chai');
const { WebSocket } = require('ws');
const crypto = require('crypto');

// Import the WebSocket server code
require('./../server-build/index');

describe('WebSocket Server', function() {
    let client1;
    let client2;

    beforeEach(function(done) {
        // Initialize clients
        client1 = new WebSocket('ws://localhost:8080/socket');
        client2 = new WebSocket('ws://localhost:8080/socket');

        Promise.all([
            new Promise(resolve => {
                client1.on('open', resolve);
            }),
            new Promise(resolve => {
                client2.on('open', resolve);
            }),
        ]).then(() => done());
    });

    afterEach(function(done) {
        // Close clients
        client1.close();
        client2.close();
        done();
    });

    it('should allow clients to join a room', function(done) {
        client1.once('message', (data) => {
            const msg = JSON.parse(data);
            expect(msg.type).to.be.oneOf(['connectSuccess', 'occupantsChanged']);
            done();
        });
        const roomName = 'testRoom';
        const clientId = crypto.randomBytes(16).toString("base64url");
        client1.send(JSON.stringify({
            from: clientId,
            type: 'joinRoom',
            data: { room: roomName, clientId: clientId }
        }));
    });

    it('should handle room occupancy correctly', function(done) {
        const roomName = 'occupancyRoom';
        const clientId1 = crypto.randomBytes(16).toString("base64url");
        const clientId2 = crypto.randomBytes(16).toString("base64url");

        let joinCount = 0;

        const joinRoom = (client, clientId) => {
            client.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'occupantsChanged') {
                    joinCount++;
                    if (joinCount === 2) {
                        expect(Object.keys(msg.data.occupants).length).to.equal(2);
                        done();
                    }
                }
            });
            client.send(JSON.stringify({
                from: clientId,
                type: 'joinRoom',
                data: { room: roomName, clientId: clientId }
            }));
        };

        joinRoom(client1, clientId1);
        joinRoom(client2, clientId2);
    });

    it('should handle ping-pong mechanism', function(done) {
        this.timeout(75_000);
        const roomName = 'pingRoom';
        const clientId = crypto.randomBytes(16).toString("base64url");

        let hasPing = false;
        client1.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'ping') {
                client1.send(JSON.stringify({
                    from: client1.id,
                    type: 'pong'
                }));
                hasPing = true;
            }
        });
        client1.send(JSON.stringify({
            from: clientId,
            type: 'joinRoom',
            data: { room: roomName, clientId: clientId }
        }));

        setTimeout(() => {
            expect(client1.readyState).to.equal(WebSocket.OPEN);
            expect(hasPing).to.equal(true);
            done();
        }, 70_000);
    });

    it('should handle disconnection and update room occupants', function(done) {
        this.timeout(120_000);
        const roomName = 'disconnectRoom';
        const clientId1 = crypto.randomBytes(16).toString("base64url");
        const clientId2 = crypto.randomBytes(16).toString("base64url");

        const joinRoom = (client, clientId, shouldCountJoinMessages) => {
            let joinCount = 0;

            let handler = null;
            handler = (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'occupantsChanged') {
                    joinCount++;
                    if (joinCount === 2 && !shouldCountJoinMessages) {
                        client1.close();
                        client.removeEventListener('message', handler);
                    } else if (joinCount === 2 && shouldCountJoinMessages) {
                        expect(Object.keys(msg.data.occupants).length).to.equal(1);
                        done();
                    }
                }
            };
            client.on('message', handler);
            client.send(JSON.stringify({
                from: clientId,
                type: 'joinRoom',
                data: { room: roomName, clientId: clientId }
            }));
        };

        joinRoom(client1, clientId1, false);
        setTimeout(() => {
            joinRoom(client2, clientId2, true);
        }, 1000);
    });
});
