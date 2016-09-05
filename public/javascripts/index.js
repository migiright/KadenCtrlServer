$(document).ready(function(){
	
	const soc = io.connect();
	const controllers = {};
	
	//コントローラーをcontorollersに追加してノードも追加
	const addController = function(controller){
		controllers[controller.address] = controller;
		$('#controllers').append(
			$('<div />', {'class': 'controller'})
				.text(controller.address)
				.attr('data-address', controller.address)
				.attr('data-selected', Object.keys(controllers).length == 1)
		);
		$('#log').prepend('<li>controller ' + controller.address + ' added</li>');
	}
	
	//コントローラーをcontrollersから削除してノードも削除
	const removeController = function(address){
		const d = $('.controller[data-address="' + address + '"]');
		if(d.attr('data-selected') == 'true'){
			if(d.next().length == 1){
				d.next().attr('data-selected', true);
			}
		}
		d.remove();
		if($('.controller').length == 1) $('.controller').attr('data-selected', true);
		delete controllers[address];
		$('#log').prepend('<li>controller ' + address + ' removed</li>');
	}
	
	const getSelectedController = function(){
		return controllers[$('.controller[data-selected="true"]').attr('data-address')];
	}
	
	//コントローラをクリックしたとき
	$('#controllers').on('click', '*', function(){
		$('.controller[data-selected="true"]').attr('data-selected', false);
		$(this).attr('data-selected', true);
	});
	
	//sendを押したとき
	$('#button-send').click(function(){
		const c = getSelectedController();
		if(!c) return; //undefined
		//文字列を数値のarraybufferに変換
		const str =  $('#textbox-send').val()
		const ss = str.split(' ');
		const buf = new ArrayBuffer(ss.length);
		const bs = new Uint8Array(buf);
		for(let i = 0; i < ss.length; ++i){
			bs[i] = parseInt(ss[i], 16);
		}
		soc.emit('data', {
			address: c.address
			, data: buf
		});
		$('#log').prepend('<li>' + c.address + ': sent data:</li>' + str);
	});
	
	//コントローラーのリストを受け取る
	soc.on('controllers', function(e){
		for(let i = 0; i < e.length; ++i){
			addController({
				address: e[i].address
			});
		}
		$('#log').prepend('<li>received controllers.</li>');
	});
	
	soc.on('connected', function(e){
		$('#log').prepend('<li>' + e.address + ': connected.</li>');
		controllers[e.address] = {
			address: e.address
		}
		addController(controllers[e.address]);
	});
	soc.on('closed', function(e){
		$('#log').prepend('<li>' + e.address + ': closed.</li>');
		removeController(e.address);
	});
	soc.on('data', function(e){
		//データを文字列にする
		let s = '';
		const a = new Uint8Array(e.data);
		for(let i = 0; i < a.length; ++i){
			s += ('00' + a[i].toString(16)).slice(-2) + ' ';
		}
		const decoder = new TextDecoder();
		const str = decoder.decode(a);
		
		$('#log').prepend('<li><p>' + e.address + ': received data "' + str + '".</p><p>' + s + '</p></li>');
	});
});
