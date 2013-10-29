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
        "769期货":"http://z.btc123.com/lib/jsonProxyTickerInfo.php?type=796futuresTicker",
        "mt.gox":"http://z.btc123.com/lib/jsonProxyTickerInfo.php?type=MtGoxTicker",
        "btcchina":"http://z.btc123.com/lib/jsonProxyTickerInfo.php?type=btcchinaTicker",
        "cnbtc":"http://z.btc123.com/lib/jsonProxyTickerInfo.php?type=chbtcTicker",
        "火币":"http://z.btc123.com/lib/jsonProxyTickerInfo.php?type=huobiTicker"
    }

    function getTradeInfo(){
        for(var i in Maps){
            getLiByKey(i);
        }
        getTradeInfoImpl();
    }

    function getLiByKey(key){
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


    var lastPriceStore={};

    /**
     *
     */
    function lastPrice(key,value){
        if(typeof value =="undefined"){
            return lastPrice[key]
        }
        else{
            lastPrice[key]=value
        }
    }

    function removeTrend(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down")
    }

    function trendUp(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down").addClass("icon-arrow-up")
    }

    function trendDown(v){
        v.removeClass("icon-arrow-up").removeClass("icon-arrow-down").addClass("icon-arrow-down")
    }

    function trendKey(trend,price,key){
        var lprice=lastPrice(key);
        if(lprice){
            lprice = lprice - 0
            price = price - 0
            if(lprice == price){
                removeTrend(trend);
            }
            else if(price<lprice){
                trendDown(trend)
            }
            else if(price>lprice){
                trendUp(trend);
            }
        }
        lastPrice(key,price);
    }

    function getTradeInfoByKey(key){
        var TREND_TIMEOUT=3000;
        var url=Maps[key];
        $.ajax({
            type:"GET",
            dataType: "json",
            url: url
        }).done(function(resp){
            var li=getLiByKey(key)
            var span=li.find("span.value")
            var trend=li.find("span[data-type=icon]")
            if(key!="mt.gox"){
                var price= resp.ticker.last - 0
                if(key=="769期货"){
                    span.text("$"+price).css("background","#d7e3bc");
                }
                else{
                    span.text(price).css("background","#d7e3bc")
                }
                blink(span);
                trendKey(trend,price,key);
            }
            else{
                if(resp.result=="success"){
                    var price=resp.data.last.display;
                    var iprice =  price.replace("$","")-0
                    span.text(price)
                    trendKey(trend,iprice,key);
                    blink(span);
                }
                else{
                    span.text("获取失败")
                    blink(span);
                    removeTrend(trend)
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
            removeTrend(trend)
            setTimeout(function(){
                getTradeInfoByKey(key);
            },TREND_TIMEOUT);
        });
    }

    function getTradeInfoImpl(){
        for(var i in Maps){
            getTradeInfoByKey(i);
        }
    }

    var moduleName="okcoin_pop";

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
            if(location.href.indexOf("buy.do")>=0 && price.val()>$("#bannerBtcLast").text()){
                var conf=confirm("是否确定高于当前价格买入？")
                if(conf){
                    pwd.val(pass);
                }
                else{
                    pwd.val("");
                }
            }
            else if(location.href.indexOf("sell.do")>=0 && price.val()<$("#bannerBtcLast").text()){
                var conf=confirm("是否确定低于当前成交价格卖出？")
                if(conf){
                    pwd.val(pass);
                }
                else{
                    pwd.val("");
                }
            }
            else{
                pwd.val(pass);
            }
        })
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
     * 超过多少预警
     *
     * direct: "up"
     * price : 1000
     *
     */
    function setNotifyPair(direct,price){
    }


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

    Modules.regist(moduleName,{
        checker:function(){
            return location.href.indexOf("www.okcoin.com/buy.do")>=0 || location.href.indexOf("www.okcoin.com/sell.do")>=0;
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
            getTradeInfo();
            initTradePass();
            initPriceNotify();
            //onBgNotifyGet();
            sendGetNotifyPairMsg()
        },
        handler:function(msg,sender,senderResp){
            if(msg.type=="getpass"){
                onBgPassGet(msg.pass,msg.deny);
            }
            else if(msg.type=="getnotify"){
                console.log(378);
                onBgNotifyGet(msg.notifys);
            }
        }
    });
})();

Modules.init();
