//根据不同的页面进入不同的模块
var Modules={
    modules:{},
    init:function(){
        var that=this;
        chrome.extension.onMessage.addListener(function(msg,sender,senderResp){
            that.dispatchMsg(msg,sender,senderResp);
        });

        for(var name in that.modules){
            var m=that.modules[name];
            if(m && m.checker()){
                m.init();
            }
        }
    },
    regist:function(name,obj){
        this.modules[name]=obj;
    },
    dispatchMsg:function(msg,sender,senderResp){
        if(msg && msg.mname){
            var m=this.modules[msg.mname];
            m.handler(msg,sender,senderResp);
        }
        else{
            console.log("un handled msg");
        }
    }
};

(function(){
    var Maps={
        "769":"http://www.btc123.com/e/interfaces/tickers.php?type=796futuresTicker",
        "mt.gox":"http://www.btc123.com/e/interfaces/tickers.php?type=MtGoxTicker",
        "btcc":"http://www.btc123.com/e/interfaces/tickers.php?type=btcchinaTicker",
        "cnbtc":"http://www.btc123.com/e/interfaces/tickers.php?type=chbtcTicker",
        "火币":"http://www.btc123.com/e/interfaces/tickers.php?type=huobiTicker"
    }

    function getBtcTradeInfo(){
        for(var i in Maps){
            getBtcLiByKey(i);
        }
        getBtcTradeInfoImpl();
    }

    function getBtcLiByKey(key){
        var li=$("#id_trade_info_pop").find("li[data-type='"+key+"']")
        if(li.length==0){
            $("#id_trade_info_pop").append('<li data-type="'+key+'"><span class="label">'+key+'</span><span class="value"></span><span data-type="icon" ></span></li>')
            li=$("#id_trade_info_pop").find("li[data-type='"+key+"']")
        }
        return li;
    }

    function blink(obj){
        obj.delay(500, "fader")
        .queue("fader", function(next) {
            $(this).css("background","white")
            next();
        })
        .dequeue("fader")
    }


    /**
     *  btc last price for every market
     */
    var btcMarketLastPrice={};

    /**
     */
    function lastPrice(key,value){
        if(typeof value =="undefined"){
            return btcMarketLastPrice[key]
        }
        else{
            btcMarketLastPrice[key]=value
        }
    }

    function removePriceTrend(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down")
    }

    function priceTrendUp(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down").addClass("icon-arrow-up")
    }

    function priceTrendDown(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down").addClass("icon-arrow-down")
    }

    function setMarketPriceTrend(trend,price,key){
        var lprice=lastPrice(key);
        if(lprice){
            lprice = lprice - 0
            price = price - 0
            if(lprice == price){
                removePriceTrend(trend);
            }
            else if(price<lprice){
                priceTrendDown(trend)
            }
            else if(price>lprice){
                priceTrendUp(trend);
            }
        }
        lastPrice(key,price);
    }

    var doller2rmb_ratio=6.11;


    function d2r(p){
        return parseInt(p*doller2rmb_ratio)
    }

    function getTradeInfoByKey(key){
        var TREND_TIMEOUT=3000;
        var url=Maps[key];
        $.ajax({
            type:"GET",
            dataType: "json",
            url: url
        }).done(function(resp){
            var li=getBtcLiByKey(key)
            var span=li.find("span.value")
            var trend=li.find("span[data-type=icon]")
            if(key!="mt.gox"){
                var price= resp.ticker.last - 0
                if(key=="769"){
                    span.text("$"+price+" R:"+d2r(price)).css("background","#d7e3bc");
                }
                else{
                    span.text(price).css("background","#d7e3bc")
                }
                blink(span);
                setMarketPriceTrend(trend,price,key);
            }
            else{
                if(resp.result=="success"){
                    var price=resp.data.last.display.replace(",","")
                    var iprice =  price.replace("$","")-0
                    span.text(price+" R:"+d2r(iprice))
                    setMarketPriceTrend(trend,iprice,key);
                    blink(span);
                }
                else{
                    span.text("获取失败")
                    blink(span);
                    removePriceTrend(trend)
                }
            }
            setTimeout(function(){
                getTradeInfoByKey(key);
            },TREND_TIMEOUT);
        }).fail(function(){
            //console.log("获取json信息失败")
            var li=getLiByKey(key);
            var span=li.find("span.value")
            var trend=li.find("span[data-type=icon]")
            span.text("获取失败")
            blink(span);
            removePriceTrend(trend)
            setTimeout(function(){
                getTradeInfoByKey(key);
            },TREND_TIMEOUT);
        });
    }

    function getBtcTradeInfoImpl(){
        for(var i in Maps){
            getTradeInfoByKey(i);
        }
    }

    var moduleName="okcoin_pop";

    /**
     * 初始化密码，不用重复输入
     */
    function initTradePass(){
        setTimeout(function(){
            sendGetPassMsg();
            console.log("init trade pass")
        },3000);
    }

    function sendGetPassMsg(){
        chrome.extension.sendMessage(null,{mname:moduleName,type:"getpass"});
    }

    function sendSetPassMsg(pass){
        chrome.extension.sendMessage(null,{mname:moduleName,type:"setpass",pass:pass});
    }

    function sendDenySetPass(){
        chrome.extension.sendMessage(null,{mname:moduleName,type:"denypass",pass:pass});
    }

    function sendGetNotifyPairMsg(){
        chrome.extension.sendMessage(null,{mname:moduleName,type:"getnotify"});
    }

    function sendSetNotifyPairMsg(notifys){
        chrome.extension.sendMessage(null,{mname:moduleName,type:"setnotify",notifys:notifys});
    }

    function autoSetPass(pass){
        var price=$("#tradeCnyPrice");
        price.unbind("blur").blur(function(){
            var pwd=$("#tradePwd");
            var currentPrice = location.href.indexOf("ltc.do")? $("#bannerLtcLast").text() : $("#bannerBtcLast").text()
            var sellType= location.href.indexOf("tradeType=1")>=0 ;

            if((!sellType) && price.val()>currentPrice){
                tipsAlert("是否确定高于当前价格买入？")
                pwd.val(pass);
            }
            if(sellType && price.val()<currentPrice){
                tipsAlert("是否确定低于当前成交价格卖出？")
                pwd.val(pass);
            }
            else{
                pwd.val(pass);
            }
        })
    }

    function tipsAlert(s){
        $("#tradeCnyPrice").fadeOut(500).fadeIn(200)
    }

    function promptPassSet(){
        var inputPass=prompt("请输入您需要自动填入的交易密码，不想自动输入密码请点击取消，以后还想设置密码，可以从复层点击进入")
        if(inputPass){
            sendSetPassMsg(inputPass)
            autoSetPass(inputPass)
        }
        else{
            sendDenySetPass();
        }
    }

    /**
     * 从后台拿到pass之后的处理
     */
    function onBgPassGet(pass,deny){
        if(deny){
            return;
        }
        if(!pass){
            promptPassSet();
        }
        else{
            autoSetPass(pass);
        }
    }

    var FuncHtmlTemplet=[
        '<li data-action="setpass" class="btn">设置密码</li>'
    ];

    /**
     * 从后台获取到notify然后展示
     */
    function onBgNotifyGet(tr){
        var tpl=[
            '<table class="table-bordered table" > ',
            '  <thead>',
            '      <tr>',
            '          <th>类型</th>',
            '          <th>价格</th>',
            '          <th>操作</th>',
            '      </tr>',
            '  </thead> ',
            '  <tbody> ',
            '      <tr>',
            '          <td><select><option value="up">向上突破</option><option value="down">向下跌破</option></select></td>',
            '          <td><input></input></td>',
            '          <td><button class="add">新增</button></td>',
            '      </tr>  ',
            '      {#tr}',
            '      <tr>',
            '          <td data-dir="{direct}">{direct_str}</td>',
            '          <td>{price}</td>',
            '          <td><button class="del">删除</button></td>',
            '      </tr>  ',
            '      {/tr}',
            '  </tbody> ',
            '</table>',
            '',
        ];
        var tpl=new Templet(tpl.join(""))
        tr = tr || []
        for(var i=0;i<tr.length;i++){
            tr[i].direct_str=tr[i].direct=="up"?"向上突破":"向下跌破";
        }
        $("div.func div.notify").html(tpl.render({tr:tr}));

        $("div.func div.notify button.add").click(function(){
            var closeTr= $(this).closest("tr")
            var dir=closeTr.find("select").val()
            var price=closeTr.find("input").val()
            if(!price || isNaN(parseFloat(price))){
                alert("请输入有效的价格..")
                return;
            }
            tr.push({price:parseFloat(price),direct:dir})
            sendSetNotifyPairMsg(tr);
            onBgNotifyGet(tr);
        });

        $("div.func div.notify button.del").click(function(){
            var closeTr= $(this).closest("tr")
            var direct=closeTr.find("td:eq(0)").attr("data-dir")
            var price=closeTr.find("td:eq(1)").html()
            for(var i=tr.length-1;i>=0;i--){
                if(tr[i].direct==direct && tr[i].price==price){
                    tr.splice(i,1)
                }
            }
            sendSetNotifyPairMsg(tr);
            onBgNotifyGet(tr);
        });
    }

    function initLtcAskBide(objs){
        var div= $(".coinBoxBody ul.orderlist")
        console.log(334);
        objs.lastprice = lastLtcPrice();
        var html=[
            '        {#asks}',
            '        <li class="red"><span class="c1 height-35">卖 ({10-@idx})</span><span class="c2 height-35">{0}</span><span class="c3 height-35">Ł{1}</span></li>',
            '        {/asks}',
            '        {#bids}',
            '        <li class="lightgreen5"><span class="c1 height-35">买 ({@idx+1})</span><span class="c2 height-35">{0}</span><span class="c3 height-35">Ł{1}</span></li>',
            '        {/bids}',

            '        <li class="center"><span class="black bold fontsize">最新成交价:</span> <span class="lightorange1 fontsize">{lastprice}</span></li>',
        ]

        var tpl=new Templet(html.join(""))
        div.html(tpl.render(objs))
    }

    function lastLtcPrice(val){
        var div= $(".coinBoxBody ul.orderlist")
        if(typeof val=="undefined"){
            return div.find("li.center").find("span.lightorange1").text()
        }
        else{
            div.find("li.center").find("span.lightorange1").text(val)
        }
    }

    function initPriceNotify(){
        setInterval(function(){
            var currentPrice = document.getElementById('bannerBtcLast').innerHTML,

            total = document.querySelector('.money.orange').innerHTML;
            document.title = currentPrice + '  |  ' + total;
        },1000)
    }

    function addFuncBtn(){

            $("div.tradecon").find("ul.funclist").html(FuncHtmlTemplet.join(""))
            $("ul.funclist li").click(function(e){
                var action= $(this).attr("data-action")
                if(action == "setpass"){
                    promptPassSet();
                }
            });
    }

    /**
     * 开启自动刷新
     */
    function delayRefreshLtc(){
        $("div.buyonesellone").css("height","650px")
        setTimeout(refreshLtcPrice,800)
    }

    function delayRefreshLtcLastPrice(){
        setTimeout(refreshLtcLastPrice,800)
    }

    function refreshLtcLastPrice(){
        var url = "http://www.okcoin.com/api/trades.do?symbol=ltc_cny"
        $.ajax({
            type:"GET",
            dataType: "json",
            url: url
        }).done(function(resp){
            lastLtcPrice(resp[0].price)
            delayRefreshLtcLastPrice()
        }).fail(function(err){
            delayRefreshLtcLastPrice()
        })
    }

    function refreshLtcPrice(){
        var url="https://www.okcoin.com/api/depth.do?symbol=ltc_cny"
        $.ajax({
            type:"GET",
            dataType: "json",
            url: url
        }).done(function(resp){
            //console.log(resp)
            var asktotal=resp.asks.length
            var bidstotal=resp.bids.length
            var COUNT=10
            var obj={asks: resp.asks.slice(asktotal-COUNT),bids: resp.bids.slice(0,COUNT)}
            console.log(419);
            //设置第三档价位为卖价格
            //
            var sellType= location.href.indexOf("tradeType=1")>=0 ;
            if (sellType){
                //第三档价格卖
                var price =  resp.asks.slice(asktotal-3)[0][0]
                //$("#tradeCnyPrice").val(price)
            }
            else{
                var price =  resp.bids[3][0]
                //第三档价格买
                //$("#tradeCnyPrice").val(price)
            }
            initLtcAskBide(obj);
            delayRefreshLtc()
        }).fail(function(){
            delayRefreshLtc()
            console.log("获取行情信息失败")
        });
    }

    Modules.regist("okcoin_btc",{

        checker:function(){
            var urls=[
                "www.okcoin.com/btc.do",
                "www.okcoin.com/trade/btc.do",
            ];
            for(var i=0;i<urls.length;i++){
                if(location.href.indexOf(urls[i])>=0){
                    return true;
                }
            }
            return false;
        },

        init:function(){
            var body=[
                '<div class="tradecon">',
                '    <ul class="tradepop" id="id_trade_info_pop" ></ul>',
                '    <div class="func">',
                '        <ul class="funclist"></ul>',
                '        <h3>价格通知</h3>',
                '        <div class="notify"><div/>',
                '    </div>',
                '</div>'
            ];
            $("body").append(body.join(''));
            addFuncBtn();
            getBtcTradeInfo();
            initTradePass();
            sendGetNotifyPairMsg()
        },

        handler:function(msg,sender,senderResp){
            if(msg.type=="getpass"){
                onBgPassGet(msg.pass,msg.deny);
            }
            else if(msg.type=="getnotify"){
                onBgNotifyGet(msg.notifys);
            }
        }
        
    })

    Modules.regist(moduleName,{
        checker:function(){
            var urls=[
                "www.okcoin.com/ltc.do",
                "www.okcoin.com/trade/ltc.do",
            ];
            for(var i=0;i<urls.length;i++){
                if(location.href.indexOf(urls[i])>=0){
                    return true;
                }
            }
            return false;
        },
        init:function(){
            initTradePass();
            if(location.href.indexOf("ltc.do")>=0){
                delayRefreshLtc()
                delayRefreshLtcLastPrice()
            }
            sendGetNotifyPairMsg()
        },
        handler:function(msg,sender,senderResp){
            if(msg.type=="getpass"){
                onBgPassGet(msg.pass,msg.deny);
            }
            else if(msg.type=="getnotify"){
                onBgNotifyGet(msg.notifys);
            }
        }
    });
})();

Modules.init();
