const net = require('net');
const varint = require('varint');

module.exports = {
  ping: (ip, port, protocol, timeout) => {
    return new Promise((resolve, reject) => {
      var jsonLength = 0;

      setTimeout(function() {
        if (!hasResponded) {
          resolve('timeout');
          client.destroy();
        }
      }, timeout);

      var hasResponded = false;
      var response = '';

      const client = new net.Socket();
      client.connect(port, ip, () => {
        const handshakePacket = Buffer.concat([
          Buffer.from([0x00]), // packet ID
          Buffer.from(varint.encode(protocol)), //protocol version
          Buffer.from([ip.length]),
          Buffer.from(ip, 'utf-8'), // server address
          Buffer.from(new Uint16Array([port]).buffer).reverse(), // server port
          Buffer.from([0x01]), // next state (2)
          Buffer.from([0x00]) // status request
        ]);
        var packetLength = Buffer.alloc(1);
        packetLength.writeUInt8(handshakePacket.length);
        var buffer = Buffer.concat([packetLength, handshakePacket]);
        client.write(buffer);
      });

      client.on('data', (data) => {
        if (jsonLength == 0) {
          try {
            varint.decode(data);
          } catch (error) {
            //console.log(`varint error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          const varint1Length = varint.decode.bytes;
          try {
            jsonLength = varint.decode(data.subarray(varint1Length + 1));
          } catch (error) {
            //console.log(`varint error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          const varint2Length = varint.decode.bytes;
          data = data.subarray(varint1Length + 1 + varint2Length);
        }
        response += data.toString();

        if (Buffer.byteLength(response) >= jsonLength) {
          client.destroy();
          try {
           resolve(JSON.parse(response));
          } catch (error) {
            //console.log(`Error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          hasResponded = true;
        }
      });

      client.on('error', (err) => {
        //console.error(`Error: ${err}`);
      });

      client.on('close', () => {
        //console.log('Connection closed');
      });
    })
  }
}