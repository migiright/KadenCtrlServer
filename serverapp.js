//httpモジュールをロード
var http = require('http');
var fs =require('fs');
//ejsオブジェクトの取得
var ejs = require('ejs');
//テンプレートファイルの読み込み(同期処理)
var index = fs.readFileSync('views/index.ejs', 'utf8');
//★１．content.ejsテンプレートファイル読み込み
var list = fs.readFileSync('views/list.ejs', 'utf8');
//★１．content.ejsテンプレートファイル読み込み
var fanlight = fs.readFileSync('views/fan-light.ejs', 'utf8');
//★１．content.ejsテンプレートファイル読み込み
var remocon = fs.readFileSync('views/remocon.ejs', 'utf8');
 
//「createServer」メソッドを呼び出してhttp.Serverオブジェクトを作成
var server = http.createServer();
//onメソッドでserverオブジェクトのrequestイベントにdoRequestという関数を割り当て
server.on('request', doRequest);
//server待ち受け
server.listen(3000);
console.log('Server running!');
 
// リクエストの処理
//第１引数は、「request」オブジェクト:クライアントからのリクエストに関する機能
//第２引数は「response」オブジェクト:サーバーからクライアントへ戻されるレスポンスに関する機能
function doRequest(req, res) {
	//★２．content.ejsのレンダリング
	var fanpage = ejs.render(fanlight,{
		deviceid:"fan",
		devicename:"扇風機",
		status:"ON",
	});
	var lightpage = ejs.render(fanlight,{
		deviceid:"light",
		devicename:"卓上ライト",
		status:"ON"
	});
	var remoconpage = ejs.render(remocon,{
		ch:"1"
	});
	var listdata01 = ejs.render(list,{
		deviceid:"fan",
		icon:"images/li01.png",
		listname:"扇風機"
	});
	var listdata02 = ejs.render(list,{
		deviceid:"light",
		icon:"images/li02.png",
		listname:"卓上ライト"
	});
	var listdata03 = ejs.render(list,{
		deviceid:"remocon",
		icon:"images/li03.png",
		listname:"赤外線リモコン"
	});
	
    	var indexdata   = ejs.render(index,   {
		list01  : listdata01,
		list02  : listdata02,
		list03  : listdata03,
		fan     : fanpage,
		light   : lightpage,
		remocon    : remoconpage
	});
	//ヘッダー情報の書き出しresponseオブジェクトの「writeHead」メソッド
	res.writeHead(200, {'Content-Type': 'text/html'});
	//★４．コンテンツの書き出しresponseオブジェクトの「write」メソッド
	res.write(indexdata);
	//コンテンツの完了responseの「end」
	res.end();
}