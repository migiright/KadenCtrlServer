$(document).ready(function(){
	
	//テンプレートたちをダウンロードしてくる
	const request = [
		{ url: '/ejsparts/list.ejs' }
		, { url: 'ejsparts/switcher.ejs' }
		, { url: 'ejsparts/remocon.ejs' }
		, { url: 'ejsparts/nofunc.ejs' }
	];
	const jqXHRList  = [];
	for(let i = 0; i < request.length; i++){
		jqXHRList.push($.ajax({
			type: 'GET',
			dataType: 'text',
			url: request[i].url,
		}));
	}
	$.when.apply($, jqXHRList).done(function (){ //ダウンロードし終わったら
		
		//テンプレートを整理
		const templates = {
			list: arguments[0][0]
			, switcher: arguments[1][0]
			, remocon: arguments[2][0]
			, nofunc: arguments[3][0]
		};
		
		const soc = io.connect(); //socket.ioでサーバーに接続する
		const controllers = {}; //コントローラーの情報が入った連想配列を用意
		
		//バイトの配列を送る関数
		const sendBytes = function (controller, bytes){
			const buf = new ArrayBuffer(bytes.length);
			const bs = new Uint8Array(buf);
			for(let i = 0; i < bytes.length; ++i){
				bs[i] = bytes[i];
			}
			soc.emit('data', {
				address: controller.address
				, data: buf
			});
		};
		
		//コントローラーをcontorollersに追加してノードも追加する関数
		const addController = function(controller){
			controllers[controller.address] = controller;
			
			//リストの項目を作って追加する
			$('#list').append(
				ejs.render(templates.list, {
					deviceid: 'c' + controller.address
					, icon: '/images/li' + ('00'+controller.imageId).slice(-2) + '.png'
					, listname: controller.name
				})
			).listview('refresh');
			
			//操作ページを作る
			const page = $(ejs.render(templates[controller.type], {
				deviceid: 'c' + controller.address
				, devicename: controller.name
			}));
			
			//タイプごとの初期化処理をする
			switch(controller.type){
			case 'switcher':
				page.find('.status').text('OFF');
				page.find('.on').click(function(){
					//スイッチをonするローカルメッセージ
					soc.emit('local', {address: controller.address, message: 'on'}); 
					page.find('.status').text('ON');
				});
				page.find('.off').click(function(){
					//スイッチをoffするローカルメッセージ
					soc.emit('local', {address: controller.address, message: 'off'});
					page.find('.status').text('OFF');
				});
				break;
			case 'remocon':
				break;
			case 'nofunc':
				break;
			}
			$(document.body).append(page).trigger('create');
			
			console.log('controller ' + controller.address + ' added');
		}
		
		//コントローラーをcontrollersから削除してノードも削除する関数
		const removeController = function(address){
			//リストの項目を削除
			$('[class~="controller"][class~="c' + address + '"]').remove();
			
			//もし開いているページのコントローラーが削除されたらページの遷移をしてから削除
			if(location.href.slice(location.href.indexOf('#')) == '#c'+address){
				const f = function(e, d){
					$('[id="c' + address + '"]').remove();
					$(document).off('pagecontainershow', f);
				};
				//ページを削除	
				$(document).on('pagecontainershow', f);
				$('body').pagecontainer('change', '#home');
			} else { //即削除
				$('[id="c' + address + '"]').remove();
			}
			
			delete controllers[address];
			console.log('controller ' + address + ' removed');
		};
		
		//コントローラーのリストを受け取る
		soc.on('controllers', function(e){
			for(let i = 0; i < e.length; ++i){
				addController({
					address: e[i].address
					, name: e[i].name
					, type: e[i].type
					, imageId: e[i].imageId
				});
			}
			console.log('received controllers.');
		});
		
		// +++コントローラーからのメッセージを処理+++
		
		//コントローラーが接続してきた
		soc.on('connected', function(e){
			console.log(e.address + ': connected.');
		});
		
		//コントローラーに関する情報を受け取った
		soc.on('info', function(e){
			controllers[e.address] = {
				address: e.address
				, name: e.name
				, type: e.type
				, imageId: e.imageId
			};
			addController(controllers[e.address]);
			console.log(e.address + ': received info.');
		});
		
		//コントローラーが切断された
		soc.on('closed', function(e){
			removeController(e.address);
			console.log('' + e.address + ': closed.');
		});
		
		//コントローラーが各タイプ独自のメッセージを送ってきた
		soc.on('local', function(e){
			console.log(e.address + ': received local message');
			switch(controllers[e.address].type){
			case 'switcher':
				switch(e.message){
				case 'on':
				case 'off':
					//スイッチの表示を切り替える
					$('[id="c' + e.address  + '"] .status').text(e.message.toUpperCase());
					console.log('message: ' + e.message);
					break;
				default:
					console.log('unknown message: ' + e.message);
				}
				break;
			case 'remocon':
			case 'nofunc':
				console.log('unknown message: ' + e.message);
				break;
			default:
				console.log('unknown type: ' + controllers[e.address].type);
				break;
			}
		});
		
		// ---コントローラーからのメッセージを処理---

	}).fail(function(ex){
		alert('failed ajax');
	});
	
});
