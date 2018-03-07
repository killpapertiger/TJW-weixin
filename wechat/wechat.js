var sha1 = require('sha1');
var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var fs = require('fs');
var path = require('path')

var wechat_file = path.join(__dirname,'../config/wechat_file.txt') 
// var picUrl = path.join(__dirname,'../public/1.jpeg')
// 处理xml;
var rawBody = require('raw-body');
var util = require('../lib/util');
// get请求access_token的连接；
var prefix = 'https://api.weixin.qq.com/cgi-bin/';
var api ={
    access_token: prefix + 'token?grant_type=client_credential',
	uploadTempMaterial:prefix+'media/upload?',  //access_token=ACCESS_TOKEN&type=TYPE  上传临时素材
    getAccessToken : function(){
        return util.readFileAsync(wechat_file);
    }

}

var temp_xiehou ='';
// 确认学校，并保存值；
var temp_school = '';
// 确认性别，并保存值；
var temp_sex = '';
var temp_sure_school ='';
var temp_sure_sex ='';

// 性别时间
var total = '';


// 读取票据
function Wechat(opt) {
    var that =this;
    this.appID = opt.appID;
    this.appSecret = opt.appSecret;
    this.getAccessToken = opt.getAccessToken;
    this.saveAccessToken = opt.saveAccessToken;

    this.getAccessToken().then(
        function(data){
            try{
                data = JSON.parse(data);
            }catch(e){
                return that.updateAccessToken();
            }

            if(that.isValidAccessToken(data)){
                Promise.resolve(data);
            }else{
                return that.updateAccessToken();
            }
        }
    ).then(function(data){
        that.access_token = data.access_token;
        that.expires_in = data.expires_in;
    
        that.saveAccessToken(data);
    })
}

// 原型链添加函数
// 检查合法性；
Wechat.prototype.isValidAccessToken =function(data){
    if(!data || !data.access_token || !data.expires_in){
        return false;
    }

    var access_token = data.access_token;
    var expires_in = data.expires_in;
    var now = (new Date().getTime());

    if(now < expires_in){
        return true;
    }else{
        return false;
    }
}

// 更新access_token；
 Wechat.prototype.updateAccessToken = function(){
    var appID = this.appID;
    console.log('app:'+appID);
    var appSecret = this.appSecret;
    console.log('appS:'+appSecret);

    var url = api.access_token + '&appid=' +appID + '&secret='+appSecret;
    console.log('url:'+url)

    return new Promise(function(resolve,reject){
          // 请求地址
        request({url: url, json:true}).then(function(response){
            console.log(response.body);
          var data = response.body;
        //   console.log('ex::::::::::'+data);
          var now = (new Date().getTime());

        //  出现问题？？？？？？显示expires没有定义？？？
          var expires_in = now + (response.body.expires_in - 20)*1000;
            var access_token = response.body.access_token;

          data.expires_in = expires_in;
        data.access_token = access_token;
          resolve(data);

        });

    })
  
}

Wechat.prototype.fetchAccessToken = function(){
	var that = this;

	// 如果this上已经存在有效的access_token，直接返回this对象
	if(this.access_token && this.expires_in){
		if(this.isvalidAccessToken(this)){
			return Promise.resolve(this);
		}
	}

	this.getAccessToken().then(function(data){
		try{
			data = JSON.parse(data);
		}catch(e){
			return that.updateAccessToken();
		}
		if(that.isvalidAccessToken(data)){
			return Promise.resolve(data);
		}else{
			return that.updateAccessToken();
		}
	}).then(function(data){
		that.access_token = data.access_token;
		that.expires_in = data.expires_in;
		that.saveAccessToken(JSON.stringify(data));
		return Promise.resolve(data);
	});
}

// 上传临时素材；
Wechat.prototype.uploadTempMaterial = function(type,filepath){
	var that = this;
	var form = {  //构造表单
		media:fs.createReadStream(filepath)
	}
	return new Promise(function(resolve,reject){
		that.fetchAccessToken().then(function(data){
			var url = api.uploadTempMaterial + 'access_token=' + data.access_token + '&type=' + type;
			request({url:url,method:'POST',formData:form,json:true}).then(function(response){
				var _data = response.body;
				if(_data){
					resolve(_data)
				}else{
					throw new Error('upload temporary material failed!');
				}
			}).catch(function(err){
				reject(err);
			});
		});
	});
}


