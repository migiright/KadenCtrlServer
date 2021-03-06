'use strict'

const events = require('events');
const assert = require('assert');

const sleep = require('sleep');

const bufferToStr = function(buffer){
	let s = '';
	for(let i = 0; i < buffer.length; ++i){
		s += ('00' + buffer[i].toString(16)).slice(-2) + ' ';
	}
	return s;
}

//Bufferから文字数を文字列を読み取る
//refStartは配列で0番目の要素の場所から読みとる
//読み取ったバイト数だけ増やした数が0番目の要素に入る
const readString = function(buffer, refStart){
	const start = refStart[0];
	const l = buffer.readUInt32LE(start);
	refStart[0] = start + 4 + l;
	return buffer.toString('utf8', start+4, refStart[0]);
}

const eventEmitter = new events.EventEmitter;
const controllers = {};

const Controller = function(address, socket){
	this.address = address;
	this.socket = socket;

	//+コントローラーの初期化
	const self = this; //socket.onの中でthisが変わってしまうので

	//コントローラーのプログラムが終了するかして切断された時に発生
	socket.on('close', function(){
		delete controllers[self.address];
		console.log('controller %s closed.', address);
		eventEmitter.emit('closed', { controller: self });
	});
	
	const dataCollector = getDataCollector();
	dataCollector.next();
	socket.on('data', function(chunk){ //コントローラーからデータが送られてきた時に発生
		let data;
		while((data = dataCollector.next(chunk).value) !== null){
			console.log('received %d bytes of data from %s: "%s"', data.length, address, data.toString());
			console.log(bufferToStr(data));
			
			//メッセージで処理を振り分け
			console.log('message:%d %s', data[0], Controller._messageString[data[0]]);
			if(Controller._dataProcessors[data[0]]){
				Controller._dataProcessors[data[0]].call(self, data);
			} else {
				console.log('unknown message');
			}
		}
	});
	//-コントローラーの初期化
};

// +++Controllerのメソッドとstaticメンバ+++

//コントローラーに直接データを送る
//data: Buffer
Controller.prototype.sendData = function(data){
	const sb = new Buffer(4);
	sb.writeUInt32LE(data.length);
	this.socket.write(sb);
	this.socket.write(data);
	console.log('sent %d bytes of data to %s. "%s"', data.length, this.address, data.toString());
	console.log(bufferToStr(data));
}

//コントローラーからのメッセージと文字列の対応
Controller._messageString = [
	'info', 'local'
];

//コントローラーからのメッセージごとの処理
Controller._dataProcessors = {
	[0]: function(data){ //info(name, type, imageId)
		const read = [1];
		const name = readString(data, read);
		const type = readString(data, read);
		const imageId = data.readUInt32LE(read[0]);
		
		this.name = name;
		this.type = type;
		this.imageId = imageId;
		
		eventEmitter.emit('info', {
			controller: this
			, name: name
			, type: type
			, imageId: imageId
		});
		
		console.log('received info from %s: name:%s, type:%s, imageId:%s'
			, this.address, name, type, imageId);
	}
	, [1]: function(data){ //local(各コントローラ独自のメッセージ)
		switch(this.type){
		case 'switcher':
			if(data[1] == 0 || data[1] == 1){ //スイッチのonoff
				const m = data[1] == 1 ? 'on' : 'off';
				eventEmitter.emit('local', {controller: this, message: m});
				console.log('switcher message: %s', m);
			} else {
				console.log('unknown switcher message');
			}
			break;
		case 'remocon':
			console.log('unknown remocon message');
			break;
		case 'nofunc':
			console.log('unknown nofunc message');
			break;
		default:
			console.log('unknown type received message');
		}
	}
}

//ブラウザからのメッセージを変換してコントローラーに送る
Controller.prototype.sendLocal = function(message, data){
	switch(this.type){
	case 'switcher':
		switch(message){
		case 'on':
		case 'off':
			{
				const buf = new Buffer(2);
				buf[0] = 0; //独自のメッセージであることを示す
				buf[1] = message == 'on' ? 1 : 0;
				this.sendData(buf);
				break;
			}
		default:
			console.log('tried to send unknown message: %s', message);
		}
		break;
	case 'remocon':
		switch(message){
		case 'send':
			{
				const len = encodeURIComponent(data.file).replace(/%../g,"x").length;
				const buf = new Buffer(7 + len);
				buf[0] = 0; //独自のメッセージであることを示す
				buf[1] = 0; //sendを表す
				buf[2] = data.repeat; //繰り返し回数
				buf.writeUInt32LE(len, 3);
				buf.write(data.file, 7, 'utf8');
				this.sendData(buf);
				console.log('sent %s %d', data.file, len);
				break;
			}
		default:
			console.log('tried to send message to remocon');
		}
		break;
	case 'nofunc':
		console.log('tried to send message to nofunc');
		break;
	default:
		console.log('tried to send message to unknown type');
	}
}

// ---Controllerのメソッド---

	
//データを読むジェネレータ データをを最後まで読み終えるとBufferが、まだだとnullが返る
const getDataCollector = function*(){
	//サイズとデータを読むのに使う
	//size: 何バイト読むか
	let chunk;
	let readChunk;
	chunk = yield;
	readChunk = 0;
	while(true){
		let size;
		{ //サイズ読み込み
			let read = 0;
			const buf = new Buffer(4);
			do {
				if(readChunk >= chunk.length){
					assert(readChunk == chunk.length, "readChunk > chunk.length");
					chunk = yield null;
					readChunk = 0;
				}
				const toRead = chunk.length - readChunk > 4 - read
					? 4 - read
					: chunk.length - readChunk;
				chunk.copy(buf, read, readChunk, readChunk + toRead);
				read += toRead;
				readChunk += toRead;
			} while(read < 4);
			assert(read == 4, "read > 4");
			size = buf.readUInt32LE(0);
		}
		let data;
		{ //データ読み込み
			let read = 0;
			const buf = new Buffer(size);
			do {
				if(readChunk >= chunk.length){
					assert(readChunk == chunk.length, "readChunk > chunk.length");
					chunk = yield null;
					readChunk = 0;
				}
				const toRead = chunk.length - readChunk > size - read
					? size - read
					: chunk.length - readChunk;
				chunk.copy(buf, read, readChunk, readChunk + toRead);
				read += toRead;
				readChunk += toRead;
			} while(read < size);
			assert(read == size, "read > size");
			yield buf;
		}
		
	}
};

exports.start = function(){
	//サーバーを作って起動
	const server = require('net').createServer(function(soc){
		const address = soc.remoteAddress;
		//controllersに新しく接続してきたコントローラーでControllerクラスのインスタンスを作り登録する
		const controller = new Controller(address, soc);
		controllers[address] = controller;
		
		console.log('contoroller %s connected.', address);
		//connectedイベントを発生させてsocket.ioたちに伝える
		eventEmitter.emit('connected', { controller: controller });
	}).listen(50000);	
}

exports.eventEmitter = eventEmitter;
exports.controllers = controllers;
