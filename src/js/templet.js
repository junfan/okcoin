;
/**
 * 开发这个模版引擎主要是之前用过一些不好，比较难使用的模版，
 * 在web前端很多时候我们可能会使用一些innerHTML的方式来构建
 * 一个代码块，一般这种情况都是通过一个数据与一个模版来进行
 * 填充的。这里这种模版的思想主要是受到http://mustache.github.com/
 * 的影响，最大的特点就是无逻辑，无逻辑最大的好处就是逻辑代码
 * 与生成html的代码进行了分离，这样减少了交叉污染，特别不喜欢
 * 看到模版代码里面充斥着各种if else语句，for语句，然后导致
 * 我们需要按照这个模版自己的语法运算一下才能够知道最后生成
 * 出来的东西长什么样。所以我们鼓励的是尽量减少模版中的逻辑
 * 处理，这些处理大可以在数据中处理好，然后直接让模版渲染。
 *
 * 为什么需要这样？
 *
 * 如果模版中有了太多的逻辑处理的话，我们知道这种代码肯定是很难理解的
 * 也就是模板做了两个事情，一部分包含了数据处理的逻辑，另外一部分就
 * 包含了生成文本的工作。而相对来说，模版适合处理的是生成文本，而处理
 * 数据的逻辑应该放在模版引擎之外，除了小部分通用处理之外，其它的逻辑
 * 应该放在模版之外。为什么应该放在模版之外，因为对于数据的处理应该是
 * 本身的编程语言比模版更加的直观，第二个就是可以减少调试模版的复杂性
 * 因为模版语言相对来说比直接的数据更加难调试一些，所以我们建议把逻辑
 * 都放在模版之外，模版只针对数据，生成最终的字符串
 *
 *
 * 我们都支持什么？
 *
 *
 * 1 分区{#section}abc{/section}，就是相当于一个子模版了
 *
 * 分区对应的数据如果是一个数组的话，那我们就对数组中每个数据进行循环生成
 * 如果对应的是一个对象的话，就递归把对象应用到这个子模版上面
 *
 *
 * 2 属性的匹配 hello, {name} 然后给一个数据{name:"fanjun"} 就可以给出
 * hello, fanjun
 *
 * 3 filter 对于数据输出，支持用abc|l 这种方式来对数据进行filter，filter函数
 * 支持自定义的一些，比如默认是escHTML的，默认的一些比较简单，比如l，u，un
 * len等等，其它的数据都是绑定到当前这个属性的父节点上面对这个属性进行操作
 * 的
 *
 * 4 ? 条件域的处理
 *
 * 5 $ 符号的处理，
 *   对于字符串的循环情况比较有用，主要是表示当前这个数据
 *
 * 6 内置@idx属性，为数组元素在数组中的位置，从0开始，支持简单的+ - 操作，
 * 复杂的操作可以自行通过 filter 函数实现，这样做的原因是因为很多这种循环
 * 的时候点击统计比较重要
 *
 */