// 出口
module.exports = function(opt){
  

         // 实例化Wechat
         var wechat  = new Wechat(opt);

    return function *(next){
         
         var that = this;
        console.log(this.query);
        
        var token = opt.token;
        var signature = this.query.signature;
        var nonce = this.query.nonce;
        var timestamp = this.query.timestamp;
        var echostr =  this.query.echostr;
    
        var str = [token,timestamp,nonce].sort().join('');
        var sha = sha1(str);
        console.log(str);
        console.log(sha);
    
        if(this.method === 'GET' ){
            if(sha === signature){
                this.body = echostr+'';
                console.log('相等');
        
            }else{
                this.body = 'wrong!';
                console.log('wrong!');
            }
        }else if(this.method === 'POST'){

            if(sha !== signature){
                this.body = ' post is wrong!';
                return false;
            }

              
                // 获取xml数据
                var data = yield rawBody(this.req,{
                    length:this.length,
                    limit:'1mb',
                    encoding:this.charset
                });

                // 转化成json数据
                var content = yield util.parseXMLAsync(data);


                var msg =  util.formatMsg(content.xml);

                

                // 测试测试
                if(msg.MsgType === 'text' ){
                    var content = msg.Content;
                    console.log('content是:'+content);
                    console.log('是文本');
                
                    if(content === '邂逅'){
                        var now = new Date().getTime();
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_xiehou = content;
                        var back ='欢迎来到【邂逅实验室】，希望你能在这里邂逅到有趣的灵魂。'+'\n'+
                        '为了更好地迎接即将到来的这场邂逅，'+'\n'+
                        '请你认真地回答几个问题：'+'\n'+
                        '我来自北师，我希望邂逅北师的朋友，请回复A；'+'\n'+
                        '我来自北师，我希望邂逅北理的朋友，请回复B；'+'\n'+
                        '我来自北理，我希望邂逅北理的朋友，请回复C；'+'\n'+
                        '我来自北理，我希望邂逅北师的朋友，请回复D。'+'\n'+
                        '活动中遇到任何问题，请添加客服微信号:TJWstation';

                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                        
                    }else if(temp_xiehou === '邂逅' && content === 'A'){
                        var now = new Date().getTime();
                        total = new Date().getTime();
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        // temp_xiehou = content;
                        temp_school = content;
                        
                        var back ='你来自北师，你想邂逅北师的朋友，确认请回复1，重新选择请回复2，5分钟不回复就当做你确认了哦。';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                 
                        
                    }else if(temp_xiehou === '邂逅' && content === 'B'){
                        var now = new Date().getTime();
                        total = new Date().getTime();
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_school = content;

                        var back ='你来自北师，你想邂逅北理的朋友，确认请回复1，重新选择请回复2，5分钟不回复就当做你确认了哦。';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                        
                    }else if(temp_xiehou === '邂逅' && content === 'C'){
                        var now = new Date().getTime();
                        total = new Date().getTime();
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_school = content;

                        var back ='你来自北理，你想邂逅北理的朋友，确认请回复1，重新选择请回复2，5分钟不回复就当做你确认了哦。';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                        
                    }else if(temp_xiehou === '邂逅' && content === 'D'){
                        var now = new Date().getTime();
                        total = new Date().getTime();
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_school = content;

                        var back ='你来自北理，你想邂逅北师的朋友，确认请回复1，重新选择请回复2，5分钟不回复就当做你确认了哦。';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                        
                    }
                    // 重新选择；
                    else if(temp_xiehou === '邂逅' && content === '2'){
                        var now = new Date().getTime();
                        total = '';
                        
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_xiehou = content;
                        var back ='请重新选择'+'\n'+
                        '我来自北师，我希望邂逅北师的朋友，请回复A；'+'\n'+
                        '我来自北师，我希望邂逅北理的朋友，请回复B；'+'\n'+
                        '我来自北理，我希望邂逅北理的朋友，请回复C；'+'\n'+
                        '我来自北理，我希望邂逅北师的朋友，请回复D。'+'\n'+
                        '活动中遇到任何问题，请添加客服微信号:TJWstation';

                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)         

                    }
                    // 确认环节；
                    else if((temp_xiehou ==='邂逅'  && content === '1') && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') ){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sure = content;
                        
                        var back = '好的，你的要求我收到了，接下来请你再做一个选择：'+'\n'+
                                    '我是男生，想邂逅男生，请回复E；'+'\n'+
                                    '我是男生，想邂逅女生，请回复F；'+'\n'+
                                    '我是女生，想邂逅男生，请回复H；'+'\n'+
                                    '我是女生，想邂逅女生，请回复I。';

                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                    
                    }else if(temp_xiehou ==='邂逅'  && temp_sure === '1' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && content ==='E'){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sex = content;
                        temp_sure = '';
                        console.log('temp_sex是：'+temp_sex);
                        var back ='你是男生，想邂逅男生，确认请回复yes，重新选择请回复no，5分钟不回复就当做你确认了哦!';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                        
                    }else if(temp_xiehou ==='邂逅'  && temp_sure === '1' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && content ==='F'){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sex = content;
                        temp_sure = '';
                        
                        var back ='你是男生，想邂逅女生，确认请回复yes，重新选择请回复no，5分钟不回复就当做你确认了哦!';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back) ;

                    }else if(temp_xiehou ==='邂逅'  && temp_sure === '1' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && content ==='H'){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sex = content;
                        temp_sure = '';
                        
                        var back ='你是女生，想邂逅男生，确认请回复yes，重新选择请回复no，5分钟不回复就当做你确认了哦!';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back) ;
                    }else if(temp_xiehou ==='邂逅'  && temp_sure === '1' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && content ==='I'){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sex = content;
                        temp_sure = '';
                        
                        var back ='你是女生，想邂逅女生，确认请回复yes，重新选择请回复no，5分钟不回复就当做你确认了哦!';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back) ;
                    }else if( temp_xiehou ==='邂逅'   && content==='yes' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && (temp_sex ==='E' || temp_sex ==='F' || temp_sex ==='H' || temp_sex ==='I')){

                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';

                        temp_sure_sex = content;

                        var back ='恭喜你成功加入今天的【邂逅实验室】！'+'\n'+
                        '我将在实验室里努力挑选一位有缘人与你邂逅，'+'\n'+
                        '接下来请你挑选一张你认为满意的本人照片发给我们，'+'\n'+
                        '我们将用这张照片作为媒介，让你们进行一轮初步交流，'+'\n'+
                        '所以一定要翻遍相册找张你非常满意的照片噢！';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back) ;
                    }
                    // 重新选择
                    else if(temp_xiehou ==='邂逅'   && content==='no' && (temp_school === 'A' || temp_school === 'B' || temp_school === 'C' || temp_school === 'D') && (temp_sex ==='E' || temp_sex ==='F' || temp_sex ==='H' || temp_sex ==='I')){
                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        temp_sure = content;
                        
                        var back = '请重新选择：'+'\n'+
                                    '我是男生，想邂逅男生，请回复E；'+'\n'+
                                    '我是男生，想邂逅女生，请回复F；'+'\n'+
                                    '我是女生，想邂逅男生，请回复H；'+'\n'+
                                    '我是女生，想邂逅女生，请回复I。';

                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)                        
                    
                            
                    }
                    else{

                        var now = new Date().getTime();
                        this.status = 200;
                        this.type = 'application/xml';
                        var back = '听不懂你在说的是什么？';
                        this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)
                        console.log("that.body:"+this.body)
                    }

                        
                }else if(msg.MsgType === 'image' && temp_xiehou != '' ){
                    var now = new Date().getTime()
                    
                    this.status = 200;
                    this.type = 'application/xml';
                    var back ='你的照片已经成功提交到【邂逅实验室】啦，'+'正在为你寻找邂逅对象'+'这可能需要点时间，你可以晚点再来';

                    this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back)   
                    // var data = '';
                    // fs.readFile(wechat_file, "utf-8", function(error, config) {
                    //     if (error) {
                    //         console.log(error);
                    //         console.log("config文件读入出错");
                    //     }
                   
                    // console.log(config.toString());
                    // var temp= config.toString();
                    //  data =JSON.parse(temp)
                    // console.log('原来的函数 access_token：'+data.access_token);


                    // var url =api.uploadTempMaterial+'access_token='+data.access_token+'&type=image';


                    // var form = {
                    //     media: fs.createReadStream(__dirname+'/public/1.jpeg')
                    // };
                
                    
                    // request({url:url,method:'POST',formData:form,json:true}).then(function(response){
                    //     var _data = response.body;
                    //     console.log('_data:'+_data)
                    // }) 
                    // this.body={
				    //     mediaId:msg.media_id  
                    // }    
                    // });
                
                    
                        

                }
                else if(msg.MsgType === 'voice' ){
                    var now = new Deta().getTime()
                    this.status = 200;
                    this.type = 'application/xml';
                    var back ='你的语音已经成功提交到【邂逅实验室】啦!'

                    this.body = xmlToreply(msg.FromUserName,msg.ToUserName,now,back);

                }
            
                return ;
              
            }
          
            
        }
    
}


function A(temp_xiehou,temp_school,temp_sex){

}

// 读取txt内容
function toJson(wechat_file){
    fs.readFile(wechat_file, "utf-8", function(error, config) {
        if (error) {
            console.log(error);
            console.log("config文件读入出错");
        }
   
    console.log(config.toString());
    var temp= config.toString();
    var data =JSON.parse(temp)
    console.log('原来的函数 access_token：'+data.access_token)
    // temp_access = data.access_token;
    return data.access_token;
});
   

}




function xmlToreply(a,b,c,d){
    var reply ='<xml><ToUserName>'+ a+'</ToUserName><FromUserName>'+ b+'</FromUserName><CreateTime>'+ c +'</CreateTime><MsgType>text</MsgType><Content>'+d+'</Content>'+'</xml>';
    return reply;
}

function log( ctx ) {
    console.log( ctx.method, ctx.body,ctx.header.host + ctx.url )
}

