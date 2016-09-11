'use strict'
const cServer = require('./controller-server.js');

exports.start = function(io){

	io.on('connection', function(socket){
		console.log('socket.io connected');

		//controller-server.jsの24行目のイベントを受け取る
		cServer.eventEmitter.on('connected', function(e){
			//ブラウザに伝える
			socket.emit('connected', {
				address: e.controller.address
			});
		});
		
		cServer.eventEmitter.on('closed', function(e){
			//ブラウザに伝える
			socket.emit('closed', {
				address: e.controller.address
			});
		});
		
		//コントローラーのメッセージを伝える
		//とりあえずコントローラーからのデータを素通り
		cServer.eventEmitter.on('data', function(e){
			socket.emit('data', {
				address: e.controller.address
				, data: e.data
			});
		});
		
		//Infoを伝える
		cServer.eventEmitter.on('info', function(e){
			socket.emit('info', {
				address: e.controller.address
				, name: e.name
				, type: e.type
				, imageId: e.imageId
			});
		});
		
		//コントローラー独自のメッセージを伝える
		cServer.eventEmitter.on('local', function(e){
			socket.emit('local', {
				address: e.controller.address
				, message: e.message
				, data: e.data
			});
		});
		
		//とりあえずコントローラーにデータを素通り
		socket.on('data', function(e){
			cServer.controllers[e.address].sendData(e.data);
		});
		
		//ブラウザからのコントローラー独自のメッセージをcServerで処理
		socket.on('local', function(e){
			cServer.controllers[e.address].sendLocal(e.message, e.data);
		});
		
		//ブラウザにコントローラーのリストを送る
		const cs = [];
		for(let k in cServer.controllers){
			const c = cServer.controllers[k];
			cs.push({
				address: c.address
				, name: c.name
				, type: c.type
				, imageId: c.imageId
			});
		}
		socket.emit('controllers', cs);
		console.log('sent controllers.');
	});
	
}