(function(globalObj) {

    //匹配分区的正则表达式
    var regSecTag = /\{([#^\/?])([\d\w\.\%\$\+\-\*\/=\>\<=!?@\"\']+)\}/gm,

        //匹配属性的正则表达式
        regFieldTag = /\{([\d\w\$]+|@idx([\%\+-]\d+)?)((?:\|[\w]+)*)\}/gm,


        toString = Object.prototype.toString,

        escapeMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': '&quot;',
            "'": '&#39;'
        };

    function isArray(subvalue) {
        return toString.apply(subvalue).toLowerCase() === "[object array]"
    }

    function isObject(subvalue) {
        return toString.apply(subvalue).toLowerCase() === "[object object]"
    }

    function nullOrUndef(value) {
        return (value === null || typeof value === "undefined")
    }

    function map(array, fn) {
        var data = [];
        for (var i = 0, len = array.length; i < len; i++) {
            data[i] = fn(array[i], i);
        }
        return data;
    }

	function find(array,fn){
		if(!array || isNaN(array.length-0) || array.length<=0){
			return null;
		}
		for(var i=0,len=array.length;i<len;i++){
			if(fn(array[i])){
				return array[i];
			}
		}
		return null;
	}

    function escapeHTML(string) {
        return String(string).replace(/&(?!\w+;)|[<>"']/g, function(s) {
            return escapeMap[s] || s;
        });
    }


    /**
     * tag包装类
     */

    function Tag(tag, flag, start, end) {
        this.tag = tag;
        this.flag = flag;
        this.start = start;
        this.end = end;
    }

    Tag.prototype.addChild = function(tag) {
        if (!this.child) {
            this.child = [];
        }
        this.child.push(tag);
    };

    Tag.prototype.setMatch = function(tag) {
        this.match = tag;
    };

    Tag.prototype.getOuterLen = function() {
        return this.match.end - this.start;
    };

    Tag.prototype.getInner = function(tpl) {
        return tpl.substr(this.end, this.match.start - this.end)
    };

    //寻找分区标记符，主要是为了解决之前的不能匹配嵌套类型的tag的问题
    //通过使用寻找配对的方式，与括号匹配类似
    //支持如下的区块：
    //{#abc}{/abc} 作为一个section，一定match的是一个对象，会递归使用abc对象
    //{?123=b}{/?} 如果条件为真输出里面的值，不作为区块
    //{^abc}{/abc} 如果没有abc属性，展示里面的值


    function compileSection(tpl) {
        var aTopTags = [],
            match, aTags = [],
            tag, parentTag;

        var rootTag = new Tag("root", null, 0, 0);
        rootTag.setMatch(new Tag(null, null, tpl.length, tpl.length));

        regSecTag.lastIndex = 0;
        while (match = regSecTag.exec(tpl)) {
            //搜索到一个区块标记
            tag = new Tag(
            match[2], //值
            match[1], //特殊标记
            match.index, //标签的开始index
            match[0].length + match.index //标签的结束index
            );
            //上一个tag
            lastTag = aTags[aTags.length - 1];
            //搜索到的是一个结束的区块
            if ((tag.tag == "?" && tag.flag == "/" && lastTag != null && lastTag.flag == "?") || (tag.flag == "/" && tag.tag != "?" && lastTag != null && tag.tag == lastTag.tag)) {
                //把上一个区块与这个区块匹配
                lastTag.setMatch(tag);
                aTags.pop();
                //最后一个区块的时候，说明是一个顶层的tag
                if (aTags.length == 0) {
                    aTopTags.push(lastTag);
                } else {
                    //否则，它的父tag为上一个
                    parentTag = aTags[aTags.length - 1];
                    parentTag.addChild(lastTag);
                }
            } else if (tag.flag != "/") {
                //如果flag不等于"/"的话，就说明是开始的标记，放入到aTags
                aTags.push(tag);
            } else {
                //有"/"的情况，但是又不属于第一种情况的时候，
                throw "NoMatchBeginTagError";
            }
        }
        if (aTags.length != 0) {
            throw "NoMatchEndTagError";
        }

        rootTag.child = aTopTags;
        return rootTag;
    }

    function renderImpl(tpl, obj, rootTag, idx,arrayLen) {
        var childs = rootTag.child,
            aStr, section, lastIndex, flag;
        if (!childs || !childs.length > 0) {
            return fillField(rootTag.getInner(tpl), obj, idx);
        } else {
            aStr = [];
            lastIndex = rootTag.end;
            for (var i = 0; i < childs.length; i++) {
                flag = childs[i].flag;
                if (childs[i].end != lastIndex) {
                    aStr.push(fillField(tpl.substr(lastIndex, childs[i].start - lastIndex), obj, idx));
                    lastIndex += childs[i].start - lastIndex;
                }
                //子模版
                if (flag == "#") {
                    section = obj[childs[i].tag];
                    if (section) {
                        if (section.length && section.length > 0) {
                            for (var j = 0; j < section.length; j++) {
                                aStr.push(renderImpl(tpl, section[j], childs[i], j, section.length));
                            }
                        } else if (typeof section.length == "undefined") {
                            aStr.push(renderImpl(tpl, section, childs[i]));
                        }
                    } else {
                        //aStr.push(tpl.substr(childs[i].start,childs[i].match.end-childs[i].start))
                    }
                }
                //条件
                else if (flag == "?") {
                    try {
                        var __currentObject = obj;
                        if (eval(processConditionExp(childs[i].tag,idx,arrayLen))) {
                            aStr.push(renderImpl(tpl, obj, childs[i]));
                        } else {

                        }
                    } catch (e) {
                        throw "BadCondition:"+childs[i].tag+e.toString();
                    }
                }
                lastIndex = lastIndex + childs[i].getOuterLen();
            }
            aStr.push(fillField(tpl.substr(lastIndex, rootTag.match.start - lastIndex), obj, idx));
            return aStr.join("");
        }
    }

    function processConditionExp(exp,idx,len) {
        var str=exp.replace(/\$/g, "__currentObject");
		idx=(parseInt(idx,10));
		len=parseInt(len,10);
		if(!isNaN(idx)){
			str=str.replace("@idx",idx);
		}
		if(!isNaN(len)){
			str=str.replace("@len",len);
		}
		return str;
    }

    function Templet(tpl) {
        this._tpl = tpl;
        this._GlobalFilter = {};
		this._getTplObj();
    }

	Templet.prototype._getTplObj=function(){
        if (!this._tplObj) {
            this._tplObj = compileSection(this._tpl);
        }
	}

    Templet.prototype.render = function(data) {
        return renderImpl(this._tpl, data, this._tplObj);
    }

    Templet.prototype.renderArray = function(data) {
        var that = this;
        return map(data, function(o, index) {
            return renderImpl(that._tpl, o, that._tplObj, index);
        }).join("");
    }

    var _GlobalFilter = {};

    Templet.setFilters = function(obj) {
        for (var i in obj) {
            if (typeof i === "function") {
                _GlobalFilter[i] = obj[i];
            }
        }
    }

    Templet.clearFilters = function() {
        _GlobalFilter = null;
    }

	Templet.prototype.getSection=function(name){
		var childs=this._tplObj.child;
		if(childs!=null && childs.length>0){
			var childTplObj=find(childs,function(v){
				return v.tag==name;
			});
			var result=new Templet("");
			result._tpl=this._tpl;
			result._tplObj=childTplObj;
			return result;
		}
		return null;
	}

    function render(tpl, obj) {
        var rootTag = compileSection(tpl);
        return renderImpl(tpl, obj, rootTag);
    }

    function hasFunc(obj, name) {
        return obj && obj[name] && typeof obj[name] == "function";
    }


    function ellipsis(s,len){
        if(len<=0){
            len = 1;
        }
        if(!s || s.length<len){
            return s;
        }
        else{
            return s.substr(0,len)+"…";
        }
    }

    /**
     * 对数据应用过滤器,u 大写，l小写，ue unescape
     */
    function applyFilters(str, matchfuns, obj) {
        if (!matchfuns) {
            return escapeHTML(str);
        }
        var fns = matchfuns.split("|"),
            filter, 
            elps,
            bEscape = true;
        for (var i = 0; i < fns.length; i++) {
            filter = fns[i];
            elps=/^l(\d+)$/.exec(filter);
            if (filter == "u") {
                str = str.toUpperCase()
            } else if (filter == "l") {
                str = str.toLowerCase()
            } else if (filter == "ue") {
                bEscape = false;
            }else if(elps){
                str = ellipsis(str,elps[1]);
            } else if (hasFunc(obj, filter)) {
                str = obj[filter].call(obj, str);
            } else if (hasFunc(_GlobalFilter, filter)) {
                str = _GlobalFilter[filter](str);
            }
        }
        return bEscape ? escapeHTML(str) : str;
    }

    /**
     * 进行属性数据填充
     */

    function fillField(tplseg, obj, idx) {
        regFieldTag.lastIndex = 0;
        var segStr = [];
        var lastIndex = 0;
        while (match = regFieldTag.exec(tplseg)) {
            if (match.index != lastIndex) {
                segStr.push(tplseg.substr(lastIndex, match.index - lastIndex))
            }

            if (match[1].indexOf("@idx") == 0 && idx !== undefined) {
                segStr.push(applyFilters(eval(match[1].replace("@idx", idx)), match[3], obj))
            } else if (match[1] == "$") {
                if (nullOrUndef(obj)) {
                    segStr.push(match[0]);
                } else {
                    segStr.push(applyFilters(obj.toString(), match[3], obj));
                }
            } else {
                if (nullOrUndef(obj) || nullOrUndef(obj[match[1]])) {
                    segStr.push(match[0]);
                } else {
                    segStr.push(applyFilters(obj[match[1]].toString(), match[3], obj));
                }
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex != tplseg.length) {
            segStr.push(tplseg.substr(lastIndex, tplseg.length - lastIndex));
        }
        return segStr.join("");
    }

    (function() {

        function Log(s){
            console.log(s);
        }

        function assert(tpl, data, result) {
            var obj = new Templet(tpl);
            var iRet = (result == obj.render(data))
            if (!iRet) {
                var rederstr = obj.render(data);
                Log("result: " + rederstr + " length:" + rederstr.length);
                Log(" exept: " + result + " length:" + result.length);
            }
            return iRet;
        }

        function assertArray(tpl, data, result) {
            var obj = new Templet(tpl);
            var iRet = (result == obj.renderArray(data))
            if (!iRet) {
                var rederstr = obj.renderArray(data);
                Log("result: " + rederstr + " length:" + rederstr.length);
                Log(" exept: " + result + " length:" + result.length);
            }
            return iRet;
        }


        function testSection() {
            var cases = [
                ["hello{#sec}123{/sec}",
                {}, "hello"],

                ["hello{#sec}123{/sec}",
                {
                    "a": 1
                }, "hello"],

                ["hello{#sec}123{/sec}",
                {
                    "sec": 1
                }, "hello123"],
                ["hello{#sec}123{/sec}",
                {
                    "sec": 0
                }, "hello"],
                ["hello{#sec}123{/sec}",
                {
                    "sec": []
                }, "hello"],
                ["hello{#sec}123{/sec}",
                {
                    "sec": null
                }, "hello"],
                ["hello{#sec}123{/sec}",
                {
                    "sec": undefined
                }, "hello"],
                ["hello{#sec}123{/sec}",
                {
                    "sec": false
                }, "hello"],
                ["{#sec}123{/sec}hello",
                {}, "hello"],
                ["hello{#sec}123{/sec}hello",
                {}, "hellohello"],
                ["hello{#sec}abc{a}{/sec}",
                {
                    "sec": {
                        a: 1
                    }
                }, "helloabc1"],
                ["hello{#sec}abc{a}{/sec}",
                {
                    "sec": {}
                }, "helloabc{a}"],
                ["hello{#sec}abc{a}{/sec}",
                {
                    "sec": [{}]
                }, "helloabc{a}"],
                ["hello{#sec}abc{a}{/sec}",
                {
                    "sec": [{}, {}]
                }, "helloabc{a}abc{a}"],
                ["hello{#sec}abc{a}{/sec}",
                {
                    "sec": [{
                        b: 1
                    }, {}]
                }, "helloabc{a}abc{a}"],
                ["hello{#sec}abc{$}{/sec}",
                {
                    "sec": [1, 2]
                }, "helloabc1abc2"],
                ["hello{#sec}abc{@idx}{/sec}",
                {
                    "sec": [1, 2]
                }, "helloabc0abc1"],

                ["hello{#sec}abc{@idx+1}{/sec}",
                {
                    "sec": [1, 2]
                }, "helloabc1abc2"],

                ["hello{#sec}abc{@idx%3}{/sec}",
                {
                    "sec": [1, 2]
                }, "helloabc0abc1"],


                ["hello{#sec} {v} you are {@idx+1}{/sec}",
                {
                    "sec": [{v:'yes'},{v:'no'}]
                }, "hello yes you are 1 no you are 2"]
            ]
            for (var i = 0, len = cases.length; i < len; i++) {
                if (!assert.apply(null, cases[i])) {
                    Log("Case " + i + " Failed");
                } else {
                    Log("Case " + i + " Passed");
                }
            }
        }

        function testArray() {
            var cases = [
                ["<li>{abc}</li>", [{
                    abc: 1
                }, {
                    abc: 2
                }], "<li>1</li><li>2</li>"]
            ];
            for (var i = 0, len = cases.length; i < len; i++) {
                if (!assertArray.apply(null, cases[i])) {
                    Log("Case " + i + " Failed");
                } else {
                    Log("Case " + i + " Passed");
                }
            }
        }

        function testField() {
            var cases = [
                ["hello{sec}", {}, "hello{sec}"], 

				["hello{0}", ["yes"], "helloyes"],

                ["hello{sec}", { sec: null }, "hello{sec}"],

                ["hello{sec}", { sec: 0 }, "hello0"],

                ["hello{sec}", { sec: undefined }, "hello{sec}"],

                ["hello{sec}", { sec: "abc" }, "helloabc"],

                ["hello{$}", "abc", "helloabc"],

                ["hello{$}", "0", "hello0"],

                ["hello{$}{efg}", "abc", "helloabc{efg}"],

                ["hello{$}{efg}{@idx+1}", "abc", "helloabc{efg}{@idx+1}"],

                ["hello{sec}efg", { sec: "abc" }, "helloabcefg"],

                [
					"hello{#sec}<sec count='{count}'>{#subsec}<subsec>this is subsec {@idx+1} value is {$}</subsec>{/subsec}</sec>{/sec}",
					{ 
						sec: { 
								 count: 3, 
								 subsec: ["brooks", "fan"] 
							 }
					}, 
					"hello<sec count='3'><subsec>this is subsec 1 value is brooks</subsec><subsec>this is subsec 2 value is fan</subsec></sec>"
				],

                [ "test{abc|ue}", { "abc": '<haha' }, "test<haha" ],

                [ "test{abc}", { "abc": '<haha' }, "test&lt;haha" ],

                [" {abc} {efg|u} {@idx+1} ", { abc: "haha" }, " haha {efg|u} {@idx+1} " ],

                [
					" {abc} {efg|ue|fnabc} {@idx+1} ",
                	{
                    	abc: "<>",
                    	efg: "<>",
						fnabc: function(a) {
							return "_fnabc_" + a;
						}
                	}, 
					" &lt;&gt; _fnabc_<> {@idx+1} "
                ],
                [
					"hello {#abc}before{hahal} hahah {/abc}abc",
					{
						name: "fanjun",
						abc: {
							test: "good"
						}
					}, 
					"hello before{hahal} hahah abc"
                ]
            ];

            for (var i = 0, len = cases.length; i < len; i++) {
                if (!assert.apply(null, cases[i])) {
                    Log("Case " + i + " Failed");
                } else {
                    Log("Case " + i + " Passed");
                }
            }
        }

        function testCondition() {

            var cases = [

                [ "hello {?$.abc=='hallo'}haha {name} {/?}good", { abc: 'hallo', name: "fanjun" }, "hello haha fanjun good" ],

                [ "{?2>1}good{/?}", {}, "good" ],

                [ "{?$.test}test{?$.haha}haha{/?}{?!$.haha}not haha{/?}yes{/?}{?!$.test}no test{/?}", {test:true,haha:false}, "testnot hahayes" ],

                [ "hello {?$.abc==1}haha {name} {/?}good", { abc: 1, name: "fanjun" }, "hello haha fanjun good" ],

                [ "{#abc}<haha {?@idx==0}class=\"set\"{/?}>{$}</haha>{/abc}", { abc: ["ele1","ele2"] }, "<haha class=\"set\">ele1</haha><haha >ele2</haha>" ],

                [ "hello {?!$.abc}haha {name} {/?}good", { name: "fanjun" }, "hello haha fanjun good" ]
            ];
            for (var i = 0, len = cases.length; i < len; i++) {
                if (!assert.apply(null, cases[i])) {
                    Log("Case " + i + " Failed");
                } else {
                    Log("Case " + i + " Passed");
                }
            }
        }

        function testGetSection() {
            var tpl = "abc{#efg}hello {firstName},{secondName}!{/efg}efg";
            var tplObj = new Templet(tpl);
            var result=tplObj.getSection("efg").render({
                firstName: "brooks",
                secondName: "fan"
            });
			Log("Test Get Section:"+(result=="hello brooks,fan!"?"Passed":"Failed"))
        }

        function testAll() {
            testSection();
            testField();
            testCondition();
            testArray();
			testGetSection();
        }

        function testNoEndTag() {
            var s = "123{#abc}123";
            try {
                Log(compileSection(s));
                return false;
            } catch (e) {
                return e == "NoMatchEndTagError";
            }
        }

        function testNoBeginTag() {
            var s = "123{/abc}123";
            try {
                Log(compileSection(s));
                return false;
            } catch (e) {
                return e == "NoMatchBeginTagError";
            }
        }

        function testFillField() {
            Log(fillField(" {abc} {efg|u} {@idx+1} ", {
                abc: "haha"
            }));
            Log(fillField(" {abc} {efg|ue|fnabc} {@idx+1} ", {
                abc: "<>",
                efg: "<>",
                fnabc: function(a) {
                    return "_fnabc_" + a;
                }
            }, 2));
        }
        //testAll()
    })();

	globalObj.Templet=Templet;

})(this);
