//根据不同的页面进入不同的模块
var Modules={
    modules:{},
    init:function(){
        var that=this;
        chrome.extension.onMessage.addListener(function(msg,sender,senderResp){
            that.dispatchMsg(msg,sender,senderResp);
        });
    },
    regist:function(name,obj){
        this.modules[name]=obj;
    },
    dispatchMsg:function(msg,sender,senderResp){
        if(msg && msg.mname){
            var m=this.modules[msg.mname];
            m.handler && m.handler(msg,sender,senderResp);
        }
        else{
            console.log("un handled msg");
        }
    }
};

;(function() {

    function getNotifys(){
            var notifystr=window.localStorage.getItem("okcoin_price_notify")
            if(!notifystr){
                return []
            }
            return JSON.parse(notifystr)
    }

    var pass=window.localStorage.getItem("okcoin_trade_pass") || null;

    var storeNotifys=getNotifys();

    var moduleName="okcoin_pop"

    function onPageMsg(msg, sender, sendResp) {
        if (msg.type == "setpass") {
            pass = msg.pass;
            window.localStorage.setItem("okcoin_trade_pass",pass)
        }
        else if(msg.type=="getpass"){
            chrome.tabs.sendMessage(sender.tab.id, {
                mname: moduleName,
                type: "getpass",
                pass: pass
            })
        }
        else if(msg.type=="notify"){
            showNotification(msg.title,msg.content)
        }
        else if(msg.type=="setnotify"){
            window.localStorage.setItem("okcoin_price_notify",JSON.stringify(msg.notifys))
            storeNotifys=msg.notifys;
        }
        else if(msg.type=="getnotify"){
            chrome.tabs.sendMessage(sender.tab.id, {
                mname: moduleName,
                type: "getnotify",
                notifys:storeNotifys
            })
        }
    }

    var lastPrice;
    var currentPrice;

    function checkNotification(){
        if(!lastPrice || !currentPrice){
            return;
        }
        console.log(JSON.stringify(storeNotifys))
        for(var i=0;i<storeNotifys.length;i++){
            var p= storeNotifys[i].price;
            if(storeNotifys[i].direct=="up" && p>lastPrice && p<=currentPrice){
                showNotification({title:"价格通知",content:"比特币价格突破 RMB"+p+" 元"});
                console.log(80);
            }
            else if(storeNotifys[i].direct=="down" && p<lastPrice && p>=currentPrice){
                showNotification({title:"价格通知",content:"比特币价格跌破 RMB"+p+" 元"});
                console.log(84);
            }
        }
    }

    function getOKTradeInfo(){
        var TREND_TIMEOUT=3000;
        $.ajax({
            type:"GET",
            dataType: "json",
            url: "https://www.okcoin.com/api/ticker.do"
        }).done(function(resp){
            lastPrice = currentPrice;
            currentPrice = resp.ticker.last-0;
            console.log(resp.ticker);
            checkNotification();
            console.log("lastPrice:"+lastPrice+" currentPrice:"+currentPrice)
            setTimeout(function(){
                getOKTradeInfo();
            },TREND_TIMEOUT);
        }).fail(function(){
            setTimeout(function(){
                getOKTradeInfo();
            },TREND_TIMEOUT);
        });
    }

    getOKTradeInfo();

    function showNotification(msg){
        // Create a simple text notification:
        var notification = webkitNotifications.createNotification(
            'img/apple_icon.png',
            msg.title,  
            msg.content
        );

        // Then show the notification.
        notification.show();
    }


    Modules.regist(moduleName,{handler:onPageMsg});
})();

Modules.init();

